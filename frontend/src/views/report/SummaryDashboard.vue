<template>
  <div class="summary-container">
    
    <el-card style="margin-bottom: 20px;">
      <template #header>
        <div class="mobile-header">
          <h2>📊 基礎施測數據與胎壓檢測</h2>
          <div class="header-right-actions">
            <el-select v-model="selectedMonth" placeholder="選擇月份" @change="fetchSummary" style="width: 130px;">
              <el-option v-for="m in monthOptions" :key="m" :label="m" :value="m" />
            </el-select>
            <el-button 
              v-if="currentUser.role_level >= 90" 
              type="primary" 
              @click="handleRecalculate" 
              :loading="calculating" 
              :disabled="!selectedMonth || monthStatus === 'published'"
            >
              <el-icon><Refresh /></el-icon> 重新結算
            </el-button>
          </div>
        </div>
      </template>

      <el-table :data="processedTableData" v-loading="loading" border stripe style="width: 100%">
        <el-table-column prop="city" label="地區" min-width="100" fixed="left" align="center">
          <template #default="scope">
            <span style="font-weight: bold; font-size: 1.1em;">{{ scope.row.city }}</span>
          </template>
        </el-table-column>
        

          <el-table-column prop="tested_stations" label="施測站數" min-width="90" align="center" />
          <el-table-column prop="total_bikes" label="施測車輛數" min-width="100" align="center" />
          <el-table-column prop="ebikes_count" label="2.0E 施測車輛數" min-width="100" align="center" />


        <el-table-column label="前後胎壓檢測" align="center">
          <el-table-column prop="tire_fail_count" label="未達標準(輛)" min-width="110" align="center" />
          <el-table-column prop="tire_fail_rate" label="未達標準" min-width="110" align="center">
            <template #default="scope">
              <span :style="{ color: scope.row.tire_fail_rate > 10 ? 'red' : 'inherit' }">
                {{ scope.row.tire_fail_rate }}%
              </span>
            </template>
          </el-table-column>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card style="margin-bottom: 20px;">
      <template #header>
        <div class="mobile-header">
          <h2>🏆 總分表</h2>
        </div>
      </template>

      <el-table :data="processedTableData" v-loading="loading" border stripe style="width: 100%" :span-method="objectSpanMethod">
        <el-table-column prop="city" label="地區" min-width="120" fixed="left" align="center">
          <template #default="scope">
            <span style="font-weight: bold; font-size: 1.1em;">{{ scope.row.city }}</span>
          </template>
        </el-table-column>

        <el-table-column label="整體" align="center">
          <el-table-column prop="pure_station" label="場站妥善度" min-width="130" align="center">
             <template #default="scope">{{ roundScore(scope.row.pure_station) }} 分</template>
          </el-table-column>
          <el-table-column prop="pure_appearance" label="外觀與重要標示" min-width="180" align="center">
            <template #default="scope">{{ roundScore(scope.row.pure_appearance) }} 分</template>
          </el-table-column>
          <el-table-column prop="pure_function" label="重要機能" min-width="120" align="center">
            <template #default="scope">{{ roundScore(scope.row.pure_function) }} 分</template>
          </el-table-column>
        </el-table-column>

        <el-table-column label="2.0 分數" align="center">
          <el-table-column prop="score_2_0_appearance" label="外觀與重要標示" min-width="180" align="center">
            <template #default="scope">{{ roundScore(scope.row.score_2_0_appearance) }} 分</template>
          </el-table-column>
          <el-table-column prop="score_2_0_function" label="重要機能" min-width="120" align="center">
            <template #default="scope">{{ roundScore(scope.row.score_2_0_function) }} 分</template>
          </el-table-column>
          <el-table-column prop="score_2_0" label="總分" min-width="100" align="center">
            <template #default="scope">
              <span style="font-weight: bold; font-size: 1.1em; color: #409EFF;">{{ roundScore(scope.row.score_2_0) }}</span>
            </template>
          </el-table-column>
        </el-table-column>

        <el-table-column label="2.0E 分數" align="center">
          <el-table-column prop="score_2_0e_appearance" label="外觀與重要標示" min-width="180" align="center">
            <template #default="scope">{{ roundScore(scope.row.score_2_0e_appearance) }} 分</template>
          </el-table-column>
          <el-table-column prop="score_2_0e_function" label="重要機能" min-width="120" align="center">
            <template #default="scope">{{ roundScore(scope.row.score_2_0e_function) }} 分</template>
          </el-table-column>
          <el-table-column prop="score_2_0e" label="總分" min-width="100" align="center">
            <template #default="scope">
              <span style="font-weight: bold; font-size: 1.1em; color: #409EFF;">{{ roundScore(scope.row.score_2_0e) }}</span>
            </template>
          </el-table-column>
        </el-table-column>

        
          <el-table-column prop="maintenance_rate" label="一級維護率" min-width="130" align="center">
            <template #default="scope">{{ scope.row.maintenance_rate }}%</template>
          </el-table-column>
          <el-table-column prop="availability_rate_calc" label="可動率" min-width="110" align="center">
            <template #default="scope">{{ scope.row.availability_rate_calc }}%</template>
        
        </el-table-column>

        <el-table-column prop="final_score" label="總分" min-width="100" align="center" fixed="right">
          <template #default="scope">
            <span style="font-size: 1.2em; font-weight: bold; color: #F56C6C;">
              {{ formatTwoDecimals(scope.row.final_score) }}
            </span>
          </template>
        </el-table-column>

        <el-table-column prop="display_group_name" label="營運區" min-width="120" align="center" fixed="right">
          <template #default="scope">
            <span style="font-weight: bold; font-size: 1.1em;">{{ scope.row.display_group_name }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="display_group_score" label="營運區總分" min-width="130" align="center" fixed="right">
          <template #default="scope">
            <span style="font-size: 1.4em; font-weight: bold; color: #E6A23C;">
              {{ formatTwoDecimals(scope.row.display_group_score) }}
            </span>
          </template>
        </el-table-column>

        <el-table-column prop="ops_final_score" label="主管測評" min-width="110" align="center" fixed="right">
          <template #default="scope">
            <span style="font-size: 1.2em; font-weight: bold; color: #909399;">
              {{ scope.row.ops_final_score ? formatTwoDecimals(scope.row.ops_final_score) : '-' }}
            </span>
          </template>
        </el-table-column>

      </el-table>
    </el-card>

    <el-card style="margin-bottom: 20px;">
      <template #header>
        <div class="mobile-header">
          <h2>📊 可動率</h2>
        </div>
      </template>
      
      <el-table :data="processedTableData" v-loading="loading" border stripe style="width: 100%" :show-summary="true" :summary-method="getAvailabilitySummary">
        <el-table-column prop="city" label="地區" min-width="120" fixed="left" align="center">
          <template #default="scope">
            <span style="font-weight: bold; font-size: 1.1em;">{{ scope.row.city }}</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="inspection_count" label="抽驗場站數" min-width="100" align="center" />
        <el-table-column prop="total_docked_bikes" label="抽驗總在站車輛數" min-width="100" align="center" />
        <el-table-column prop="unrentable_bikes" label="無法租借車輛數" min-width="120" align="center" />
        
        <el-table-column prop="availability_rate_calc" label="在站車輛可動率" min-width="150" align="center">
          <template #default="scope">
            <span style="font-weight: bold; font-size: 1.1em;">{{ scope.row.availability_rate_calc }}%</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="availability_penalty" label="總分扣分" min-width="100" align="center">
          <template #default="scope">
            <span :style="{ color: scope.row.availability_penalty < 0 ? 'red' : 'green', fontWeight: 'bold', fontSize: '1.1em' }">
              {{ scope.row.availability_penalty }}
            </span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card>
      <template #header>
        <div class="mobile-header">
          <h2>🛠️ 一級維護
            <span v-if="currentUser.role_level >= 90" style="font-size: 14px; color: #909399; margin-left: 10px; font-weight: normal;">
              (高階主管專用 {{ monthStatus === 'published' ? '唯讀模式' : '編輯區' }})
            </span>
          </h2>
        </div>
      </template>
      
      <el-table :data="processedTableData" v-loading="loading" border stripe style="width: 100%" :show-summary="true" :summary-method="getMaintenanceSummary">
        <el-table-column prop="city" label="評估區域" min-width="100" fixed="left" align="center">
          <template #default="scope">
            <span style="font-weight: bold; font-size: 1.1em;">{{ scope.row.city }}</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="total_fleet_bikes" label="總營運車輛數" min-width="120" align="center">
          <template #default="scope">
            <el-input-number v-if="currentUser.role_level >= 90 && monthStatus !== 'published'" v-model="scope.row.total_fleet_bikes" :min="0" :controls="false" style="width: 100%" @change="saveMaintenance(scope.row, 'total_fleet_bikes', scope.row.total_fleet_bikes)" />
            <span v-else style="font-size: 1.1em;">{{ scope.row.total_fleet_bikes || 0 }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="accident_bikes" label="事故車輛數" min-width="120" align="center">
          <template #default="scope">
            <el-input-number v-if="currentUser.role_level >= 90 && monthStatus !== 'published'" v-model="scope.row.accident_bikes" :min="0" :controls="false" style="width: 100%" @change="saveMaintenance(scope.row, 'accident_bikes', scope.row.accident_bikes)" />
            <span v-else style="font-size: 1.1em;">{{ scope.row.accident_bikes || 0 }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="broken_bikes" label="故障車輛數" min-width="120" align="center">
          <template #default="scope">
            <el-input-number v-if="currentUser.role_level >= 90 && monthStatus !== 'published'" v-model="scope.row.broken_bikes" :min="0" :controls="false" style="width: 100%" @change="saveMaintenance(scope.row, 'broken_bikes', scope.row.broken_bikes)" />
            <span v-else style="font-size: 1.1em;">{{ scope.row.broken_bikes || 0 }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="broken_rate" label="故障車比率" min-width="110" align="center">
          <template #default="scope">
            <span style="color: #909399;">
              {{ scope.row.total_fleet_bikes > 0 ? ((scope.row.broken_bikes / scope.row.total_fleet_bikes) * 100).toFixed(2) + '%' : '0.00%' }}
            </span>
          </template>
        </el-table-column>

        <el-table-column prop="maintenance_records" label="一級維護記錄數" min-width="120" align="center">
          <template #default="scope">
            <el-input-number v-if="currentUser.role_level >= 90 && monthStatus !== 'published'" v-model="scope.row.maintenance_records" :min="0" :controls="false" style="width: 100%" @change="saveMaintenance(scope.row, 'maintenance_records', scope.row.maintenance_records)" />
            <span v-else style="font-size: 1.1em;">{{ scope.row.maintenance_records || 0 }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="maintenance_rate" label="一級維護率" min-width="140" align="center">
          <template #default="scope">
            <span style="font-weight: bold; font-size: 1.1em;">{{ scope.row.maintenance_rate }}%</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="maintenance_penalty" label="總分扣分" min-width="90" align="center">
          <template #default="scope">
            <span :style="{ color: scope.row.maintenance_penalty < 0 ? 'red' : 'green', fontWeight: 'bold', fontSize: '1.2em' }">
              {{ scope.row.maintenance_penalty }}
            </span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { getReportSummaryAPI, recalculateReportAPI, getReportMonthsAPI, updateMaintenanceDataAPI } from '../../api/report' 

const loading = ref(false)
const calculating = ref(false)
const monthOptions = ref([]) 
const selectedMonth = ref('')
const monthStatus = ref('draft') 

const tableData = ref([])
const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

// 🌟 保留原本的四捨五入給細項分數
const roundScore = (val) => {
  if (val === null || val === undefined || val === '無資料') return val;
  const num = Number(val);
  return isNaN(num) ? val : Math.round(num);
};

// 🌟 新增：保留小數點後兩位的專屬函數 (總分專用)
const formatTwoDecimals = (val) => {
  if (val === null || val === undefined || val === '無資料' || val === '-') return val;
  const num = Number(val);
  return isNaN(num) ? val : num.toFixed(2);
};

const processedTableData = computed(() => {
  const data = tableData.value;
  if (!data || data.length === 0) return [];
  
  let result = []; 
  let currentGroup = null; 
  let tempGroupRows = [];
  
  const flushGroup = () => {
    if (tempGroupRows.length === 0) return;
    
    // 🌟 1. 營運區總分：直接讀取剛剛後端寫進資料庫的 group_final_score
    const groupScore = tempGroupRows[0].group_final_score !== null ? tempGroupRows[0].group_final_score : '無資料';
    
    // 🌟 2. 營運處自評總分：找出該區內有的 ops_final_score
    const validOpsRow = tempGroupRows.find(r => r.ops_final_score && r.ops_final_score !== 'null');
    const groupOpsScore = validOpsRow ? validOpsRow.ops_final_score : '-';

    tempGroupRows.forEach((r, idx) => {
      result.push({ 
        ...r, 
        display_group_name: currentGroup, 
        display_group_score: groupScore,
        display_ops_score: groupOpsScore, 
        rowspan: idx === 0 ? tempGroupRows.length : 0 
      });
    });
    tempGroupRows = [];
  };

  data.forEach(row => {
    const gName = row.merge_group || row.city; 
    if (gName !== currentGroup) { 
      flushGroup(); 
      currentGroup = gName; 
    }
    tempGroupRows.push(row);
  });
  
  flushGroup(); 
  return result;
});

const objectSpanMethod = ({ row, column }) => {
  if (column.property === 'display_group_name' || column.property === 'display_group_score') {
    if (row.rowspan > 0) return { rowspan: row.rowspan, colspan: 1 };
    else return { rowspan: 0, colspan: 0 }; 
  }
};

const saveMaintenance = async (row, field, value) => {
  try {
    await updateMaintenanceDataAPI(selectedMonth.value, row.city, field, value);
    ElMessage.success('已自動儲存');
    
    const baseScore = parseFloat(row.final_score) - parseFloat(row.maintenance_penalty || 0) - parseFloat(row.availability_penalty || 0);
    const total = Number(row.total_fleet_bikes) || 0;
    const accident = Number(row.accident_bikes) || 0;
    const broken = Number(row.broken_bikes) || 0; 
    const records = Number(row.maintenance_records) || 0;

    const validFleet = total - accident - broken;
    row.maintenance_rate = validFleet > 0 ? ((records / validFleet) * 100).toFixed(2) : 0;
    
    let penalty = 0;
    if (total > 0) {
      const rate = Number(row.maintenance_rate);
      if (rate < 70) penalty = -5;
      else if (rate >= 70 && rate < 75) penalty = -4;
      else if (rate >= 75 && rate < 80) penalty = -3;
      else if (rate >= 80 && rate < 85) penalty = -2;
      else if (rate >= 85 && rate < 90) penalty = -1;
    }
    
    row.maintenance_penalty = penalty;
    row.final_score = (baseScore + parseFloat(row.availability_penalty || 0) + penalty).toFixed(2);
  } catch (error) { ElMessage.error('儲存失敗'); }
}

const getAvailabilitySummary = (param) => {
  const { columns, data } = param; const sums = [];
  let totalInspection = 0, totalDocked = 0, totalUnrentable = 0, totalPenalty = 0;
  data.forEach(row => {
    totalInspection += Number(row.inspection_count) || 0; totalDocked += Number(row.total_docked_bikes) || 0;
    totalUnrentable += Number(row.unrentable_bikes) || 0; totalPenalty += Number(row.availability_penalty) || 0;
  });
  columns.forEach((column, index) => {
    if (index === 0) { sums[index] = '總計'; return; }
    switch (column.property) {
      case 'inspection_count': sums[index] = totalInspection; break;
      case 'total_docked_bikes': sums[index] = totalDocked; break;
      case 'unrentable_bikes': sums[index] = totalUnrentable; break;
      case 'availability_rate_calc':
        sums[index] = totalDocked > 0 ? (((totalDocked - totalUnrentable) / totalDocked) * 100).toFixed(2) + '%' : '100.00%'; break;
      case 'availability_penalty': sums[index] = totalPenalty; break;
      default: sums[index] = '';
    }
  }); return sums;
};

const getMaintenanceSummary = (param) => {
  const { columns, data } = param; const sums = [];
  let sumTotal = 0, sumAccident = 0, sumBroken = 0, sumRecords = 0;
  data.forEach(row => {
    sumTotal += Number(row.total_fleet_bikes) || 0; 
    sumAccident += Number(row.accident_bikes) || 0;
    sumBroken += Number(row.broken_bikes) || 0; 
    sumRecords += Number(row.maintenance_records) || 0;
  });
  columns.forEach((column, index) => {
    if (index === 0) { sums[index] = '總計'; return; }
    switch (column.property) {
      case 'total_fleet_bikes': sums[index] = sumTotal; break;
      case 'accident_bikes': sums[index] = sumAccident; break;
      case 'broken_bikes': sums[index] = sumBroken; break; 
      case 'broken_rate': sums[index] = sumTotal > 0 ? ((sumBroken / sumTotal) * 100).toFixed(2) + '%' : '0.00%'; break;
      case 'maintenance_records': sums[index] = sumRecords; break;
      case 'maintenance_rate':
        const valid = sumTotal - sumAccident - sumBroken;
        sums[index] = valid > 0 ? ((sumRecords / valid) * 100).toFixed(2) + '%' : '0.00%'; break;
      default: 
        if(column.label === '故障車數') sums[index] = sumBroken;
        else sums[index] = '';
    }
  }); return sums;
};

const initDashboard = async () => {
  try {
    const res = await getReportMonthsAPI(currentUser.role_level)
    if (res.data.success && res.data.data.length > 0) {
      monthOptions.value = res.data.data
      selectedMonth.value = monthOptions.value[0]
      fetchSummary()
    } else {
      ElMessage.warning('目前尚無任何報表資訊')
    }
  } catch (error) { ElMessage.error('無法取得月份清單') }
}

const fetchSummary = async () => {
  if (!selectedMonth.value) return; 
  loading.value = true
  try {
    const res = await getReportSummaryAPI(selectedMonth.value, currentUser.id, currentUser.role_level)
    if (res.data.success) {
      tableData.value = res.data.data
      monthStatus.value = res.data.status 
    }
  } catch (error) { ElMessage.error('無法取得總分表資料') } 
  finally { loading.value = false }
}

const handleRecalculate = async () => {
  calculating.value = true
  try {
    const res = await recalculateReportAPI(selectedMonth.value)
    if (res.data.success) {
      ElMessage.success('重新結算成功！')
      fetchSummary()
    }
  } catch (error) { ElMessage.error('結算失敗') } 
  finally { calculating.value = false }
}

onMounted(() => initDashboard())
</script>

<style scoped>
.summary-container { padding: 0 10px; }
h2 { margin: 0; }

.mobile-header {
  display: flex; 
  justify-content: space-between; 
  align-items: center;
  width: 100%;
}
.header-right-actions {
  display: flex;
  align-items: center;
  gap: 15px;
}

@media (max-width: 768px) {
  .mobile-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 15px;
  }
  .header-right-actions {
    display: flex;
    flex-direction: column;
    width: 100%;
    gap: 10px;
  }
  .header-right-actions .el-select, 
  .header-right-actions .el-button {
    width: 100% !important;
    margin-left: 0 !important;
  }
}
</style>