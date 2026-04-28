//負責在人員管理顯示所有權限
const express = require('express');
const router = express.Router();
const db = require('../db'); 

// GET /api/system/options
// 目的：一次撈取所有下拉選單的選項
router.get('/options', async (req, res) => {
  try {
    // 同時執行四個查詢，把字典表的資料全部撈出來
    const [units] = await db.query('SELECT id, name FROM units ORDER BY id ASC');
    const [regions] = await db.query(`SELECT id, name FROM report_groups WHERE status = 'ACTIVE' ORDER BY id ASC`);
    const [frontRoles] = await db.query('SELECT id, name FROM front_roles ORDER BY id ASC');
    const [backRoles] = await db.query('SELECT id, name FROM back_roles ORDER BY id ASC');

    // 打包回傳
    res.json({
      success: true,
      data: {
        units,
        regions,
        frontRoles,
        backRoles
      }
    });
  } catch (error) {
    console.error('獲取系統選項失敗:', error);
    res.status(500).json({ success: false, message: '伺服器發生錯誤' });
  }
});

module.exports = router;