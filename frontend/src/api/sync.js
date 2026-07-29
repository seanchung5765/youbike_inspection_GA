//frontend/src/api/sync.js
import request from './index' // 改從當前目錄的 index 引入

/**
 * 1. 取得月度報表清單
 * @returns {Promise} 包含各月份狀態的陣列
 */
export const getMonthlyReportsAPI = () => {
  return request({
    url: '/monthly-sync/list',
    method: 'get'
  })
}

/**
 * 2. 執行跨庫資料同步 (從模擬體驗載入資料)
 * @param {Object} data - 包含 month 與 operator_id，例如: { month: '2026-03', operator_id: 'GB5765' }
 * @returns {Promise}
 */
export const syncMonthlyDataAPI = (data) => {
  return request({
    url: '/monthly-sync/sync',
    method: 'post',
    data,
    timeout: 60000
  })
}

/**
 * 3. 鎖定發布
 * @param {Object} data - 包含 month，例如: { month: '2026-03' }
 * @returns {Promise}
 */
export const publishMonthlyReportAPI = (data) => {
  return request({
    url: '/monthly-sync/publish',
    method: 'post',
    data
  })
}