import axios from 'axios'

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'

// 呼叫後端的 LDAP 搜尋 API
export const searchLdapAPI = (keyword) => {
  return axios.get(`${baseURL}/ldap/search`, { 
    params: { q: keyword } 
  })
}