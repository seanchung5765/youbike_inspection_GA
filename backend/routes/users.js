//人員權限管理的核心
const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/users - 取得人員管理列表
router.get('/', async (req, res) => {
  try {
    // 1. 接收前端傳來的分頁與搜尋參數
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const offset = (page - 1) * limit;

    // 2.  JOIN 語法底層
    let baseSql = `
      FROM users u
      LEFT JOIN units un ON u.unit_id = un.id
      JOIN back_roles br ON u.back_role_id = br.id
      LEFT JOIN front_roles fr ON u.front_role_id = fr.id
      LEFT JOIN user_view_regions uvr ON u.id = uvr.user_id
      LEFT JOIN report_groups rg ON uvr.report_group_id = rg.id
      WHERE 1=1
    `;
    const params = [];

    // 3. 如果前端有輸入搜尋關鍵字，動態加上模糊搜尋條件
    if (search) {
      baseSql += ` AND (u.emp_id LIKE ? OR u.name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    // 4. 先算「總筆數」 (給前端下方分頁器顯示 "共 X 條" 用的)
    const countSql = `SELECT COUNT(DISTINCT u.id) as total ` + baseSql;
    const [countResult] = await db.query(countSql, params);
    const total = countResult[0].total;

    // 5. 再撈「當頁資料」 
    //巧思 A：把 back_role_name 命名為 role_name，對應前端表格的 prop="role_name"
    //巧思 B：加上 IF 判斷，把 'ACTIVE' 轉成 1，讓前端的 Switch 開關看得懂
    const dataSql = `
      SELECT 
        u.id,
        u.emp_id,
        u.name,
        un.name AS unit_name,
        u.unit_id,         
        u.back_role_id,     
        u.front_role_id,    
        br.name AS role_name, 
        fr.name AS front_role_name,
        u.status,
        IF(u.status = 'ACTIVE', 1, 0) AS is_active,
        GROUP_CONCAT(DISTINCT rg.name SEPARATOR ', ') AS view_regions_name,
        GROUP_CONCAT(DISTINCT rg.id SEPARATOR ',') AS view_regions_ids
      ${baseSql}
      GROUP BY u.id
      ORDER BY u.emp_id ASC
      LIMIT ? OFFSET ?
    `;
    
    // 把分頁需要的 limit 和 offset 塞進陣列最後面
    params.push(limit, offset);

    const [users] = await db.query(dataSql, params);

    // 處理 Null 的情況 (你原本的邏輯保留)
    const formattedUsers = users.map(user => ({
      ...user,
      front_role_name: user.front_role_name || '無角色'
    }));

    // 6. 完整回傳 (包含 total 總筆數)
    res.json({ 
      success: true, 
      data: formattedUsers,
      total: total 
    });

  } catch (error) {
    console.error("撈取人員列表失敗:", error);
    res.status(500).json({ success: false, message: "伺服器錯誤" });
  }
});

//2. POST /api/users/permissions - 新增人員與權限 (給新增彈出視窗用)
router.post('/permissions', async (req, res) => {
  const { 
    emp_id, name, unit_id, back_role_id, view_regions, front_role_id, operator_id
  } = req.body;

  let connection; // 1. 先在 try 外面宣告變數 (不賦值)

  try {
    // 檢查員工是否已經存在
    const [existingUser] = await db.query('SELECT id FROM users WHERE emp_id = ?', [emp_id]);
    
    if (existingUser.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `員工 ${name} (${emp_id}) 已經有系統權限了，請使用列表的「編輯」功能！` 
      });
    }

    // 2. 從連線池中抓取一條專屬連線
    connection = await db.getConnection(); // 🌟 2. 這裡直接把值塞給外面的變數 (拿掉 const)
    
    await connection.beginTransaction();

    // --- 步驟 A：寫入主表 (users) ---
    const [userResult] = await connection.query(
      `INSERT INTO users (emp_id, name, unit_id, back_role_id, front_role_id, status, created_by) 
       VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)`, 
      [emp_id, name, unit_id, back_role_id, front_role_id, operator_id]
    );
    const newUserId = userResult.insertId;

    // --- 步驟 B：寫入閱覽地區關聯表 (user_view_regions) ---
    if (view_regions && view_regions.length > 0) {
      const regionValues = view_regions.map(group_id => [newUserId, group_id, operator_id]);
      await connection.query(
        `INSERT INTO user_view_regions (user_id, report_group_id, created_by) VALUES ?`,
        [regionValues]
      );
    }

    await connection.commit();
    res.json({ success: true, message: '權限新增成功！' });

  } catch (error) {
    //  3. 加保護傘：如果有建立連線，才執行退回
    if (connection) await connection.rollback(); 
    console.error('新增權限發生錯誤，已安全退回：', error);
    res.status(500).json({ success: false, message: '資料寫入失敗，請聯絡管理員' });
    
  } finally {
    //  4. 加保護傘：如果有建立連線，才執行釋放
    if (connection) connection.release(); 
  }
});

// DELETE /api/users/:id - 刪除人員
router.delete('/:id', async (req, res) => {
  const userId = req.params.id;

  try {
    //MySQL 的 CASCADE 會自動砍掉對應的 user_view_regions，因為我在SQL有設定關聯刪除
    const [result] = await db.query('DELETE FROM users WHERE id = ?', [userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '找不到該使用者' });
    }

    res.json({ success: true, message: '人員已成功刪除' });
  } catch (error) {
    console.error('刪除失敗:', error);
    res.status(500).json({ success: false, message: '刪除失敗，請確認資料庫狀態' });
  }
});


// PUT /api/users/:id - 編輯人員與權限
router.put('/:id', async (req, res) => {
  const userId = req.params.id;
  const { name, unit_id, back_role_id, front_role_id, view_regions, operator_id } = req.body;
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    //  步驟 A：更新主表 (記得帶上 updated_at)
    await connection.query(
      `UPDATE users SET 
        name = ?, unit_id = ?, back_role_id = ?, front_role_id = ?, 
        updated_by = ?, updated_at = NOW() 
       WHERE id = ?`,
      [name, unit_id, back_role_id, front_role_id, operator_id, userId]
    );

    // 步驟 B：處理地區 (先刪後增)
    await connection.query('DELETE FROM user_view_regions WHERE user_id = ?', [userId]);
    if (view_regions && view_regions.length > 0) {
      const regionValues = view_regions.map(group_id => [userId, group_id, operator_id]);
      await connection.query(
        'INSERT INTO user_view_regions (user_id, report_group_id, created_by) VALUES ?',
        [regionValues]
      );
    }

    await connection.commit();
    res.json({ success: true, message: '資料更新成功' });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ success: false, message: '更新失敗' });
  } finally {
    connection.release();
  }
});
module.exports = router;