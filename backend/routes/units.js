//backend/routes/units.js
//取得單位權限列表
const express = require('express');
const router = express.Router();
const db = require('../service/db');

// GET /api/units - 取得單位權限列表
router.get('/', async (req, res) => {
  try {
    // 這裡我們把 units 單位表，去 JOIN unit_allowed_regions 關聯表，再 JOIN regions 地區表
    const sql = `
      SELECT 
        u.id,
        u.name AS unit_name,
        u.status,
        -- 🌟 關鍵在這裡：加入 ORDER BY rg.id ASC，確保名字照順序排
        GROUP_CONCAT(DISTINCT rg.name ORDER BY rg.id ASC SEPARATOR ', ') AS allowed_regions_name,
        -- 🌟 這裡也同步加上排序，確保編輯反填時陣列順序也是對的
        GROUP_CONCAT(DISTINCT rg.id ORDER BY rg.id ASC SEPARATOR ',') AS allowed_regions_ids
      FROM units u
      LEFT JOIN unit_allowed_regions uar ON u.id = uar.unit_id
      LEFT JOIN report_groups rg ON uar.region_id = rg.id 
      GROUP BY u.id
      ORDER BY u.id ASC
    `;

    const [units] = await db.query(sql);

    res.json({
      success: true,
      data: units
    });

  } catch (error) {
    console.error("撈取單位列表失敗:", error);
    res.status(500).json({ success: false, message: "伺服器錯誤" });
  }
});

// PUT /api/units/:unitId/regions - 差異更新單位的地區權限
router.put('/:unitId/regions', async (req, res) => {
  const { unitId } = req.params;
  // 🌟 1. 這裡一定要把 name 接進來！
  const { name, region_ids, operator_id } = req.body; 
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // 任務 A：更新單位主表的名稱 
    if (name) {
      await connection.query(
        'UPDATE units SET name = ?, updated_by = ?, updated_at = NOW() WHERE id = ?',
        [name, operator_id, unitId]
      );
    }

    // 🌟 任務 B：更新地區權限
    const [existingRows] = await connection.query(
      'SELECT region_id FROM unit_allowed_regions WHERE unit_id = ?',
      [unitId]
    );
    const existingIds = existingRows.map(r => r.region_id);

    const currentRegionIds = region_ids || [];

    const toDelete = existingIds.filter(id => !currentRegionIds.includes(id));
    const toAdd = currentRegionIds.filter(id => !existingIds.includes(id));

    if (toDelete.length > 0) {
      await connection.query(
        'DELETE FROM unit_allowed_regions WHERE unit_id = ? AND region_id IN (?)',
        [unitId, toDelete]
      );
    }

    if (toAdd.length > 0) {
      const values = toAdd.map(rid => [unitId, rid, operator_id]);
      await connection.query(
        'INSERT INTO unit_allowed_regions (unit_id, region_id, created_by) VALUES ?',
        [values]
      );
    }

    await connection.commit();
    res.json({ success: true, message: '單位與權限更新成功' });

  } catch (error) {
    await connection.rollback();
    console.error("更新單位權限失敗:", error);
    res.status(500).json({ success: false, message: "更新失敗" });
  } finally {
    connection.release();
  }
});

// POST /api/units - 新增單位與地區權限
router.post('/', async (req, res) => {
  // 🌟 1. 這裡把 unit_name 改成跟前台一樣的 name
  const { name, region_ids, operator_id } = req.body;
  const connection = await db.getConnection();

  try {
    // 防呆：檢查名稱是否重複
    const [exist] = await connection.query('SELECT id FROM units WHERE name = ?', [name]);
    if (exist.length > 0) {
      return res.status(400).json({ success: false, message: '該單位名稱已存在' });
    }

    await connection.beginTransaction();

    // 2. 寫入單位主表
    const [unitResult] = await connection.query(
      'INSERT INTO units (name, status, created_by) VALUES (?, "ACTIVE", ?)',
      [name, operator_id]
    );
    const newUnitId = unitResult.insertId;

    // 3. 寫入地區權限
    if (region_ids && region_ids.length > 0) {
      const values = region_ids.map(rid => [newUnitId, rid, operator_id]);
      await connection.query(
        'INSERT INTO unit_allowed_regions (unit_id, region_id, created_by) VALUES ?',
        [values]
      );
    }

    await connection.commit();
    res.json({ success: true, message: '單位新增成功' });

  } catch (error) {
    await connection.rollback();
    // 把錯誤印在後端終端機，以後除錯一秒鐘搞定！
    console.error("❌ 新增單位失敗：", error);
    res.status(500).json({ success: false, message: '伺服器錯誤' });
  } finally {
    connection.release();
  }
});

// DELETE /api/units/:id - 刪除單位
router.delete('/:id', async (req, res) => {
  const unitId = req.params.id;

  try {
    // MySQL 刪除指令 (如果 unit_allowed_regions 有設 ON DELETE CASCADE 會自動連動刪除)
    const [result] = await db.query('DELETE FROM units WHERE id = ?', [unitId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '找不到該單位' });
    }

    res.json({ success: true, message: '單位已成功刪除' });

  } catch (error) {
    console.error('刪除單位失敗:', error);
    
    // 如果是因為資料庫關聯 (例如此單位底下還有綁定 users) 而報錯
    if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.errno === 1451) {
      return res.status(400).json({ 
        success: false, 
        message: '無法刪除！此單位底下還有綁定人員或相關資料。請先轉移人員後再試一次。' 
      });
    }

    res.status(500).json({ success: false, message: '刪除失敗，請確認資料庫狀態' });
  }
});

// GET /api/units/:unitId/allowed-regions - 取得該單位「可分配」的地區清單
router.get('/:unitId/allowed-regions', async (req, res) => {
  const { unitId } = req.params;
  try {
    const sql = `
      SELECT rg.id, rg.name 
      FROM unit_allowed_regions uar
      JOIN report_groups rg ON uar.region_id = rg.id
      WHERE uar.unit_id = ?
    `;
    const [allowedRegions] = await db.query(sql, [unitId]);
    res.json({ success: true, data: allowedRegions });
  } catch (error) {
    res.status(500).json({ success: false, message: "撈取授權地區失敗" });
  }
});

module.exports = router;