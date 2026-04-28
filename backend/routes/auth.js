//處理登入驗證
const express = require('express');
const router = express.Router();
const db = require('../db'); 
const { authenticate } = require('ldap-authentication');

//POST GET 是 HTTP 協議中最常用的兩種請求方法
//GET 用於從伺服器「獲取」資料，POST 用於向伺服器「提交」資料(怕忘記
//  POST /api/login
router.post('/login', async (req, res) => {

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: "請輸入帳號與密碼" });
  }

  try {
    // 1. 向 YouBike LDAP 伺服器發起驗證
    const authenticatedUser = await authenticate({
      ldapOpts: { url: process.env.LDAP_URL },
      adminDn: process.env.LDAP_DN,
      adminPassword: process.env.LDAP_PASSWORD,
      userPassword: password,
      userSearchBase: process.env.LDAP_BASE_DN,
      usernameAttribute: process.env.LDAP_USER_ATTR,
      username: username
    });
    

    // 若沒有拋出錯誤，代表 LDAP 密碼驗證成功！
    console.log(`LDAP 驗證成功: ${username}`);

    // 2. 去我們的 MySQL 資料庫尋找這個人
    const [users] = await db.query('SELECT * FROM users WHERE emp_id = ?', [username]);
    let dbUser = users[0];

    // 3. 【核心邏輯】判斷是否為初始最高管理員
    if (username === process.env.INITIAL_ADMIN_ID) {
      if (!dbUser) {
        // 如果 GB1234 第一次登入，資料庫還沒這個人，系統自動幫他建檔！
        // 💡 修正：幕僚 unit_id = 5 ，高階管理員 back_role_id = 1 
        const insertSql = `
          INSERT INTO users (emp_id, name, unit_id, back_role_id, status) 
          VALUES (?, ?, 5, 1, 'ACTIVE')
        `;
        // 名字先抓 LDAP 回傳的屬性 (如 displayName)，抓不到就先用工號
        const displayName = authenticatedUser.displayName || authenticatedUser.cn || username;
        await db.query(insertSql, [username, displayName]);
        
        // 重新撈取剛剛建立的資料
        const [newUsers] = await db.query('SELECT * FROM users WHERE emp_id = ?', [username]);
        dbUser = newUsers[0];
        console.log(`已自動將 ${username} 初始化為高階管理員 (back_role_id: 1)`);
        
      } else if (dbUser.back_role_id !== 1) {
        // 如果他已經在資料庫，但權限不是最高 (1)，強制升級！
        await db.query('UPDATE users SET back_role_id = ? WHERE emp_id = ?', [1, username]);
        dbUser.back_role_id = 1;
        console.log(`已強制將 ${username} 升級為高階管理員`);
      }

    }

    // 4. 權限攔截：如果驗證成功，但資料庫裡沒有這個人
    if (!dbUser) {
      return res.status(403).json({ 
        success: false, 
        message: "LDAP 驗證成功，但您尚未被配置系統權限，請聯絡管理員。" 
      });
    }

    // 5. 狀態攔截：如果被停權
    if (dbUser.status === 'INACTIVE') {
      return res.status(403).json({ success: false, message: "此帳號已被停權" });
    }

    // 6. 更新最後登入時間
    //直接讓 MySQL 產生時間，不再從 Node.js 帶入
await db.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [dbUser.id]);
    
    // 7. 放行！回傳使用者資料給 Vue 前端
    return res.json({
      success: true,
      message: "登入成功",
      user: {
        id: dbUser.id,
        emp_id: dbUser.emp_id,
        name: dbUser.name,
        role: dbUser.back_role_id // 將資料庫真實的 role 傳給前端
      }
    });

  } catch (error) {
    console.error("LDAP 登入失敗:", error.message);
    // LDAP 套件在密碼錯誤或找不到人時會拋出 Error
    return res.status(401).json({ 
      success: false, 
      message: "帳號或密碼錯誤 (或無法連線至 LDAP 伺服器)" 
    });
  }

});

module.exports = router; // 把這個路由模組匯出