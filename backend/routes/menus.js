//backend/routes/menus.js
const express = require('express');
const router = express.Router();
const db = require('../service/db'); // 確保有正確引入你的資料庫連線設定
require('dotenv').config(); // 確保能讀取到 .env 檔案

// 目的：根據前端傳來的 roleId 與 emp_id，回傳該角色有權限看見的選單
router.get('/', async (req, res) => {
  try {
    // 1. 從網址參數取得角色 ID 與 員工編號
    const roleId = req.query.roleId;
    const empId = req.query.emp_id; // 🌟 接收前端傳來的 emp_id

    // 從環境變數讀取開發者工號 (上帝模式)
    const superAdminId = process.env.INITIAL_ADMIN_ID;

    let sql = '';
    let params = [];

    // 🌟 2. 判斷邏輯：上帝模式 vs 凡人模式
    if (empId && empId === superAdminId) {
      console.log(`🚀 上帝模式啟動：開發者 ${empId} 登入，開放全選單`);
      // 上帝模式：無視權限表，直接撈出整張系統選單表
      sql = `
        SELECT 
          id, 
          parent_id, 
          name, 
          route_code, 
          icon_code
        FROM system_menus
        ORDER BY parent_id ASC, sort_order ASC
      `;
    } else {
      // 凡人模式：如果前端忘記傳 roleId，就擋下來
      if (!roleId) {
        return res.status(400).json({ 
          success: false, 
          message: "缺少 roleId 參數，無法取得選單" 
        });
      }

      // 凡人模式邏輯：將選單表與權限表交集 (保留你原本寫好的完美邏輯)
      sql = `
        SELECT 
          m.id, 
          m.parent_id, 
          m.name, 
          m.route_code, 
          m.icon_code
        FROM system_menus m
        JOIN role_menu_permissions p ON m.id = p.menu_id
        WHERE p.role_id = ? 
        ORDER BY m.parent_id ASC, m.sort_order ASC
      `;
      params = [roleId];
    }

    // 3. 執行 SQL 查詢
    const [menus] = await db.query(sql, params);

    // 4. 回傳成功結果給前端
    res.json({
      success: true,
      message: "取得選單成功",
      data: menus // 這裡裝著從資料庫撈出來的陣列
    });

  } catch (error) {
    console.error("取得選單失敗:", error);
    res.status(500).json({ 
      success: false, 
      message: "伺服器發生錯誤，無法取得選單" 
    });
  }
});

module.exports = router;