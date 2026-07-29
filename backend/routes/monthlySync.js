const express = require('express');
const router = express.Router();
const db = require('../service/db'); 


// 🌟 輔助小工具：自動產生「最近 6 個月」的陣列
const generateLast6Months = () => {
  const months = [];
  const d = new Date();

  d.setDate(1); 
  
  for (let i = 0; i < 6; i++) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    months.push(`${year}-${month}`);
    d.setMonth(d.getMonth() - 1);
  }
  return months;
};

// ============================================================================
// 📋 1. 取得月度報表清單 
// ============================================================================
router.get('/list', async (req, res) => {
  try {
    const last6Months = generateLast6Months(); 
    const [dbRecords] = await db.query(`
      SELECT report_month, status, imported_at, imported_by, last_sync_time 
      FROM monthly_reports 
      WHERE report_month IN (?)
    `, [last6Months]);

    const dbRecordMap = {};
    dbRecords.forEach(record => {
      dbRecordMap[record.report_month] = record;
    });

    const finalData = last6Months.map(month => ({
      report_month: month,
      status: dbRecordMap[month] ? dbRecordMap[month].status : 'pending',
      last_sync_time: dbRecordMap[month] ? dbRecordMap[month].last_sync_time : null
    }));

    res.json({ success: true, data: finalData });
  } catch (error) {
    console.error('取得報表清單失敗:', error);
    res.status(500).json({ success: false, message: '取得列表失敗' });
  }
});

// ============================================================================
// 🌟 改造：跨月自動建檔，且對當月「pending」或「draft」狀態自動執行同步
// ============================================================================
router.post('/cron-daily-sync', async (req, res) => {
  const d = new Date();
  // 取得當下的真實月份 (例如: '2026-08')
  const currentMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  try {
    // 💡 步驟 1：跨月偵測與自動建檔
    const [existing] = await db.query(`SELECT status FROM monthly_reports WHERE report_month = ?`, [currentMonth]);
    
    if (existing.length === 0) {
      console.log(`[自動排程] 偵測到跨月！自動建立 ${currentMonth} 的報表紀錄...`);
      // 如果資料庫還沒有這個月，就 INSERT 一筆，狀態預設為 'pending'
      await db.query(`
        INSERT INTO monthly_reports (report_month, status, imported_by, created_at, updated_at) 
        VALUES (?, 'pending', 'System', NOW(), NOW())
      `, [currentMonth]);
    }

    // 💡 步驟 2：針對「當月」，且狀態為「pending」或「draft」進行更新
    const [reports] = await db.query(`SELECT status FROM monthly_reports WHERE report_month = ?`, [currentMonth]);
    
    if (reports.length > 0 && ['pending', 'draft'].includes(reports[0].status)) {
      console.log(`[自動排程] 開始同步當月 (${currentMonth}) 的最新資料...`);
      
      // 更新最後同步時間。如果是 pending，順便把它轉成 draft (代表已經有資料匯入了)
      await db.query(`
        UPDATE monthly_reports 
        SET last_sync_time = NOW(), status = 'draft' 
        WHERE report_month = ?
      `, [currentMonth]);
      
      console.log(`[自動排程] ${currentMonth} 資料同步完成！`);
      return res.json({ success: true, message: `${currentMonth} 排程與更新成功` });
    }

    // 💡 步驟 3：如果狀態是 published (已發布)，則直接略過保護資料
    return res.json({ success: true, message: `已確保 ${currentMonth} 存在。當前狀態為 ${reports[0]?.status}，不執行資料覆蓋` });

  } catch (error) {
    console.error(`[自動排程] 執行失敗:`, error);
    return res.status(500).json({ success: false, message: '排程執行失敗' });
  }
});

// ============================================================================
// 🚀 2. 執行跨庫資料同步 (🌟 終極時區邊界校正版)
// ============================================================================
router.post('/sync', async (req, res) => {
  const { month, operator_id } = req.body; 
  if (!month) return res.status(400).json({ success: false, message: '缺少月份' });

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    await connection.query(`
      INSERT INTO monthly_reports (report_month, status, imported_at, imported_by, last_sync_time) 
      VALUES (?, 'draft', NOW(), ?, NOW())
      ON DUPLICATE KEY UPDATE 
        status = 'draft',
        imported_at = NOW(),
        imported_by = ?,
        last_sync_time = NOW()
    `, [month, operator_id, operator_id]);

    await connection.query(`DELETE FROM copied_inspections WHERE report_month = ?`, [month]);
    
    // 🌟 絕對關鍵：在 WHERE 條件裡加上 INTERVAL 8 HOUR 來判斷「真正的台灣月份」
    // 但是！我們不再把 tw_time 選出來，我們只拿原始的 row.created_at！
    const [oldRows] = await connection.query(`
      SELECT *
      FROM \`youbike_inspector\`.inspections 
      WHERE DATE_FORMAT(DATE_ADD(created_at, INTERVAL 8 HOUR), '%Y-%m') = ? 
        AND created_by <> 'GB4952'
    `, [month]);

    console.log(`[同步準備] 來源庫 ${month} 共有 ${oldRows.length} 筆資料`);

    if (oldRows.length > 0) {
      const safeDate = (d) => {
        if (!d) return null;
        if (d instanceof Date && isNaN(d.getTime())) return null; 
        if (typeof d === 'string' && d.includes('0000-00-00')) return null; 
        return d;
      };

      let successCount = 0;
      let errorCount = 0;

      for (const row of oldRows) {
        const data = {
          id: row.id, 
          report_month: month,
          front_role: '', 
          station_id: row.station_id || '',
          city: row.city || '',
          station_name: row.station_name || '',
          bikes_in_dock_count: row.bikes_in_dock_count || 0,
          reversed_saddle_count: row.reversed_saddle_count || 0,
          inactive_bike_count: row.inactive_bike_count || 0,
          signpost_no_design: (row.signpost_issue & 1) ? 1 : 0,
          signpost_crooked:   (row.signpost_issue & 2) ? 1 : 0,
          signpost_missing:   (row.signpost_issue & 4) ? 1 : 0,
          station_clean_garbage: (row.station_cleanliness & 1) ? 1 : 0,
          station_clean_leaves:  (row.station_cleanliness & 2) ? 1 : 0,
          station_note: row.station_note || '',

          bike_no: row.bike_no || '',
          model: row.model || '',
          check_date: safeDate(row.check_date),
          first_level_checker: row.checker || '',
          sticker_missing:         (row.sticker & 1) ? 1 : 0,
          sticker_unreadable:      (row.sticker & 2) ? 1 : 0,
          sticker_old_not_removed: (row.sticker & 4) ? 1 : 0,

          dock_no: row.dock_no || '',
          dock_info_number:   (row.dock_info & 1) ? 1 : 0,
          dock_info_station:  (row.dock_info & 2) ? 1 : 0,
          dock_sticker_sides: (row.dock_appearance_env & 1) ? 1 : 0,
          dock_body_board:    (row.dock_appearance_env & 2) ? 1 : 0,
          dock_lock_rust_10:  (row.dock_appearance_env & 4) ? 1 : 0,
          dock_garbage:       (row.dock_appearance_env & 8) ? 1 : 0,
          dock_solar_not:     (row.dock_solar_panel & 8) ? 1 : 0,
          dock_solar_broken:  (row.dock_solar_panel & 2) ? 1 : 0,
          dock_solar_moisture:(row.dock_solar_panel & 4) ? 1 : 0,
          dock_light_issue:   (row.dock_function_check & 1) ? 1 : 0,
          dock_wobble:        (row.dock_function_check & 2) ? 1 : 0,
          dock_rent_issue:    (row.dock_function_check & 4) ? 1 : 0,
          dock_guide_missing: (row.dock_guide_rail & 1) ? 1 : 0,
          dock_guide_loose:   (row.dock_guide_rail & 2) ? 1 : 0,
          dock_note: row.dock_note || '',

          headunit_dirty:       (row.headunit_housing & 1) ? 1 : 0,
          headunit_broken:      (row.headunit_housing & 2) ? 1 : 0,
          headunit_bubble:      (row.headunit_housing & 4) ? 1 : 0,
          headunit_rent_issue:  (row.headunit_function & 2) ? 1 : 0,
          headunit_unlock_fail: (row.headunit_function & 1) ? 1 : 0,
          headunit_screen_issue:(row.headunit_function & 4) ? 1 : 0,
          headunit_sound_issue: (row.headunit_function & 8) ? 1 : 0,
          headunit_other_note:  (row.headunit_function & 16) ? 1 : 0,
          fee_sticker_missing:  (row.fare_sticker & 1) ? 1 : 0,
          fee_sticker_broken:   (row.fare_sticker & 2) ? 1 : 0,
          basket_sticker_front: (row.basket_sticker & 1) ? 1 : 0,
          basket_sticker_back:  (row.basket_sticker & 2) ? 1 : 0,
          basket_dirty:         (row.basket_issue & 1) ? 1 : 0,
          basket_garbage:       (row.basket_issue & 2) ? 1 : 0,
          basket_broken:        (row.basket_issue & 4) ? 1 : 0,
          basket_wire_broken:   (row.basket_issue & 8) ? 1 : 0,

          grip_sticker_left:    (row.handlebar_sticker & 1) ? 1 : 0,
          grip_sticker_right:   (row.handlebar_sticker & 2) ? 1 : 0,
          grip_worn:            (row.grip_issue & 1) ? 1 : 0,
          grip_dirty:           (row.grip_issue & 2) ? 1 : 0,
          grip_right_broken:    (row.grip_issue & 4) ? 1 : 0,
          bell_missing_silent:  (row.bell_issue & 1) ? 1 : 0,
          bell_sticker_issue:   (row.bell_issue & 2) ? 1 : 0,
          housing_tube:         (row.housing_issue & 1) ? 1 : 0,
          housing_brake:        (row.housing_issue & 2) ? 1 : 0,
          housing_gear:         (row.housing_issue & 4) ? 1 : 0,

          frame_head_crooked:   (row.frame_head & 1) ? 1 : 0,
          frame_head_stuck:     (row.frame_head & 2) ? 1 : 0,
          frame_dirty:          (row.frame_body & 1) ? 1 : 0,
          frame_paint_peeling:  (row.frame_body & 2) ? 1 : 0,
          sticker_city_logo:    (row.logo_sticker_issue & 1) ? 1 : 0,
          sticker_bike_number:  (row.logo_sticker_issue & 2) ? 1 : 0,
          sticker_youbike_logo: (row.logo_sticker_issue & 4) ? 1 : 0,
          fender_dirty_broken:  (row.fenders & 2) ? 1 : 0,
          fender_broken:        (row.fenders & 4) ? 1 : 0,
          rear_fender_ad:       (row.rear_fender_sticker & 1) ? 1 : 0,
          rear_fender_logo:     (row.rear_fender_sticker & 2) ? 1 : 0,
          rear_fender_bike_no:  (row.rear_fender_sticker & 4) ? 1 : 0,
          rear_fender_battery:  (row.rear_fender_sticker & 16) ? 1 : 0,
          fender_transparent_film: (row.rear_fender_sticker & 8) ? 1 : 0,
          seatclamp_sticker_issue: (row.seatclamp_sticker & 1) ? 1 : 0,
          appearance_note: row.appearance_note || '',

          spring_missing:       (row.anti_rotation_spring & 2) ? 1 : 0,
          structure_black_tube: (row.structure_issue & 1) ? 1 : 0,
          kickstand_missing:    (row.kickstand_issue & 1) ? 1 : 0,
          kickstand_deformed:   (row.kickstand_issue & 2) ? 1 : 0,
          pedal_missing:        (row.pedal_issue & 1) ? 1 : 0,
          pedal_deformed:       (row.pedal_issue & 2) ? 1 : 0,
          lock_fail:            (row.bike_lock_issue & 1) ? 1 : 0,
          lock_sticker_issue:   (row.bike_lock_issue & 2) ? 1 : 0,
          lock_rust_10:         (row.bike_lock_issue & 4) ? 1 : 0,
          saddle_crooked:        (row.saddle_issue & 1) ? 1 : 0,
          saddle_loose:          (row.saddle_issue & 2) ? 1 : 0,
          saddle_broken_base:    (row.saddle_issue & 4) ? 1 : 0,
          saddle_surface_broken: (row.saddle_issue & 8) ? 1 : 0,
          saddle_dirty:          (row.saddle_issue & 16) ? 1 : 0,
          seatpost_locked:       (row.seatpost_height_adjust & 1) ? 1 : 0,
          seatpost_slip:         (row.seatpost_height_adjust & 2) ? 1 : 0,
          seatpost_stuck:        (row.seatpost_height_adjust & 4) ? 1 : 0,
          seatpost_lever_broken: (row.seatpost_height_adjust & 8) ? 1 : 0,
          seatpost_reverse_unfixed: (row.seatpost_positioning_abnormal & 1) ? 1 : 0,
          seatpost_reverse_wrong_pos: (row.seatpost_positioning_abnormal & 2) ? 1 : 0,
          seatpost_wobble:      (row.seatpost_positioning_abnormal & 4) ? 1 : 0,
          seatpost_separated:   (row.seatpost_positioning_abnormal & 8) ? 1 : 0,
          seatpost_scale_blur:  (row.seatpost_positioning_abnormal & 16) ? 1 : 0,
          structure_note: row.structure_note || '',

          tire_worn:            (row.tire_issue & 1) ? 1 : 0,
          tire_rim_deformed:    (row.tire_issue & 2) ? 1 : 0,
          tire_wobble:          (row.tire_issue & 4) ? 1 : 0,
          axle_bolt_front:      (row.axle_bolt_issue & 1) ? 1 : 0,
          axle_bolt_rear:       (row.axle_bolt_issue & 2) ? 1 : 0,
          gear_silver_cap_missing: (row.gear_issue & 1) ? 1 : 0,
          gear_black_cap_missing:  (row.gear_issue & 2) ? 1 : 0,
          gear_stuck:           (row.gear_issue & 4) ? 1 : 0,
          gear_slip:            (row.gear_issue & 8) ? 1 : 0,
          gear_fail:            (row.gear_issue & 16) ? 1 : 0,
          brake_fail:           (row.brake_issue & 1) ? 1 : 0,
          brake_loose:          (row.brake_issue & 2) ? 1 : 0,
          brake_tight:          (row.brake_issue & 4) ? 1 : 0,
          brake_noise:          (row.brake_issue & 8) ? 1 : 0,
          lights_moving_front:  (row.lights_moving & 1) ? 1 : 0,
          lights_moving_rear:   (row.lights_moving & 2) ? 1 : 0,
          lights_stationary_not_lit: (row.lights_stationary & 1) ? 1 : 0,
          lights_stationary_not_off: (row.lights_stationary & 2) ? 1 : 0,
          lights_stationary_flicker: (row.lights_stationary & 4) ? 1 : 0,
          lights_reflector_broken:   (row.lights_stationary & 8) ? 1 : 0,

          ride_unsmooth:        (row.ride_test_issue & 1) ? 1 : 0,
          chain_noise:          (row.ride_test_issue & 2) ? 1 : 0,
          ride_noise:           (row.ride_test_issue & 4) ? 1 : 0,
          front_tire_psi: row.front_tire_psi || 0,
          rear_tire_psi: row.rear_tire_psi || 0,
          other_note: row.other_note || '',

          battery_level: row.battery_pct || 0,
          battery_appearance_blank: (row.power_battery_issue & 1) ? 1 : 0,
          battery_low: (row.power_battery_issue & 2) ? 1 : 0,
          battery_no_display: ((row.power_battery_issue & 1) || (row.power_battery_issue & 4)) ? 1 : 0,
          ebike_no_power:       (row.assist_behavior & 1) ? 1 : 0,
          ebike_power_when_stopped: (row.assist_behavior & 2) ? 1 : 0,
          ebike_no_speed_sensor: (row.speed_issue & 1) ? 1 : 0,
          ebike_speed_display_issue: (row.speed_issue & 2) ? 1 : 0,
          ebike_speed_not_zero:  (row.speed_issue & 4) ? 1 : 0,
          power_note: row.power_note || '',
          
          photo_count: row.photo_count || 0,
          photo_url: row.photo_url || '',
          created_by: row.created_by || '',
          // 🌟 絕對關鍵 2：直接寫入原汁原味的 UTC 時間，不要做任何加減！
          // 讓前端與 Excel 在讀取時自己轉成台灣時間，就不會發生雙重相加的錯誤了！
          created_at: safeDate(row.created_at),
          updated_by: null,
          updated_at: null
        };

        try {
          await connection.query(`INSERT INTO copied_inspections SET ?`, [data]);
          successCount++;
        } catch (err) {
          errorCount++;
          console.error(`[防呆攔截] 略過異常資料 (原始ID: ${row.id}, 建立者: ${row.created_by})。原因: ${err.message}`);
        }
      }
      
      console.log(`[同步結果] 成功寫入 ${successCount} 筆，略過異常 ${errorCount} 筆`);
    }

    await connection.query(`
      UPDATE copied_inspections m
      LEFT JOIN users u ON m.created_by = u.emp_id
      LEFT JOIN front_roles fr ON u.front_role_id = fr.id
      SET m.front_role = IF(fr.name = '無角色' OR fr.name IS NULL, '', fr.name)
      WHERE m.report_month = ?
    `, [month]);

    await connection.commit();
    res.json({ success: true, message: `${month} 資料同步與解壓縮成功！` });
  } catch (error) {
    await connection.rollback();
    console.error('同步失敗:', error);
    res.status(500).json({ success: false, message: '資料同步失敗' });
  } finally {
    connection.release();
  }
});

// ============================================================================
// 🔒 3. 鎖定發布 
// ============================================================================
router.post('/publish', async (req, res) => {
  const { month } = req.body;
  try {
    await db.query(`UPDATE monthly_reports SET status = 'published' WHERE report_month = ?`, [month]);
    res.json({ success: true, message: `${month} 已成功發布` });
  } catch (error) {
    res.status(500).json({ success: false, message: '發布失敗' });
  }
});

module.exports = router;