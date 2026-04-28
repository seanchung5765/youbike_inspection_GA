//啟動 Node.js 伺服器的入口點，把上面的路由通通組合起來。
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// --- 1. 基礎設定 (必須放在最前面) ---
app.use(cors());
app.use(express.json()); // 🌟 確保這行在所有路由之前
app.use(express.urlencoded({ extended: true }));


// --- 2. 測試 API ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '後端伺服器運作中！' });
});

// --- 3. 路由分配 (注意這裡的寫法) ---
// 這裡我們直接 require 進來使用
const authRoutes = require('./routes/auth');
const menuRoutes = require('./routes/menus');
const userRoutes = require('./routes/users');
const unitRoutes = require('./routes/units');
const viewerRoutes = require('./routes/viewers');

app.use('/api', authRoutes);      // 登入 API 
app.use('/api/menus', menuRoutes); // 選單 API
app.use('/api/users', userRoutes); // 人員管理 API
app.use('/api/ldap', require('./routes/ldap'));// 人員查詢API
app.use('/api/system', require('./routes/system'));// 系統選項API
app.use('/api/units', unitRoutes); //  單位權限路徑
app.use('/api/viewers', viewerRoutes);//  閱覽權限路徑

// --- 4. 啟動伺服器 ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 後端 API 已啟動：http://localhost:${PORT}`);
});