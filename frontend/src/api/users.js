//frontend/src/api/users.js
import request from './index'

// 獲取人員列表 API
// params 可以用來傳遞搜尋關鍵字 (如: { search: 'GB5765', page: 1 })
export const getUsersAPI = (params) => {
  return request.get('/users', { params })
}

// 新增人員與權限
export const addPermissionsAPI = (payload) => {
  return request.post('/users/permissions', payload)
}

// 刪除人員
export const deleteUserAPI = (id) => {
  return request.delete(`/users/${id}`)
}
// 編輯人員
export const updatePermissionsAPI = (id, payload) => {
  return request.put(`/users/${id}`, payload)
}