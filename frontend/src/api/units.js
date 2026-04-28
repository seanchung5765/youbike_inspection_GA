import axios from 'axios'

const baseURL = 'http://localhost:3000/api'

// 獲取單位權限列表
export const getUnitsAPI = () => {
  return axios.get(`${baseURL}/units`)
}

// 編輯單位對應的地區權限
export const updateUnitRegionsAPI = (unitId, payload) => {
  return axios.put(`${baseURL}/units/${unitId}/regions`, payload)
}
// 新增單位對應的地區權限
export const addUnitAPI = (payload) => {
  return axios.post(`${baseURL}/units`, payload)
}
// 刪除單位對應的地區權限
export const deleteUnitAPI = (id) => {
  return axios.delete(`${baseURL}/units/${id}`)
}

// 取得特定單位被授權的地區清單
export const getUnitAllowedRegionsAPI = (unitId) => {
  return axios.get(`${baseURL}/units/${unitId}/allowed-regions`)
}