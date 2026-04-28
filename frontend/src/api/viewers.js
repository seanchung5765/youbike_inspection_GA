import axios from 'axios'
const baseURL = 'http://localhost:3000/api'

// 1. 取得閱覽清單 (帶入過濾參數)
export const getViewersAPI = (params) => axios.get(`${baseURL}/viewers`, { params })

// 2. 取得該單位受授權的地區清單 [cite: 270, 300]
export const getUnitAllowedRegionsAPI = (unitId) => axios.get(`${baseURL}/units/${unitId}/allowed-regions`)

// 3. 取得「同單位」的所有人員 (不論有無前台角色，皆可被賦予閱覽權)
export const getUnitUsersAPI = (unitId) => axios.get(`${baseURL}/users`, { params: { unit_id: unitId } })

// 4. 儲存閱覽權限
export const saveViewerPermissionAPI = (payload) => axios.post(`${baseURL}/viewers/save`, payload)