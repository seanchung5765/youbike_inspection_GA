import axios from 'axios'


const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'

/**
 * 登入 API
 * @param {Object} data - 包含 username 和 password 的物件
 * @returns Promise
 */
export const loginAPI = (data) => {
  return axios.post(`${baseURL}/login`, data)
}

export const getMenusAPI = (roleId) => {
  return axios.get(`${baseURL}/menus`, {
    params: { roleId: roleId }
  })
}
// 未來如果有「登出」或「忘記密碼」，也都是寫在這個檔案裡
// export const logoutAPI = () => { ... }