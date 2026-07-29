// frontend/src/api/defect.js
import request from './index' // 🌟 統一從你的 axios 攔截器入口引入

// 1. 取得缺失清單
export const getDefectListAPI = (month, city, user_id, role_level) => {
  return request({
    url: '/defect/list',
    method: 'get',
    params: { month, city, user_id, role_level }
  })
}

// 2. 取得 GCS 圖片的 Signed URL
export const getDefectPhotosAPI = (id) => {
  return request({
    url: `/defect/photos/${id}`,
    method: 'get'
  })
}