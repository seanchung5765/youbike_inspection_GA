const express = require('express');
const router = express.Router();
const db = require('../service/db');
const cron = require('node-cron');

// ============================================================================
// 🚀 核心結算引擎：官方為主 + 單獨計算營運處總分
// ============================================================================
const calculateMonthlyScores = async (month) => {
  console.log(`[排程啟動] 開始計算 ${month} 月份總分...`);
  try {
    const [records] = await db.query(`SELECT * FROM copied_inspections WHERE report_month = ?`, [month]);
    const [rules] = await db.query(`SELECT * FROM scoring_rules WHERE is_active = 1`);

    const [usersRows] = await db.query(`SELECT u.name, u.emp_id, f.name AS role_name FROM users u LEFT JOIN front_roles f ON u.front_role_id = f.id`);
    const userRoleMap = {};
    usersRows.forEach(u => {
      if(u.name) userRoleMap[u.name] = u.role_name;
      if(u.emp_id) userRoleMap[u.emp_id] = u.role_name;
    });

    const [oldScores] = await db.query(`
      SELECT city, total_fleet_bikes, accident_bikes, broken_bikes, maintenance_records 
      FROM city_monthly_scores WHERE report_month = ?
    `, [month]);
    const manualDataMap = {};
    oldScores.forEach(row => { manualDataMap[row.city] = row; });

    const mergeGroupCatMap = {};
    rules.forEach(r => { if (r.merge_group) mergeGroupCatMap[r.merge_group] = r.major_category; });

    const maxDeductionMap = { '場站': 0, '自行車外觀與重要標示': 0, '自行車重要機能': 0 };
    let mergeGroupMaxMap = {};
    rules.forEach(rule => {
      const pts = Math.abs(parseFloat(rule.deduction_points || 0));
      if (rule.merge_group) mergeGroupMaxMap[rule.merge_group] = Math.max(mergeGroupMaxMap[rule.merge_group] || 0, pts);
      else if (maxDeductionMap[rule.major_category] !== undefined) maxDeductionMap[rule.major_category] += pts;
    });

    Object.keys(mergeGroupMaxMap).forEach(group => {
      const pts = mergeGroupMaxMap[group];
      const cat = mergeGroupCatMap[group];
      if (maxDeductionMap[cat] !== undefined) maxDeductionMap[cat] += pts;
    });

    const sumMaxStation = maxDeductionMap['場站'];
    const sumMaxAppearance = maxDeductionMap['自行車外觀與重要標示'];
    const sumMaxFunction = maxDeductionMap['自行車重要機能'];
    const sumMaxTotal = sumMaxStation + sumMaxAppearance + sumMaxFunction;

    const [regionRows] = await db.query(`SELECT r.name AS city_name, rg.name AS group_name FROM regions r LEFT JOIN report_groups rg ON r.report_group_id = rg.id`);
    const cityToGroupMap = {};
    regionRows.forEach(r => {
      if (r.city_name && r.group_name) {
        cityToGroupMap[r.city_name] = r.group_name;
        cityToGroupMap[r.city_name.replace('臺', '台')] = r.group_name;
        cityToGroupMap[r.city_name.replace('台', '臺')] = r.group_name;
      }
    });

    const groupStats = {};
    const distinctGroups = [...new Set(Object.values(cityToGroupMap))].filter(g => g);
    
    distinctGroups.forEach(g => {
      groupStats[g] = { 
        official: {
          unique_stations: new Set(), inspection_events: new Set(), 
          total_bikes: 0, ebikes_count: 0, tire_fail_count: 0,
          raw_station_deduction: 0, raw_appearance_deduction: 0, raw_function_deduction: 0,
          inspection_count: 0, total_docked_bikes: 0, unrentable_bikes: 0,
          deduction_total: 0, deduction_2_0: 0, deduction_2_0e: 0,
          raw_appearance_deduction_2_0: 0, raw_function_deduction_2_0: 0,
          raw_appearance_deduction_2_0e: 0, raw_function_deduction_2_0e: 0
        },
        ops: { total_bikes: 0, deduction_total: 0 } 
      };
    });

    records.forEach(row => {
      const creatorRole = userRoleMap[row.created_by] || '其他';
      const rawCity = row.city ? row.city.trim() : '未知';
      const groupName = cityToGroupMap[rawCity] || '未分類';
      if (groupName === '未分類') return;

      if (creatorRole === '營運處') {
        const opsPool = groupStats[groupName].ops;
        if (row.bike_no) opsPool.total_bikes += 1;
        let rowTotalDeduction = 0; 
        let mergeBuckets = {}; 
        rules.forEach(rule => {
          if (row[rule.item_key] === 1) {
            const points = parseFloat(rule.deduction_points || 0);
            if (rule.merge_group) mergeBuckets[rule.merge_group] = Math.min(mergeBuckets[rule.merge_group] || 0, points);
            else rowTotalDeduction += points;
          }
        });
        Object.values(mergeBuckets).forEach(pts => rowTotalDeduction += pts);
        opsPool.deduction_total += rowTotalDeduction;

      } else {
        const statPool = groupStats[groupName].official;
        if (row.station_name) {
          statPool.unique_stations.add(row.station_name);
          let pureDate = 'unknown_date';
          if (row.created_at) {
            const d = new Date(row.created_at);
            pureDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; 
          }
          const eventKey = `${row.station_name}_${pureDate}_${row.created_by}`;
          if (!statPool.inspection_events.has(eventKey)) {
            statPool.inspection_events.add(eventKey);
            statPool.inspection_count += 1;
            statPool.total_docked_bikes += parseInt(row.bikes_in_dock_count) || 0;
            statPool.unrentable_bikes += (parseInt(row.reversed_saddle_count) || 0) + (parseInt(row.inactive_bike_count) || 0);
          }
        }
        if (row.bike_no) {
          statPool.total_bikes += 1;
          if (row.model === '2.0E') statPool.ebikes_count += 1;
          const front = row.front_tire_psi || 0;
          const rear = row.rear_tire_psi || 0;
          if ((front > 0 && (front < 50 || front > 75)) || (rear > 0 && (rear < 50 || rear > 75))) statPool.tire_fail_count += 1;
        }

        let rowTotalDeduction = 0; let rowBikeDeduction = 0; let mergeBuckets = {}; 
        rules.forEach(rule => {
          if (row[rule.item_key] === 1) {
            const points = parseFloat(rule.deduction_points || 0);
            if (rule.merge_group) mergeBuckets[rule.merge_group] = Math.min(mergeBuckets[rule.merge_group] || 0, points);
            else {
              rowTotalDeduction += points;
              if (rule.major_category !== '場站') {
                rowBikeDeduction += points;
                if (rule.major_category === '自行車外觀與重要標示') {
                  if (row.model === '2.0E') statPool.raw_appearance_deduction_2_0e += points;
                  else statPool.raw_appearance_deduction_2_0 += points;
                }
                if (rule.major_category === '自行車重要機能') {
                  if (row.model === '2.0E') statPool.raw_function_deduction_2_0e += points;
                  else statPool.raw_function_deduction_2_0 += points;
                }
              }
              if (rule.major_category === '場站') statPool.raw_station_deduction += points;
              if (rule.major_category === '自行車外觀與重要標示') statPool.raw_appearance_deduction += points;
              if (rule.major_category === '自行車重要機能') statPool.raw_function_deduction += points;
            }
          }
        });

        Object.keys(mergeBuckets).forEach(group => {
          const points = mergeBuckets[group];
          rowTotalDeduction += points;
          const cat = mergeGroupCatMap[group];
          if (cat !== '場站') {
            rowBikeDeduction += points;
            if (cat === '自行車外觀與重要標示') {
              if (row.model === '2.0E') statPool.raw_appearance_deduction_2_0e += points;
              else statPool.raw_appearance_deduction_2_0 += points;
            }
            if (cat === '自行車重要機能') {
              if (row.model === '2.0E') statPool.raw_function_deduction_2_0e += points;
              else statPool.raw_function_deduction_2_0 += points;
            }
          }
          if (cat === '場站') statPool.raw_station_deduction += points;
          if (cat === '自行車外觀與重要標示') statPool.raw_appearance_deduction += points;
          if (cat === '自行車重要機能') statPool.raw_function_deduction += points;
        });

        statPool.deduction_total += rowTotalDeduction;
        if (row.model === '2.0E') statPool.deduction_2_0e += rowBikeDeduction; 
        else statPool.deduction_2_0 += rowBikeDeduction; 
      }
    });

    await db.query(`DELETE FROM city_monthly_scores WHERE report_month = ?`, [month]);

    for (const [groupName, pools] of Object.entries(groupStats)) {
      const stat = pools.official;
      const opsStat = pools.ops;

      const tireFailRate = stat.total_bikes > 0 ? (stat.tire_fail_count / stat.total_bikes) * 100 : 0;
      const count_2_0e = stat.ebikes_count;
      const count_2_0 = stat.total_bikes - count_2_0e;

      const calculateYourFormula = (A, Ds, N) => {
        if (N === 0 || sumMaxTotal === 0 || A === 0) return 100.00; 
        const weight = (A / sumMaxTotal) * 100;
        const finalVal = (((weight * N) + Ds) / N / weight) * 100; 
        return parseFloat(finalVal.toFixed(2));
      };

      const score_station = calculateYourFormula(sumMaxStation, stat.raw_station_deduction, stat.total_bikes);
      const score_appearance = calculateYourFormula(sumMaxAppearance, stat.raw_appearance_deduction, stat.total_bikes);
      const score_function = calculateYourFormula(sumMaxFunction, stat.raw_function_deduction, stat.total_bikes);

      const score_2_0_appearance = calculateYourFormula(sumMaxAppearance, stat.raw_appearance_deduction_2_0, count_2_0);
      const score_2_0_function = calculateYourFormula(sumMaxFunction, stat.raw_function_deduction_2_0, count_2_0);
      const score_2_0e_appearance = calculateYourFormula(sumMaxAppearance, stat.raw_appearance_deduction_2_0e, count_2_0e);
      const score_2_0e_function = calculateYourFormula(sumMaxFunction, stat.raw_function_deduction_2_0e, count_2_0e);

      let availability_rate_calc = 100.00;
      if (stat.total_docked_bikes > 0) availability_rate_calc = ((stat.total_docked_bikes - stat.unrentable_bikes) / stat.total_docked_bikes) * 100;

      let availability_penalty = 0;
      if (availability_rate_calc < 91) availability_penalty = -5;
      else if (availability_rate_calc >= 91 && availability_rate_calc < 93) availability_penalty = -4;
      else if (availability_rate_calc >= 93 && availability_rate_calc < 95) availability_penalty = -3;
      else if (availability_rate_calc >= 95 && availability_rate_calc < 97) availability_penalty = -2;
      else if (availability_rate_calc >= 97 && availability_rate_calc < 99) availability_penalty = -1;

      const md = manualDataMap[groupName] || {};
      const t_fleet = md.total_fleet_bikes || 0;
      const t_accident = md.accident_bikes || 0;
      const t_broken = md.broken_bikes || 0; 
      const m_records = md.maintenance_records || 0;

      let maintenance_rate = 0;
      let maintenance_penalty = 0;
      const valid_bikes = t_fleet - t_accident - t_broken;
      
      if (valid_bikes > 0) maintenance_rate = (m_records / valid_bikes) * 100;
      
      if (t_fleet > 0) {
        if (maintenance_rate < 70) maintenance_penalty = -5;
        else if (maintenance_rate >= 70 && maintenance_rate < 75) maintenance_penalty = -4;
        else if (maintenance_rate >= 75 && maintenance_rate < 80) maintenance_penalty = -3;
        else if (maintenance_rate >= 80 && maintenance_rate < 85) maintenance_penalty = -2;
        else if (maintenance_rate >= 85 && maintenance_rate < 90) maintenance_penalty = -1;
      }

      let score_2_0 = 100.00;
      if (count_2_0 > 0) score_2_0 = 100 + (stat.deduction_2_0 / count_2_0);
      let score_2_0e = 100.00;
      if (count_2_0e > 0) score_2_0e = 100 + (stat.deduction_2_0e / count_2_0e);

      let score_total_base = 100.00;
      if (stat.total_bikes > 0) score_total_base = 100 + (stat.deduction_total / stat.total_bikes);
      let final_score = score_total_base + availability_penalty + maintenance_penalty;

      let ops_final_score = null;
      if (opsStat.total_bikes > 0) {
        const ops_base = 100 + (opsStat.deduction_total / opsStat.total_bikes);
        ops_final_score = ops_base + availability_penalty + maintenance_penalty;
      }

      await db.query(`
        INSERT INTO city_monthly_scores 
        (report_month, city, tested_stations, total_bikes, ebikes_count, tire_fail_count, tire_fail_rate, 
         pure_station, pure_appearance, pure_function, maintenance_rate, availability_rate, final_score,
         inspection_count, total_docked_bikes, unrentable_bikes, availability_rate_calc, availability_penalty,
         total_fleet_bikes, accident_bikes, broken_bikes, maintenance_records, maintenance_penalty,
         score_2_0, score_2_0e, score_2_0_appearance, score_2_0_function, score_2_0e_appearance, score_2_0e_function, ops_final_score)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        month, groupName, stat.unique_stations.size, stat.total_bikes, stat.ebikes_count, stat.tire_fail_count, tireFailRate.toFixed(2), 
        score_station, score_appearance, score_function, maintenance_rate.toFixed(2), availability_rate_calc.toFixed(2), final_score.toFixed(2),
        stat.inspection_count, stat.total_docked_bikes, stat.unrentable_bikes, availability_rate_calc.toFixed(2), availability_penalty,
        t_fleet, t_accident, t_broken, m_records, maintenance_penalty,
        score_2_0.toFixed(2), score_2_0e.toFixed(2), score_2_0_appearance.toFixed(2), score_2_0_function.toFixed(2), score_2_0e_appearance.toFixed(2), score_2_0e_function.toFixed(2),
        ops_final_score !== null ? ops_final_score.toFixed(2) : null
      ]);
      
    }
    
// ==========================================================
    // 🌟 關鍵新增：所有縣市算完後，進行「大區(營運區)加權平均」並寫回資料庫
    // ==========================================================
    const [scoresForGroup] = await db.query(`
      SELECT c.city, c.final_score, c.total_bikes, rg.merge_group 
      FROM city_monthly_scores c
      LEFT JOIN report_groups rg ON c.city = rg.name
      WHERE c.report_month = ?
    `, [month]);

    const groupCalc = {};
    
    // 1. 分群累加總分與總車數
    scoresForGroup.forEach(row => {
      const mg = row.merge_group || row.city; 
      if (!groupCalc[mg]) groupCalc[mg] = { totalWeight: 0, totalBikes: 0 };
      
      if (row.total_bikes > 0 && row.final_score !== null) {
        groupCalc[mg].totalWeight += (parseFloat(row.final_score) * parseInt(row.total_bikes));
        groupCalc[mg].totalBikes += parseInt(row.total_bikes);
      }
    });

    // 2. 算好加權平均後，UPDATE 寫回該縣市的 group_final_score 欄位
    for (const row of scoresForGroup) {
      const mg = row.merge_group || row.city;
      const calc = groupCalc[mg];
      const groupScore = calc.totalBikes > 0 ? (calc.totalWeight / calc.totalBikes).toFixed(2) : null;
      
      await db.query(`
        UPDATE city_monthly_scores 
        SET group_final_score = ? 
        WHERE report_month = ? AND city = ?
      `, [groupScore, month, row.city]);
    }
    // ==========================================================

    console.log(`[排程結束] ${month} 月份大區結算完成！`);
  } catch (error) {
    console.error(`[排程錯誤] 計算失敗:`, error);
    throw error;
  }
};



cron.schedule('0 0 * * *', async () => {
  const d = new Date();
  const currentMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  await calculateMonthlyScores(currentMonth);
});

router.get('/summary', async (req, res) => {
  const { month, user_id, role_level } = req.query;
  try {
    let sql = `
      SELECT c.*, rg.merge_group 
      FROM city_monthly_scores c
      LEFT JOIN report_groups rg ON c.city = rg.name
      WHERE c.report_month = ?
    `;
    let params = [month];
    
    if (!role_level || parseInt(role_level) < 90) {
      sql += ` AND rg.id IN (SELECT report_group_id FROM user_view_regions WHERE user_id = ?)`;
      params.push(user_id);
    }
    sql += ` ORDER BY rg.id ASC`;
    const [rows] = await db.query(sql, params);

    const [statusRows] = await db.query(`SELECT status FROM monthly_reports WHERE report_month = ?`, [month]);
    const status = statusRows.length > 0 ? statusRows[0].status : 'draft';

    res.json({ success: true, data: rows, status: status });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

router.post('/recalculate', async (req, res) => {
  const { month } = req.body;
  if (!month) return res.status(400).json({ success: false, message: '缺少月份' });
  try {
    await calculateMonthlyScores(month);
    res.json({ success: true, message: '重新計算完成' });
  } catch (error) {
    // 🌟 如果計算當機，會回傳 500 給前端，前端就會顯示紅色的「結算失敗」
    res.status(500).json({ success: false, message: '計算發生錯誤，請檢查資料庫欄位' });
  }
});

router.put('/maintenance', async (req, res) => {
  const { month, city, field, value } = req.body;
  try {
    await db.query(`UPDATE city_monthly_scores SET ?? = ? WHERE report_month = ? AND city = ?`, [field, value, month, city]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

router.get('/months', async (req, res) => {
  const { role_level } = req.query;
  try {
    let sql = `SELECT DISTINCT report_month FROM monthly_reports WHERE 1=1 `;
    if (!role_level || parseInt(role_level) < 90) sql += ` AND status = 'published' `;
    sql += ` ORDER BY report_month DESC`;
    const [rows] = await db.query(sql);
    res.json({ success: true, data: rows.map(r => r.report_month) });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

// 🌟 缺失統計表：強制剔除營運處的資料
router.get('/city-issues', async (req, res) => {
  const { month, city } = req.query; 
  if (!month || !city) return res.status(400).json({ success: false, message: '缺少參數' });

  try {
    const [regionRows] = await db.query(`SELECT r.name AS city_name, rg.name AS group_name FROM regions r LEFT JOIN report_groups rg ON r.report_group_id = rg.id`);
    const targetCities = [];
    regionRows.forEach(r => {
      if (r.group_name === city) {
        targetCities.push(r.city_name);
        targetCities.push(r.city_name.replace('臺', '台'));
        targetCities.push(r.city_name.replace('台', '臺'));
      }
    });
    const validCities = [...new Set(targetCities)];

    if (validCities.length === 0) return res.json({ success: true, data: { A: [], B: [], C: [], summary: { totalStations: 0, totalBikes: 0, ebikesCount: 0 } } });

    const [usersRows] = await db.query(`SELECT u.name, u.emp_id, f.name AS role_name FROM users u LEFT JOIN front_roles f ON u.front_role_id = f.id`);
    const userRoleMap = {};
    usersRows.forEach(us => {
      if(us.name) userRoleMap[us.name] = us.role_name;
      if(us.emp_id) userRoleMap[us.emp_id] = us.role_name;
    });

    const [allRecords] = await db.query(`SELECT * FROM copied_inspections WHERE report_month = ? AND city IN (?)`, [month, validCities]);
    
    // 🌟 核心過濾：不論是誰登入，都強制排除營運處的資料
    const records = allRecords.filter(row => {
      const creatorRole = userRoleMap[row.created_by] || '其他';
      return creatorRole !== '營運處';
    });

    const [rules] = await db.query(`SELECT * FROM scoring_rules WHERE is_active = 1 ORDER BY major_category, id`);

    const uniqueStations = new Set();
    let totalBikes = 0, ebikesCount = 0;
    records.forEach(row => {
      if (row.station_name) uniqueStations.add(row.station_name);
      if (row.bike_no) { totalBikes += 1; if (row.model === '2.0E') ebikesCount += 1; }
    });

    const totalStations = uniqueStations.size;
    const resultData = { A: [], B: [], C: [], summary: { totalStations, totalBikes, ebikesCount } };

    rules.forEach(rule => {
      let failCount = 0;
      if (rule.major_category === '場站') {
        const failedStations = new Set();
        records.forEach(row => {
          if (row[rule.item_key] === 1 && row.station_name) failedStations.add(row.station_name);
        });
        failCount = failedStations.size;
      } else {
        records.forEach(row => { if (row[rule.item_key] === 1) failCount += 1; });
      }

      const denominator = rule.major_category === '場站' ? totalStations : totalBikes;
      const failRate = denominator > 0 ? (failCount / denominator) * 100 : 0;
      
      const itemData = {
        major_category: rule.major_category, sub_category: rule.sub_category || '',
        item_name: rule.item_name, fail_count: failCount, fail_rate: parseFloat(failRate.toFixed(0)) 
      };
      
      if (rule.severity === 'A' || rule.severity === '重大問題') resultData.A.push(itemData);
      else if (rule.severity === 'B' || rule.severity === '重點問題') resultData.B.push(itemData);
      else resultData.C.push(itemData); 
    });
    res.json({ success: true, data: resultData });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

router.get('/cities', async (req, res) => {
  const { user_id, role_level } = req.query;
  try {
    let sql = `SELECT id, name FROM report_groups WHERE status = 'ACTIVE' `;
    let params = [];
    if (!role_level || parseInt(role_level) < 90) {
      sql += ` AND id IN (SELECT report_group_id FROM user_view_regions WHERE user_id = ?)`;
      params.push(user_id);
    }
    sql += ` ORDER BY id ASC`;
    const [rows] = await db.query(sql, params);
    res.json({ success: true, data: rows.map(r => r.name) });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

module.exports = router;