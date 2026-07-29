//frontend/src/api/viewers.js
import request from './index'

// 1. 取得已配置閱覽權限的人員列表
export const getViewersAPI = (params) => request.get('/viewers', { params })

// 2. 取得該單位受授權的地區清單
export const getUnitAllowedRegionsAPI = (userId) => request.get('/viewers/unit-regions', { 
  params: { user_id: userId } 
})

// 3. 取得「尚未配置」權限的人員名單 (大海撈針)
export const getEligibleUsersAPI = (userId) => request.get('/viewers/eligible-users', { 
  params: { user_id: userId } 
})

// 4. 新增人員閱覽權限
export const addViewerAPI = (payload) => request.post('/viewers', payload)

// 5. 更新人員閱覽權限
export const updateViewerAPI = (id, payload) => request.put(`/viewers/${id}`, payload)

// 6. 刪除閱覽權限
export const deleteViewerAPI = (id, operatorId) => {
  return request.delete(`/viewers/${id}`, {
    params: { operator_id: operatorId } 
  })
}