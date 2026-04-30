import axios from 'axios'

// 設定後端的基礎網址
const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'

// 獲取動態選單 API
// 這個函式會帶著 roleId 去敲後端的門
export const getMenusAPI = (roleId) => {
  return axios.get(`${baseURL}/menus`, {
    params: { roleId: roleId }
  })
}