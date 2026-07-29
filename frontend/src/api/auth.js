//frontend/src/api/auth.js
import request from './index'

/**
 * 登入 API
 * @param {Object} data - 包含 username 和 password 的物件
 * @returns Promise
 */
export const loginAPI = (data) => {
  return request.post('/login', data)
}

export const getMenusAPI = (roleId) => {
  return request.get('/menus', {
    params: { roleId: roleId }
  })
}
// 未來如果有「登出」或「忘記密碼」，也都是寫在這個檔案裡
// export const logoutAPI = () => { ... }