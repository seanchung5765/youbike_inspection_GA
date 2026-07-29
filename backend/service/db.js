//backend/service/db.js
// DB連線池設定。
const mysql = require('mysql2/promise');
require('dotenv').config();

// 1. 先建立基本的連線設定 (不要把 host 寫死在這裡)
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

// 2. 🌟 智慧判斷連線模式
// 如果環境變數 DB_HOST 存在，且開頭是 /cloudsql/，代表正在 GCP 雲端環境
if (process.env.DB_HOST && process.env.DB_HOST.startsWith('/cloudsql/')) {
  dbConfig.socketPath = process.env.DB_HOST; 
} else {
  // 否則，就是在本機開發環境 (或是走傳統 IP 連線)
  dbConfig.host = process.env.DB_HOST || '127.0.0.1';
  // 順便補上 Port 號防呆，預設 3306
  dbConfig.port = process.env.DB_PORT || 3306; 
}

// 3. 建立連線池
const pool = mysql.createPool(dbConfig);

// 🌟 修正了這裡的全形分號
module.exports = pool;