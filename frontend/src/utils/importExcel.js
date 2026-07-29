//frontend/src/utils/importExcel.js
import * as XLSX from 'xlsx'

// 🌟 無敵標準化工具：自動無視全形、半形、空白、斜線、括號的差異
const normalize = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/[\/／]/g, '/')   // 統一斜線
    .replace(/[\(（]/g, '(')   // 統一左括號
    .replace(/[\)）]/g, ')')   // 統一右括號
    .replace(/\s+/g, '');      // 移除所有空白
};

// 🌟 智慧尋找表頭 Key 工具
const findKey = (row, target) => {
  const normTarget = normalize(target);
  const actualKey  = Object.keys(row).find(k => normalize(k) === normTarget);
  return actualKey ? row[actualKey] : undefined;
};

// 🌟 🌟 全動態核心：傳入 fileRaw 與從資料庫查出來的 rules 字典
export const parseBikeExcel = (fileRaw, rules) => {
  return new Promise((resolve, reject) => {
    
    // 🛡️ 防護：確保規則字典存在
    if (!rules || !Array.isArray(rules)) {
      return reject(new Error('無法取得計分規則字典，請重整頁面後再試。'));
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data     = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const result   = { bikeUpdates: [], stationUpdates: [] }

        // ==========================================
        // 🏠 1. 解析 Station 分頁 (結構固定)
        // ==========================================
        const stationSheetName = workbook.SheetNames.find(n => n.toLowerCase().replace(/\s+/g, '').includes('station'))
        if (stationSheetName) {
          // 🛡️ 加上 { raw: false } 確保日期不會變成浮點數
          const stationJson = XLSX.utils.sheet_to_json(workbook.Sheets[stationSheetName], { raw: false })
          result.stationUpdates = stationJson.map(row => {
            const signpostStr = findKey(row, '場站導標桿') || ''
            const cleanStr    = findKey(row, '場站周圍整潔') || ''
            
            return {
              created_by:            findKey(row, '工號') || '',
              city:                  findKey(row, '縣市') || '',
              station_name:          findKey(row, '場站名稱') || '',
              bikes_in_dock_count:   parseInt(findKey(row, '場站車輛數')) || 0,
              reversed_saddle_count: parseInt(findKey(row, '座椅反轉車輛數')) || 0,
              inactive_bike_count:   parseInt(findKey(row, '車機無法喚醒及暫停服務車輛數')) || 0,
              
              signpost_no_design:    signpostStr.includes('[無設計圖]') ? 1 : 0,
              signpost_crooked:      signpostStr.includes('[歪斜或毀損]') ? 1 : 0,
              signpost_missing:      signpostStr.includes('[缺漏]') ? 1 : 0,
              station_clean_garbage: cleanStr.includes('[人為廢棄物]') ? 1 : 0,
              station_clean_leaves:  cleanStr.includes('[落葉雜草或軟爛果實]') ? 1 : 0,
              
              station_note:          findKey(row, '場站備註說明') || '',
              created_at:            findKey(row, '巡檢時間') || null, // 🛡️ 空值必須是 null，不能是 ''
            }
          }).filter(s => s.station_id || s.station_name)
        }

        // ==========================================
        // 🚲 2. 解析 Bike 分頁 (🌟 終極全動態比對映射)
        // ==========================================
        let bikeSheetName = workbook.SheetNames.find(n => n.toLowerCase().replace(/\s+/g, '').includes('bike'))
        
        if (!bikeSheetName) {
          if (workbook.SheetNames.length === 1) {
            bikeSheetName = workbook.SheetNames[0]
          } else {
            bikeSheetName = workbook.SheetNames.find(n => n !== stationSheetName) || workbook.SheetNames[0]
          }
        }
        
        // 🛡️ 加上 { raw: false } 確保所有日期跟數字維持字串格式，不會跑版
        const bikeJson = XLSX.utils.sheet_to_json(workbook.Sheets[bikeSheetName], { raw: false })
        const bikeRules = rules.filter(r => r.major_category !== '場站')

        result.bikeUpdates = bikeJson.map(row => {
          const rowKeys = Object.keys(row)
          
          // 建立基本資訊物件
          let bikeObj = {
            id:                  row.Id || row.id || row.ID || findKey(row, 'Id'),
            front_role:          findKey(row, '前台角色') || '',
            created_by:          findKey(row, '工號') || '',
            created_at:          findKey(row, '測驗日期') || null, // 🛡️ 日期欄位沒有值的話必須是 null
            model:               findKey(row, '車種') || '',
            city:                findKey(row, '縣市') || '',
            station_name:        findKey(row, '場站名稱') || '',
            bike_no:             findKey(row, '車號') || '',
            dock_no:             findKey(row, '車柱柱號') || '',
            first_level_checker: findKey(row, '一級檢修人員') || '',
            check_date:          findKey(row, '一級檢修日') || null  // 🛡️ 日期欄位沒有值的話必須是 null
          }

          // 核心扣分項目動態比對
          bikeRules.forEach(rule => {
            const targetHeader = [rule.large_category, rule.sub_category, rule.item_name].filter(Boolean).join('_')
            const normTarget   = normalize(targetHeader)
            
            const actualExcelKey = rowKeys.find(k => normalize(k) === normTarget)
            
            if (actualExcelKey !== undefined) {
              const excelValue = row[actualExcelKey]
              bikeObj[rule.item_key] = (excelValue === 'V' || excelValue === 1 || excelValue === '1') ? 1 : 0
            } else {
              bikeObj[rule.item_key] = 0
            }
          })

          // 補上後方數值 (確保空值會變回 0，不會傳 undefined 或空字串去炸資料庫)
          bikeObj.front_tire_psi   = parseFloat(findKey(row, '前胎壓') || findKey(row, '其他測試_前胎壓')) || 0
          bikeObj.rear_tire_psi    = parseFloat(findKey(row, '後胎壓') || findKey(row, '其他測試_後胎壓')) || 0
          bikeObj.dock_note        = findKey(row, '車柱備註') || findKey(row, '車柱備註(文字)') || ''
          bikeObj.appearance_note  = findKey(row, '車體外觀與附屬裝備備註') || findKey(row, '外觀備註(文字)') || ''
          bikeObj.structure_note   = findKey(row, '車體結構與安全功能備註') || findKey(row, '車體結構與安全功能備註(文字)') || ''
          bikeObj.other_note       = findKey(row, '其他測試_備註') || findKey(row, '其他測試備註(文字)') || ''
          bikeObj.battery_level    = parseFloat(findKey(row, '可用電量') || findKey(row, '2.0借出可用電量(%)')) || null

          return bikeObj
        }).filter(u => u.id) // 過濾掉沒有 ID 的廢資料

        resolve(result)
      } catch (error) {
        reject(error)
      }
    }
    reader.onerror = (error) => reject(error)
    reader.readAsArrayBuffer(fileRaw)
  })
}