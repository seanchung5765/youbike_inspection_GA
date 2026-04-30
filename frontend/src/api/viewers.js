import axios from 'axios'

// 確保 baseURL 對應到後端的入口
const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'

// 1. 取得已配置閱覽權限的人員列表
// 對應：router.get('/')
export const getViewersAPI = (params) => axios.get(`${baseURL}/viewers`, { params })

// 2. 取得該單位受授權的地區清單
// 對應：router.get('/unit-regions')
// 🌟 修正：後端是用 user_id 去查 unit_id，所以參數改傳 userId
export const getUnitAllowedRegionsAPI = (userId) => axios.get(`${baseURL}/viewers/unit-regions`, { 
  params: { user_id: userId } 
})

// 3. 取得「尚未配置」權限的人員名單 (大海撈針)
// 對應：router.get('/eligible-users')
// 🌟 修正：名稱對齊後端路由，並改傳 user_id 以排除自己
export const getEligibleUsersAPI = (userId) => axios.get(`${baseURL}/viewers/eligible-users`, { 
  params: { user_id: userId } 
})

// 4. 新增人員閱覽權限
// 對應：router.post('/')
// 🌟 修正：移除網址末端的 /save，直接 POST 到 /viewers
export const addViewerAPI = (payload) => axios.post(`${baseURL}/viewers`, payload)

// 5. 更新人員閱覽權限
// 對應：router.put('/:userId')
export const updateViewerAPI = (id, payload) => axios.put(`${baseURL}/viewers/${id}`, payload)

// 6. 刪除閱覽權限
// 對應：router.delete('/:id')
export const deleteViewerAPI = (id, operatorId) => {
  return axios.delete(`${baseURL}/viewers/${id}`, {
    params: { operator_id: operatorId } 
  })
}

