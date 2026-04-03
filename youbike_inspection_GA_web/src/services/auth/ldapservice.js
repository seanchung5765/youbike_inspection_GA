import { Client } from "ldapts";
import "dotenv/config";

export async function authenticateWithLdap(username, password) {
  const {
    LDAP_URL,
    LDAP_DN,
    LDAP_PASSWORD,
    LDAP_BASE_DN,
    LDAP_USER_ATTR = "uid",
  } = process.env;

  // 每次呼叫建立新 Client 是正確的，因為你最後有 unbind
  const client = new Client({ url: LDAP_URL });

  try {
    // 1. 管理員登入 (Bind)
    try {
      await client.bind(LDAP_DN, LDAP_PASSWORD);
    } catch (bindError) {
      console.error("LDAP Admin Bind Error:", bindError.message);
      throw new Error("LDAP_ADMIN_BIND_FAILED");
    }

    // 2. 防止 LDAP Injection 的過濾器轉義
    // ldapts 雖然有處理，但手動確保安全更佳
    const safeUsername = username.replace(/[\\*() \x00]/g, (char) => `\\${char.charCodeAt(0).toString(16)}`);
    const filter = `(${LDAP_USER_ATTR}=${safeUsername})`;

    // 3. 搜尋使用者
    const { searchEntries } = await client.search(LDAP_BASE_DN, {
      scope: "sub",
      filter,
      attributes: ["dn", "cn", "memberOf", "department", LDAP_USER_ATTR],
    });

    if (!searchEntries || searchEntries.length === 0) {
      console.log(`LDAP User not found: ${username}`);
      return null;
    }

    const entry = searchEntries[0];

    // 4. 使用使用者的 DN 和他輸入的密碼進行驗證 (Re-bind)
    try {
      await client.bind(entry.dn, password);
    } catch (userAuthError) {
      // 這裡通常是密碼錯誤
      console.log(`LDAP Auth failed for user ${username}:`, userAuthError.message);
      return null; 
    }

    // 5. 格式化輸出
    return {
      username,
      cn: entry.cn || username,
      // 注意：ldapts 的 searchEntries 成員可能是字串或陣列，建議統一轉成陣列
      memberOf: Array.isArray(entry.memberOf) 
        ? entry.memberOf 
        : (entry.memberOf ? [entry.memberOf] : []),
      department: entry.department || "",
      dn: entry.dn,
    };

  } catch (error) {
    // 捕捉非預期的網路錯誤或 LDAP 伺服器錯誤
    console.error("Unexpected LDAP Error:", error);
    // 根據需求決定要拋出錯誤還是回傳 null
    throw error; 
  } finally {
    // 確保無論成功或失敗都會斷開連線
    await client.unbind().catch(() => {});
  }
}