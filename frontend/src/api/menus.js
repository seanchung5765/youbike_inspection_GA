//frontend/src/api/menus.js
import request from './index'

// 獲取動態選單 API
// 這個函式會帶著 roleId 去敲後端的門
export const getMenusAPI = (roleId, empId) => {
  return request.get('/menus', {
    params: { roleId: roleId, emp_id: empId } // 多傳一個 emp_id
  })
}