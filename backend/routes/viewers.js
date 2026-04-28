const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/viewers - 取得已配置閱覽權限的人員列表
// 1. 取得閱覽權限人員清單 (需過濾單位)
router.get('/', async (req, res) => {
  let { unit_id, role_level, user_id } = req.query;

  try {
    // 1. 自動補完資訊 (這段你剛才已經跑通了，維持不變)
    if (!unit_id || !role_level) {
      const [uRows] = await db.query(`
        SELECT u.unit_id, br.role_level 
        FROM users u 
        INNER JOIN back_roles br ON u.back_role_id = br.id 
        WHERE u.id = ?
      `, [user_id]);

      if (uRows.length > 0) {
        unit_id = uRows[0].unit_id;
        role_level = uRows[0].role_level;
      }
    }

    console.log(`最終執行邏輯：單位=${unit_id}, 等級=${role_level}, 排除對象=${user_id}`);

    // 2. 主查詢邏輯
    let sql = `
      SELECT u.id, u.emp_id, u.name, un.name AS unit_name, fr.name AS front_role_name,
             GROUP_CONCAT(DISTINCT rg.name ORDER BY rg.id ASC SEPARATOR ', ') AS view_regions_name,
             GROUP_CONCAT(DISTINCT rg.id ORDER BY rg.id ASC SEPARATOR ',') AS view_regions_ids
      FROM users u
      LEFT JOIN units un ON u.unit_id = un.id
      LEFT JOIN front_roles fr ON u.front_role_id = fr.id
      -- 🌟 關鍵修正：補上 back_roles 的 JOIN，這樣才能抓到 role_level 進行過濾
      LEFT JOIN back_roles br ON u.back_role_id = br.id 
      JOIN user_view_regions uvr ON u.id = uvr.user_id 
      LEFT JOIN report_groups rg ON uvr.report_group_id = rg.id
      WHERE 1=1
    `;
    
    const queryParams = [];

    if (role_level < 99) { 
      // 單位隔離
      sql += ` AND u.unit_id = ? `;
      queryParams.push(unit_id);
      
      // 🌟 關鍵修正：改用 br.role_level，排除等級比自己高或同級的管理員
      sql += ` AND br.role_level < ? `;
      queryParams.push(role_level);

      // 排除自己
      if (user_id) {
        sql += ` AND u.id != ? `;
        queryParams.push(user_id);
      }
    }

    sql += ` GROUP BY u.id ORDER BY u.id DESC `;
    
    const [viewers] = await db.query(sql, queryParams);
    res.json({ success: true, data: viewers });

  } catch (error) {
    console.error("❌ 撈取閱覽清單發生 SQL 錯誤：", error); 
    res.status(500).json({ success: false, message: "資料載入失敗" });
  }
});


// POST /api/viewers - 新增人員閱覽權限
router.post('/', async (req, res) => {
  const { user_id, region_ids, operator_id } = req.body;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    // 批次寫入權限
    const values = region_ids.map(rid => [user_id, rid, operator_id]);
    await connection.query(
      'INSERT INTO user_view_regions (user_id, region_id, created_by) VALUES ?',
      [values]
    );
    await connection.commit();
    res.json({ success: true, message: "權限配置成功" });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ success: false, message: "配置失敗" });
  } finally { connection.release(); }
});

// PUT /api/viewers/:userId - 更新人員閱覽權限
router.put('/:userId', async (req, res) => {
  const { userId } = req.params;
  const { region_ids, operator_id } = req.body;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('DELETE FROM user_view_regions WHERE user_id = ?', [userId]);
    const values = region_ids.map(rid => [userId, rid, operator_id]);
    await connection.query(
      'INSERT INTO user_view_regions (user_id, region_id, created_by) VALUES ?',
      [values]
    );
    await connection.commit();
    res.json({ success: true, message: "更新成功" });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ success: false, message: "更新失敗" });
  } finally { connection.release(); }
});

module.exports = router;