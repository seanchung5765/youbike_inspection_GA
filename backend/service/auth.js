//backend/service/auth.js
const express = require('express');
const router = express.Router();
const db = require('./db'); 
const { authenticate } = require('ldap-authentication');

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: "請輸入帳號與密碼" });
  }

  try {
    const authenticatedUser = await authenticate({
      ldapOpts: { url: process.env.LDAP_URL },
      adminDn: process.env.LDAP_DN,
      adminPassword: process.env.LDAP_PASSWORD,
      userPassword: password,
      userSearchBase: process.env.LDAP_BASE_DN,
      usernameAttribute: process.env.LDAP_USER_ATTR,
      username: username
    });
    
    console.log(`LDAP 驗證成功: ${username}`);

    // 🌟 修正：JOIN back_roles 把 role_level 抓出來
    const [users] = await db.query(`
      SELECT u.*, br.role_level 
      FROM users u 
      LEFT JOIN back_roles br ON u.back_role_id = br.id 
      WHERE u.emp_id = ?
    `, [username]);
    let dbUser = users[0];

    if (username === process.env.INITIAL_ADMIN_ID) {
      if (!dbUser) {
        const insertSql = `
          INSERT INTO users (emp_id, name, unit_id, back_role_id, status) 
          VALUES (?, ?, 5, 1, 'ACTIVE')
        `;
        const displayName = authenticatedUser.displayName || authenticatedUser.cn || username;
        await db.query(insertSql, [username, displayName]);
        
        const [newUsers] = await db.query(`
          SELECT u.*, br.role_level 
          FROM users u 
          LEFT JOIN back_roles br ON u.back_role_id = br.id 
          WHERE u.emp_id = ?
        `, [username]);
        dbUser = newUsers[0];
        console.log(`已自動將 ${username} 初始化為高階管理員`);
      } else if (dbUser.back_role_id !== 1) {
        await db.query('UPDATE users SET back_role_id = ? WHERE emp_id = ?', [1, username]);
        dbUser.back_role_id = 1;
        dbUser.role_level = 99; // 手動補上最高等級
        console.log(`已強制將 ${username} 升級為高階管理員`);
      }
    }

    if (!dbUser) {
      return res.status(403).json({ success: false, message: "尚未被配置系統權限，請聯絡管理員。" });
    }
    if (dbUser.status === 'INACTIVE') {
      return res.status(403).json({ success: false, message: "此帳號已被停權" });
    }

    await db.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [dbUser.id]);
    
    // 🌟 修正：把 unit_id 跟 role_level 都回傳給前端！
    return res.json({
      success: true,
      message: "登入成功",
      user: {
        id: dbUser.id,
        emp_id: dbUser.emp_id,
        name: dbUser.name,
        role: dbUser.back_role_id,
        role_level: dbUser.role_level,
        unit_id: dbUser.unit_id
      }
    });

  } catch (error) {
    console.error("LDAP 登入失敗:", error.message);
    return res.status(401).json({ success: false, message: "帳號或密碼錯誤" });
  }
});

module.exports = router;