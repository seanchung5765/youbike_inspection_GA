import axios from 'axios'

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'


// 獲取人員列表 API
// params 可以用來傳遞搜尋關鍵字 (如: { search: 'GB5765', page: 1 })
export const getUsersAPI = (params) => {
  return axios.get(`${baseURL}/users`, { params })
}

// 新增人員與權限
export const addPermissionsAPI = (payload) => {
  return axios.post(`${baseURL}/users/permissions`, payload)
}

// 刪除人員
export const deleteUserAPI = (id) => {
  return axios.delete(`${baseURL}/users/${id}`)
}
// 編輯人員
export const updatePermissionsAPI = (id, payload) => {
  return axios.put(`${baseURL}/users/${id}`, payload)
}