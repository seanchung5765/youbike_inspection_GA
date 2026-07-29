//backend/routes/ldap.js
//這個不是拿來做登入，是拿來做查詢工號時，自動帶入用的
const express = require('express');
const router = express.Router();
const ldap = require('ldapjs');
require('dotenv').config();

//  GET /api/ldap/search?q=關鍵字
router.get('/search', async (req, res) => {
  const keyword = req.query.q;
  
  if (!keyword) {
    return res.json({ success: true, data: [] });
  }

  // 1. 建立 LDAP 客戶端
  const client = ldap.createClient({
    url: process.env.LDAP_URL
  });

  try {
    // 2. 登入 (Bind) LDAP 伺服器
    await new Promise((resolve, reject) => {
      client.bind(process.env.LDAP_DN, process.env.LDAP_PASSWORD, (err) => {
        if (err) {
          console.error('LDAP Bind 失敗:', err);
          return reject(new Error('無法連線到 LDAP 伺服器'));
        }
        resolve();
      });
    });

    // 3. 設定搜尋條件
    // 這裡的過濾器意思是：(uid 包含關鍵字) 或是 (cn(姓名) 包含關鍵字)
    const searchOptions = {
      filter: `(|(${process.env.LDAP_USER_ATTR}=*${keyword}*)(cn=*${keyword}*))`,
      scope: 'sub',
      // 設定你想抓出來的欄位 (可以依據你們公司的 LDAP 屬性增減)
      attributes: ['uid', 'cn', 'departmentNumber', 'mail'] 
    };

    // 4. 執行搜尋
    const results = await new Promise((resolve, reject) => {
      const users = [];

      client.search(process.env.LDAP_BASE_DN, searchOptions, (err, searchRes) => {
        if (err) return reject(err);

        // 監聽每一個抓到的資料
        searchRes.on('searchEntry', (entry) => {
          // 🌟 新版 ldapjs 的拆包裹寫法
          const userObj = {};
          
          // 將 LDAP 給的屬性陣列 (attributes)，轉換成我們好讀的物件格式
          if (entry.attributes) {
            entry.attributes.forEach(attr => {
              // attr.type 是欄位名 (例如 'uid', 'cn')
              // attr.values 是一個陣列，我們通常取第一個值
              userObj[attr.type] = attr.values ? attr.values[0] : '';
            });
          }

          // 確認成功拆完包裹後，再組裝成前端需要的格式
          // (加上 || '' 是為了防呆，就算 LDAP 真的沒填這個欄位也不會報錯)
          users.push({
            emp_id: userObj[process.env.LDAP_USER_ATTR] || userObj.uid || '',
            name: userObj.cn || '未知姓名',
            department: userObj.departmentNumber || '未提供單位',
            email: userObj.mail || ''
          });
        });

        // 搜尋發生錯誤
        searchRes.on('error', (err) => {
          console.error('LDAP 搜尋過程發生錯誤:', err);
          reject(err);
        });

        // 搜尋結束
        searchRes.on('end', () => {
          resolve(users);
        });
      });
    });

    // 5. 搜尋完畢，解除連線並回傳給前端
    client.unbind();
    res.json({
      success: true,
      data: results
    });

  } catch (error) {
    console.error("LDAP 處理失敗:", error);
    // 確保發生錯誤時也會斷開連線
    client.unbind((err) => {}); 
    res.status(500).json({ success: false, message: error.message || "LDAP 伺服器錯誤" });
  }
});

module.exports = router;