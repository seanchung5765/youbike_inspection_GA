//frontend/src/api/ldap.js
import request from './index'

// 呼叫後端的 LDAP 搜尋 API
export const searchLdapAPI = (keyword) => {
  return request.get('/ldap/search', { 
    params: { q: keyword } 
  })
}