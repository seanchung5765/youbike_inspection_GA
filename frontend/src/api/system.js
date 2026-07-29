//frontend/src/api/system.js
import request from './index'

// 🌟 獲取所有系統下拉選項 (單位、角色、地區)
export const getSystemOptionsAPI = () => {
  return request.get('/system/options')
}