//frontend/src/api/units.js
import request from './index'

// 獲取單位權限列表
export const getUnitsAPI = () => {
  return request.get('/units')
}

// 編輯單位對應的地區權限
export const updateUnitRegionsAPI = (unitId, payload) => {
  return request.put(`/units/${unitId}/regions`, payload)
}
// 新增單位對應的地區權限
export const addUnitAPI = (payload) => {
  return request.post('/units', payload)
}
// 刪除單位對應的地區權限
export const deleteUnitAPI = (id) => {
  return request.delete(`/units/${id}`)
}

// 取得特定單位被授權的地區清單
export const getUnitAllowedRegionsAPI = (unitId) => {
  return request.get(`/units/${unitId}/allowed-regions`)
}