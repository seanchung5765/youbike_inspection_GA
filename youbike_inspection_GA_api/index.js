require("dotenv").config();

const express = require("express");
const mysql = require("mysql2");
const ldap = require("ldapjs");
const cors = require("cors");
const cron = require("node-cron");
const session = require("express-session");
const { authenticateWithLdap } = require("./services/ldapservice");

const app = express();

// =========================
// 1. 中間件設定
// =========================
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || "youbike_dev_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // 本機開發先 false，正式環境改 true
      maxAge: 1000 * 60 * 60 * 8, // 8 小時
    },
  })
);

// =========================
// 2. 資料庫連線
// =========================
const db = mysql
  .createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "",
    database: process.env.DB_NAME || "youbike_db",
    waitForConnections: true,
    connectionLimit: 10,
  })
  .promise();

// =========================
// 3. LDAP -> DB 全量同步
// =========================
const performFullSync = async () => {
  console.log(`[${new Date().toLocaleString()}] 🔄 開始執行 LDAP -> DB 全量同步...`);

  return new Promise((resolve, reject) => {
    const client = ldap.createClient({ url: process.env.LDAP_URL });

    const adminDN = process.env.LDAP_DN.includes("=")
      ? process.env.LDAP_DN
      : `uid=${process.env.LDAP_DN},cn=users,dc=YouBike,dc=tw`;

    client.bind(adminDN, process.env.LDAP_PASSWORD, (err) => {
      if (err) {
        client.destroy();
        return reject(new Error("LDAP Bind 失敗: " + err.message));
      }

      const usersFound = [];

      client.search(
        "cn=users,dc=YouBike,dc=tw",
        {
          scope: "sub",
          filter: "(gecos=*)",
          attributes: ["gecos"],
        },
        (err, resSearch) => {
          if (err) {
            client.destroy();
            return reject(err);
          }

          resSearch.on("searchEntry", (entry) => {
            try {
              const gecos = entry.pojo.attributes.find((a) => a.type === "gecos");
              if (gecos && gecos.values.length > 0) {
                const [id, name] = gecos.values[0].split("_");
                if (id && name) {
                  usersFound.push([id.toUpperCase(), name]);
                }
              }
            } catch (parseErr) {
              console.error("解析 LDAP 使用者資料失敗:", parseErr);
            }
          });

          resSearch.on("error", (searchErr) => {
            client.unbind();
            reject(searchErr);
          });

          resSearch.on("end", async () => {
            client.unbind();

            if (usersFound.length === 0) {
              return resolve({ total: 0, added: 0 });
            }

            try {
              const sql =
                "INSERT IGNORE INTO permission_settings (emp_id, emp_name) VALUES ?";
              const [result] = await db.query(sql, [usersFound]);
              resolve({ total: usersFound.length, added: result.affectedRows });
            } catch (dbErr) {
              reject(dbErr);
            }
          });
        }
      );
    });
  });
};

// =========================
// 4. 登入 API
// =========================
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "請輸入帳號與密碼",
      });
    }

    const empId = String(username).trim().toUpperCase();

    // 先 LDAP 驗證
    const ldapUser = await authenticateWithLdap(empId, password);

    if (!ldapUser) {
      return res.status(401).json({
        success: false,
        message: "帳號或密碼錯誤",
      });
    }

    // LDAP 通過後，再查 DB 權限
    const [rows] = await db.query(
      `
      SELECT emp_id, emp_name, back_role, front_role, org_region, org_city
      FROM permission_settings
      WHERE emp_id = ?
      `,
      [empId]
    );

    if (rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: "無權限",
      });
    }

    const dbUser = rows[0];

    // 建立 session
    req.session.user = {
      username: dbUser.emp_id,
      cn: dbUser.emp_name || ldapUser.cn || empId,
      role: dbUser.back_role || "VIEWER",
      frontRole: dbUser.front_role || "",
      region: dbUser.org_region || "",
      city: dbUser.org_city || "",
    };

    return res.json({
      success: true,
      user: req.session.user,
    });
  } catch (err) {
    console.error("❌ /api/login 錯誤:", err);
    return res.status(500).json({
      success: false,
      message: "伺服器錯誤",
      error: err.message,
    });
  }
});

// =========================
// 5. 取得目前登入者資訊
// =========================
app.get("/api/me", (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        message: "尚未登入",
      });
    }

    return res.json({
      success: true,
      user: req.session.user,
    });
  } catch (err) {
    console.error("❌ /api/me 錯誤:", err);
    return res.status(500).json({
      success: false,
      message: "無法取得使用者資訊",
    });
  }
});

// =========================
// 6. 登出
// =========================
app.post("/api/logout", (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.error("❌ /api/logout 錯誤:", err);
        return res.status(500).json({
          success: false,
          message: "登出失敗",
        });
      }

      res.clearCookie("connect.sid");
      return res.json({
        success: true,
        message: "已登出",
      });
    });
  } catch (err) {
    console.error("❌ /api/logout 錯誤:", err);
    return res.status(500).json({
      success: false,
      message: "登出失敗",
    });
  }
});

// =========================
// 7. 同步排程與其他 API
// =========================
cron.schedule("0 1 * * *", async () => {
  try {
    const result = await performFullSync();
    console.log(`[自動排程] ✅ 同步成功：找到 ${result.total} 人，新增 ${result.added} 人`);
  } catch (err) {
    console.error("[自動排程] ❌ 失敗:", err.message);
  }
});

app.get("/api/sync-all", async (req, res) => {
  try {
    const result = await performFullSync();
    res.json({
      success: true,
      total_in_ldap: result.total,
      newly_added: result.added,
    });
  } catch (err) {
    console.error("❌ /api/sync-all 錯誤:", err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

app.get("/api/users/:empId", async (req, res) => {
  try {
    const empId = String(req.params.empId).trim().toUpperCase();

    const [dbRows] = await db.query(
      "SELECT * FROM permission_settings WHERE emp_id = ?",
      [empId]
    );

    if (dbRows.length > 0) {
      return res.json({
        success: true,
        empId,
        name: dbRows[0].emp_name,
        savedData: dbRows[0],
      });
    }

    return res.status(404).json({
      success: false,
      message: "找不到資料",
    });
  } catch (err) {
    console.error("❌ /api/users/:empId 錯誤:", err);
    return res.status(500).json({
      success: false,
      message: "查詢失敗",
    });
  }
});

app.post("/api/permissions", async (req, res) => {
  try {
    const { empId, name, region, city, frontRole, backRole } = req.body;

    if (!empId || !name) {
      return res.status(400).json({
        success: false,
        message: "empId 與 name 為必填",
      });
    }

    await db.query(
      `
      INSERT INTO permission_settings
      (emp_id, emp_name, org_region, org_city, front_role, back_role)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        emp_name = VALUES(emp_name),
        org_region = VALUES(org_region),
        org_city = VALUES(org_city),
        front_role = VALUES(front_role),
        back_role = VALUES(back_role)
      `,
      [
        String(empId).trim().toUpperCase(),
        name,
        region || "",
        city || "",
        frontRole || "",
        backRole || "",
      ]
    );

    return res.json({
      success: true,
      message: "更新成功",
    });
  } catch (err) {
    console.error("❌ /api/permissions 錯誤:", err);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

app.get("/api/all-permissions", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT * FROM permission_settings
      WHERE (org_region != "") OR (front_role != "") OR (back_role != "")
    `);

    return res.json({
      success: true,
      rows,
    });
  } catch (err) {
    console.error("❌ /api/all-permissions 錯誤:", err);
    return res.status(500).json({
      success: false,
      message: "無法取得清單",
    });
  }
});

app.delete("/api/permissions/:empId", async (req, res) => {
  try {
    const empId = String(req.params.empId).trim().toUpperCase();

    await db.query("DELETE FROM permission_settings WHERE emp_id = ?", [empId]);

    return res.json({
      success: true,
      message: `工號 ${empId} 的權限已移除`,
    });
  } catch (err) {
    console.error("❌ /api/permissions/:empId 錯誤:", err);
    return res.status(500).json({
      success: false,
      message: "刪除失敗",
    });
  }
});

// =========================
// 8. 啟動伺服器
// =========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server 啟動於 http://localhost:${PORT}`);
});