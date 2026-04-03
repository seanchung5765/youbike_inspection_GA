require('dotenv').config(); 
const express = require('express');
const mysql = require('mysql2');
const ldap = require('ldapjs');
const cors = require('cors');
const cron = require('node-cron'); // 記得先 npm install node-cron

const app = express();
app.use(cors());
app.use(express.json());

// --- 1. 資料庫連線 ---
const db = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'youbike_db',
    waitForConnections: true,
    connectionLimit: 10
}).promise();

// --- 2. 核心同步邏輯 (將邏輯抽出來，供排程與手動共用) ---
const performFullSync = async () => {
    console.log(`[${new Date().toLocaleString()}] 🔄 開始執行 LDAP -> DB 全量同步...`);
    
    return new Promise((resolve, reject) => {
        const client = ldap.createClient({ url: process.env.LDAP_URL });
        const adminDN = process.env.LDAP_DN.includes('=') ? process.env.LDAP_DN : `uid=${process.env.LDAP_DN},cn=users,dc=YouBike,dc=tw`;

        client.bind(adminDN, process.env.LDAP_PASSWORD, (err) => {
            if (err) {
                client.destroy();
                return reject(new Error('LDAP Bind 失敗: ' + err.message));
            }

            const usersFound = [];
            // 搜尋所有 gecos 欄位有資料的人 (格式：工號_姓名)
            client.search("cn=users,dc=YouBike,dc=tw", { scope: "sub", filter: "(gecos=*)", attributes: ["gecos"] }, (err, resSearch) => {
                if (err) return reject(err);

                resSearch.on("searchEntry", (entry) => {
                    const gecos = entry.pojo.attributes.find(a => a.type === 'gecos');
                    if (gecos && gecos.values.length > 0) {
                        const [id, name] = gecos.values[0].split("_");
                        if (id && name) {
                            usersFound.push([id.toUpperCase(), name]);
                        }
                    }
                });

                resSearch.on("error", (err) => {
                    client.unbind();
                    reject(err);
                });

                resSearch.on("end", async () => {
                    client.unbind();
                    if (usersFound.length === 0) return resolve({ total: 0, added: 0 });

                    try {
                        // 使用 INSERT IGNORE：如果工號已存在則跳過，只新增 LDAP 裡的新人
                        const sql = "INSERT IGNORE INTO permission_settings (emp_id, emp_name) VALUES ?";
                        const [result] = await db.query(sql, [usersFound]);
                        resolve({ total: usersFound.length, added: result.affectedRows });
                    } catch (dbErr) {
                        reject(dbErr);
                    }
                });
            });
        });
    });
};

// --- 3. 【自動排程】每天凌晨 01:00 執行 ---
cron.schedule('0 1 * * *', async () => {
    try {
        const res = await performFullSync();
        console.log(`[自動排程] ✅ 同步成功：找到 ${res.total} 人，新增 ${res.added} 筆新進員工。`);
    } catch (err) {
        console.error(`[自動排程] ❌ 同步失敗:`, err.message);
    }
});

// --- 4. API 路由 ---

// 【手動更新】只要訪問這個 URL，就會立即觸發同步
app.get('/api/sync-all', async (req, res) => {
    try {
        const result = await performFullSync();
        res.json({
            success: true,
            message: "手動同步完成",
            total_in_ldap: result.total,
            newly_added: result.added
        });
        console.log(`[手動觸發] ✅ 同步成功：由 API 請求觸發。`);
    } catch (err) {
        console.error(`[手動觸發] ❌ 同步失敗:`, err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 查詢人員 (從已同步的 DB 抓取)
app.get('/api/users/:empId', async (req, res) => {
    const empId = req.params.empId.toUpperCase();
    try {
        const [dbRows] = await db.query('SELECT * FROM permission_settings WHERE emp_id = ?', [empId]);
        if (dbRows.length > 0) {
            res.json({ empId, name: dbRows[0].emp_name, savedData: dbRows[0] });
        } else {
            res.status(404).json({ error: "找不到此員工資料，請確認工號或嘗試手動同步。" });
        }
    } catch (err) {
        res.status(500).json({ error: "查詢失敗" });
    }
});

// 儲存權限設定
// index.js 建議確保這段 SQL 運作正常
// 後端範例邏輯
app.post('/api/permissions', async (req, res) => {
    const { empId, name, region, city, frontRole, backRole } = req.body;
    try {
        await db.query(`
            INSERT INTO permission_settings (emp_id, emp_name, org_region, org_city, front_role, back_role)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                org_region = VALUES(org_region),
                org_city = VALUES(org_city),
                front_role = VALUES(front_role),
                back_role = VALUES(back_role)
        `, [empId, name, region, city, frontRole, backRole]);
        
        res.json({ message: "更新成功" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// 取得所有已設定權限的人員 (用於前端下方表格)
// server.js 範例
app.get('/api/all-permissions', async (req, res) => {
    try {
        // 只篩選出 org_region 或 front_role 不是 NULL 且不是空字串的人
        const [rows] = await db.query(`
            SELECT * FROM permission_settings 
            WHERE (org_region IS NOT NULL AND org_region != '')
               OR (front_role IS NOT NULL AND front_role != '')
        `); 
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "無法取得清單", details: err.message });
    }
});

// --- 新增：供前端下拉選單查詢所有已同步的人員 ---
app.get('/api/all-sync-data', async (req, res) => {
    try {
        // 從資料庫撈出所有工號與姓名 (包含還沒設定權限的人)
        const [rows] = await db.query('SELECT emp_id, emp_name FROM permission_settings');
        res.json(rows);
    } catch (err) {
        console.error("抓取建議名單失敗:", err);
        res.status(500).json({ error: "無法取得建議名單" });
    }
});




// 刪除權限設定 (僅針對本地資料庫，不影響 LDAP)
app.delete('/api/permissions/:empId', async (req, res) => {
    const empId = req.params.empId.toUpperCase();
    try {
        // 方案 A：徹底從本地 DB 刪除 (這筆資料會從下方表格消失)
        const sql = "DELETE FROM permission_settings WHERE emp_id = ?";
        
        /* 方案 B (如果你想保留人在下拉選單，只是清空權限)：
        const sql = "UPDATE permission_settings SET org_region=NULL, org_city=NULL, front_role=NULL, back_role=NULL WHERE emp_id = ?";
        */

        const [result] = await db.query(sql, [empId]);
        
        if (result.affectedRows > 0) {
            res.json({ success: true, message: `工號 ${empId} 的權限已移除` });
        } else {
            res.status(404).json({ error: "資料庫中找不到此人員" });
        }
    } catch (err) {
        console.error("刪除失敗:", err);
        res.status(500).json({ error: "資料庫連線失敗" });
    }
});


const PORT = 3000;
app.listen(PORT, () => {
    console.log(`\n🚀 Server 啟動於 http://localhost:${PORT}`);
    console.log(`⏰ 已設定每日 01:00 自動同步`);
    console.log(`💡 手動同步網址：http://localhost:${PORT}/api/sync-all`);
});