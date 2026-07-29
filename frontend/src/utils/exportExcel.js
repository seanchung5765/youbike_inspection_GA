import * as XLSX from 'xlsx'
import { ElMessage, ElLoading } from 'element-plus'
import { getStationsSummaryAPI, getFlatBikesAPI } from '../api/dataProcess'
import { getScoringRulesAPI } from '../api/scoring' 

// 🌟 新增：專門用來將日期格式化，去除小時與分鐘 (只保留 YYYY-MM-DD)
const toDateOnly = (val) => {
  if (!val) return '';
  // 假設傳入的是 "2026-08-03 15:30" 或 "2026-08-03T15:30:00Z"
  return String(val).substring(0, 10); 
}

export const exportMonthDataToExcel = async (month) => {
  const loadingInstance = ElLoading.service({
    lock:       true,
    text:       `正在撈取 ${month} 的資料並產生 Excel，請稍候...`,
    background: 'rgba(0, 0, 0, 0.7)',
  })

  try {
    const [stationRes, bikeRes, rulesRes] = await Promise.all([
      getStationsSummaryAPI(month),
      getFlatBikesAPI(month, '', 'ALL'),
      getScoringRulesAPI()
    ])

    const rawTableData = stationRes.data.success ? stationRes.data.data : []
    const rawBikeData  = bikeRes.data.success ? bikeRes.data.data : []
    const rules        = rulesRes.data.success ? rulesRes.data.data : []

    if (rawTableData.length === 0 && rawBikeData.length === 0) {
      ElMessage.warning(`[${month}] 目前沒有資料可以匯出喔！`)
      return false
    }

    const V = (val) => (val == 1 || val === true || val === '1') ? 'V' : ''

    // ==========================================
    // 🏠 1. Station 分頁
    // ==========================================
    const stationExcelData = rawTableData.map(item => ({
      '前台角色':                     item.front_role,
      '工號':                         item.checker,
      '縣市':                         item.city,
      '場站名稱':                     item.station_name,
      '場站車輛數':                   item.bikes_in_dock_count,
      '座椅反轉車輛數':               item.reversed_saddle_count,
      '車機無法喚醒及暫停服務車輛數': item.inactive_bike_count,
      '場站導標桿': [
        V(item.signpost_no_design) ? '[無設計圖]' : '',
        V(item.signpost_crooked)   ? '[歪斜或毀損]' : '',
        V(item.signpost_missing)   ? '[缺漏]' : ''
      ].filter(Boolean).join(' '),
      '場站周圍整潔': [
        V(item.station_clean_garbage) ? '[人為廢棄物]' : '',
        V(item.station_clean_leaves)  ? '[落葉雜草或軟爛果實]' : ''
      ].filter(Boolean).join(' '),
      '場站備註說明':                 item.station_note,
      '巡檢時間':                     item.created_at
    }))

    // ==========================================
    // 🚲 2. Bike 分頁
    // ==========================================
    const bikeRules = rules
      .filter(r => r.major_category !== '場站')
      .sort((a, b) => (a.sort_order - b.sort_order) || (a.id - b.id));

    const bikeExcelData = rawBikeData.map(item => {
      // 🌟 JavaScript 物件屬性的寫入順序，就是 Excel 輸出的欄位順序！
      // 這裡是你定義的左側固定欄位：
      let rowObj = {
        '前台角色':   item.front_role || '',
        '工號':       item.checker || '',
        // 套用日期過濾器，去除時間
        '測驗日期':   toDateOnly(item.formatted_created_at || item.created_at), 
        '車種':       item.model || '',
        '縣市':       item.city || '',
        '場站名稱':   item.station_name || '',
        '車號':       item.bike_no || '',
        '照片數量':   item.photo_count || 0,
        '照片連結':   item.photo_url || '',
        '車柱柱號':   item.dock_no || '',
        
        // 🌟 強化防呆：使用 ?? 避免數值 0 被 || 判斷為 false 而變成空白。
        // 同時相容 battery_level 與 battery_pct 兩種可能的後端命名。
        '可用電量':     item.battery_level ?? item.battery_pct ?? '', 
        
        // 套用日期過濾器，去除時間
        '一級檢修日':   toDateOnly(item.check_date), 
        '一級檢修人員': item.first_level_checker ?? item.checker ?? ''
      }

      // 🌟 中間的動態計分欄位
      bikeRules.forEach(rule => {
        const headerName = [rule.large_category, rule.sub_category, rule.item_name].filter(Boolean).join('_')
        rowObj[headerName] = V(item[rule.item_key])
      })

      // 🌟 右側的備註欄位
      rowObj['前胎壓']         = item.front_tire_psi || 0
      rowObj['後胎壓']         = item.rear_tire_psi || 0
      rowObj['其他備註']       = item.other_note || ''
      rowObj['車柱備註']       = item.dock_note || ''
      rowObj['外觀備註']       = item.appearance_note || ''
      rowObj['結構備註']       = item.structure_note || ''
      rowObj['Id']             = item.id || ''

      return rowObj
    })

    // ==========================================
    // 📦 SheetJS 匯出與超連結加工
    // ==========================================
    const wb = XLSX.utils.book_new()
    
    if (stationExcelData.length > 0) {
      const wsStation = XLSX.utils.json_to_sheet(stationExcelData)
      XLSX.utils.book_append_sheet(wb, wsStation, "Station")
    }
    
    if (bikeExcelData.length > 0) {
      const wsBike = XLSX.utils.json_to_sheet(bikeExcelData)
      const range  = XLSX.utils.decode_range(wsBike['!ref']);
      
      let photoLinkColIdx  = -1
      let photoCountColIdx = -1
      let idColIdx         = -1
      let dateColIdx       = -1
      let bikeColIdx       = -1 

      for (let c = range.s.c; c <= range.e.c; ++c) {
        const headerCell = wsBike[XLSX.utils.encode_cell({ r: 0, c })];
        if (headerCell) {
          if (headerCell.v === '照片連結') photoLinkColIdx  = c;
          if (headerCell.v === '照片數量') photoCountColIdx = c;
          if (headerCell.v === 'Id')       idColIdx         = c;
          if (headerCell.v === '測驗日期') dateColIdx       = c; 
          if (headerCell.v === '車號')     bikeColIdx       = c; 
        }
      }

      if (photoLinkColIdx !== -1) {
        for (let r = range.s.r + 1; r <= range.e.r; ++r) {
          const countCell   = wsBike[XLSX.utils.encode_cell({ r, c: photoCountColIdx })];
          const idCell      = wsBike[XLSX.utils.encode_cell({ r, c: idColIdx })];
          const linkCellRef = XLSX.utils.encode_cell({ r, c: photoLinkColIdx });
          
          const dateCell    = dateColIdx !== -1 ? wsBike[XLSX.utils.encode_cell({ r, c: dateColIdx })] : null;
          const bikeCell    = bikeColIdx !== -1 ? wsBike[XLSX.utils.encode_cell({ r, c: bikeColIdx })] : null;

          const photoCount = countCell ? parseInt(countCell.v) || 0 : 0;
          const recordId   = idCell ? idCell.v : null;

          if (photoCount > 0 && recordId) {
            const baseUrl = window.location.origin;
            // 防呆擷取，即便 Excel 內的儲存格已經幫你切好日期，這裡也再防呆一次
            const dateStr = dateCell && dateCell.v ? String(dateCell.v).substring(0, 10) : '未知日期';
            const bikeStr = bikeCell && bikeCell.v ? String(bikeCell.v) : '無車號';
            
            const viewerUrl = `${baseUrl}/photo-viewer?id=${recordId}&date=${dateStr}&bike=${bikeStr}`; 
            wsBike[linkCellRef] = { v: '查看照片', t: 's', l: { Target: viewerUrl } };
          } else {
            wsBike[linkCellRef] = { v: '', t: 's' };
          }
        }
      }
      XLSX.utils.book_append_sheet(wb, wsBike, "Bike")
    }

    XLSX.writeFile(wb, `YouBike模擬體驗_${month}.xlsx`)
    ElMessage.success(`${month} Excel 匯出成功！`)
    return true
  } catch (error) {
    console.error('匯出失敗:', error)
    ElMessage.error('匯出失敗，請稍後再試！')
    return false
  } finally {
    loadingInstance.close()
  }
}