import axios from 'axios'

const baseURL = 'http://localhost:3000/api'

// 🌟 獲取所有系統下拉選項 (單位、角色、地區)
export const getSystemOptionsAPI = () => {
  return axios.get(`${baseURL}/system/options`)
}