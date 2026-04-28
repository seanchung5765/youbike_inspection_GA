//去資料庫撈取左側選單的選項
const express = require('express');
const router = express.Router();
const db = require('../db'); // 確保有正確引入你的資料庫連線設定

// 🚀 GET /api/menus
// 目的：根據前端傳來的 roleId，回傳該角色有權限看見的選單
router.get('/', async (req, res) => {
  try {
    // 1. 從網址參數 (?roleId=xxx) 取得角色 ID
    const roleId = req.query.roleId;

    // 如果前端忘記傳 roleId，就擋下來
    if (!roleId) {
      return res.status(400).json({ 
        success: false, 
        message: "缺少 roleId 參數，無法取得選單" 
      });
    }

    // 2. 撰寫 SQL 語法 (核心邏輯：將選單表與權限表交集)
    // 我們只撈出啟用的選單 (is_active = TRUE) 並且按照 sort_order 排序
    const sql = `
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

    // 3. 執行 SQL 查詢
    const [menus] = await db.query(sql, [roleId]);

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