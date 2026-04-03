import { authenticateWithLdap } from "./auth/ldapservice.js";
import { readMappings } from "./configservice.js";

function resolveRole(memberOf, roleMappings) {
    let finalRole = "VIEWER";

    for (const mapping of roleMappings || []) {
        if (memberOf.includes(mapping.ldap_group_dn)) {
            finalRole = mapping.role_id;
        }
    }

    return finalRole;
}

function resolveScope(role, department, unitConfigs) {
    if (role === "ADMIN") return "ALL";

    const unitConfig = (unitConfigs || []).find((u) =>
        department.includes(u.keyword)
    );

    return unitConfig ? unitConfig.regions : [];
}

// 🛡️ 修正點：加上這行定義 async 函式開頭
// ... 前方的 resolveRole 和 resolveScope 保持不變 ...

// 🛡️ 將名稱改為 loginUser 以符合 routes/auth.js 的呼叫
export async function loginUser(username, password) {

    const ldapUser = await authenticateWithLdap(username, password);
    if (!ldapUser) return null;

    const mappings = await readMappings();

    const finalRole = resolveRole(ldapUser.memberOf, mappings.roleMappings);
    const finalScope = resolveScope(finalRole, ldapUser.department, mappings.unitConfigs);

    return {
        username: ldapUser.username,
        cn: ldapUser.cn,
        role: finalRole,
        unit: ldapUser.department,
        scope: finalScope,
    };
}