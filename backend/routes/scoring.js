//backend/routes/scoring.js
const express = require('express');
const router = express.Router();
const db = require('../service/db');

// ============================================================================
// 1. 取得所有計分規則
// ============================================================================
router.get('/rules', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT * FROM scoring_rules 
      ORDER BY 
        major_category COLLATE utf8mb4_unicode_ci, 
        sub_category COLLATE utf8mb4_unicode_ci, 
        item_key COLLATE utf8mb4_unicode_ci
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('取得規則失敗:', error);
    res.status(500).json({ success: false, message: '取得計分規則失敗' });
  }
});

// ============================================================================
// 2. 批次儲存更新的規則
// ============================================================================
router.put('/rules/batch', async (req, res) => {
  const { rules } = req.body;
  if (!Array.isArray(rules)) return res.status(400).json({ success: false });

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    for (const rule of rules) {
      // 🌟 修正：在 SQL 的 SET 中加入 merge_group = ?，並在下方陣列傳入對應數值
      await connection.query(`
        UPDATE scoring_rules 
        SET bike_type = ?, 
            major_category = ?, 
            sub_category = ?, 
            item_name = ?, 
            severity = ?, 
            deduction_points = ?,
            merge_group = ?
        WHERE id = ?
      `, [
        rule.bike_type, 
        rule.major_category, 
        rule.sub_category, 
        rule.item_name, 
        rule.severity, 
        rule.deduction_points, 
        rule.merge_group, // 🌟 這裡要對齊傳入值
        rule.id
      ]);
    }
    await connection.commit();
    res.json({ success: true, message: '規則已全部更新！' });
  } catch (error) {
    await connection.rollback();
    console.error('更新規則失敗:', error);
    res.status(500).json({ success: false, message: '更新失敗' });
  } finally {
    connection.release();
  }
});

// ============================================================================
// 3. 自動同步新欄位 (將 copied_inspections 的扣分开關抓進來)
// ============================================================================
router.post('/rules/sync-columns', async (req, res) => {
  try {
    const [columns] = await db.query(`SHOW COLUMNS FROM copied_inspections`);
    
    // 🛡️ 白名單：絕對不要列入計分的「基礎欄位」
    const ignoreCols = [
      'id', 'report_month', 'created_by', 'checker', 'first_level_checker', 'created_at', 'check_date', 
      'model', 'city', 'station_name', 'station_id', 'bike_no', 'dock_no', 'battery_level', 
      'front_tire_psi', 'rear_tire_psi', 'photo_count', 'photo_url', 'front_role', 
      'station_note', 'dock_note', 'appearance_note', 'structure_note', 'other_note',
      'bikes_in_dock_count', 'reversed_saddle_count', 'inactive_bike_count'
    ];

    const targetCols = columns.map(c => c.Field).filter(col => !ignoreCols.includes(col));

    const [existingRules] = await db.query(`SELECT item_key FROM scoring_rules`);
    const existingKeys = existingRules.map(r => r.item_key);

    let addedCount = 0;
    for (const col of targetCols) {
      if (!existingKeys.includes(col)) {
        await db.query(`
          INSERT INTO scoring_rules (item_key, item_name, bike_type, deduction_points) 
          VALUES (?, ?, 'ALL', 0)
        `, [col, col]); // 預設名稱先放英文 key，使用者再去介面修改
        addedCount++;
      }
    }

    res.json({ success: true, message: `自動同步完成！新增了 ${addedCount} 個待設定的欄位。` });
  } catch (error) {
    console.error('同步欄位失敗:', error);
    res.status(500).json({ success: false, message: '同步欄位失敗' });
  }
});

module.exports = router;