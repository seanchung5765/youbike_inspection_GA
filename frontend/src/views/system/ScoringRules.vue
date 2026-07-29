<template>
  <div class="scoring-container">
    <div class="header">
      <h2>📊 計分規則設定</h2>
      <div class="actions">
        <!--<el-button type="warning" @click="handleSyncColumns" :loading="syncing" class="mobile-btn">
          <el-icon><Refresh /></el-icon> 自動載入欄位
        </el-button>-->
        <el-button type="primary" @click="handleSave" :loading="saving" class="mobile-btn">
          <el-icon><Check /></el-icon> 儲存所有變更
        </el-button>
      </div>
    </div>

    <el-alert 
      title="操作提示：點擊「自動載入」抓取所有異常欄位。請對照 Excel 表格設定分類。合併群組可直接下拉選擇，同群組會顯示相同顏色圓點。" 
      type="info" show-icon style="margin-bottom: 15px;" 
    />
    
    <el-table 
      :data="tableData" 
      v-loading="loading" 
      border stripe
      height="calc(100vh - 200px)"
      style="width: 100%;" 
    >
      <el-table-column label="資料庫欄位" prop="item_key" min-width="150" fixed="left" show-overflow-tooltip />

      <el-table-column label="車種" min-width="100" header-align="center">
        <template #default="scope">
          <el-select v-model="scope.row.bike_type" size="small">
            <el-option label="ALL" value="ALL" />
            <el-option label="2.0" value="2.0" />
            <el-option label="2.0E" value="2.0E" />
          </el-select>
        </template>
      </el-table-column>

      <el-table-column label="類別" min-width="120" show-overflow-tooltip>
        <template #default="scope">
          <el-select v-model="scope.row.major_category" size="small" allow-create filterable>
            <el-option value="場站" />
            <el-option value="自行車外觀與重要標示" />
            <el-option value="自行車重要機能" />
          </el-select>
        </template>
      </el-table-column>

      <el-table-column label="中項" min-width="120">
        <template #default="scope">
          <el-input v-model="scope.row.sub_category" size="small" />
        </template>
      </el-table-column>

      <el-table-column label="細項" min-width="160" show-overflow-tooltip>
        <template #default="scope">
          <el-input v-model="scope.row.item_name" size="small" />
        </template>
      </el-table-column>

      <!-- 🌟 升級版：合併群組 (智慧選單 + 顏色視覺化) -->
      <el-table-column label="合併扣分" min-width="180">
        <template #default="scope">
          <el-select
            v-model="scope.row.merge_group"
            size="small"
            clearable
            filterable
            allow-create
            default-first-option
            placeholder="選擇或輸入群組"
            style="width: 100%"
            class="group-select"
          >
            <!-- 在輸入框前方顯示專屬顏色圓點 -->
            <template #prefix v-if="scope.row.merge_group">
              <div class="color-dot" :style="{ backgroundColor: stringToColor(scope.row.merge_group) }"></div>
            </template>
            
            <!-- 下拉選單內的選項也顯示專屬顏色 -->
            <el-option
              v-for="group in availableMergeGroups"
              :key="group"
              :label="group"
              :value="group"
            >
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="color-dot" :style="{ backgroundColor: stringToColor(group) }"></span>
                <span style="font-weight: bold;">{{ group }}</span>
              </div>
            </el-option>
          </el-select>
        </template>
      </el-table-column>

      <el-table-column label="等級" min-width="80" align="center">
        <template #default="scope">
          <el-select v-model="scope.row.severity" size="small">
            <el-option label="A" value="A" />
            <el-option label="B" value="B" />
            <el-option label="C" value="C" />
          </el-select>
        </template>
      </el-table-column>

      <el-table-column label="扣分" width="110" fixed="right">
        <template #default="scope">
          <el-input-number v-model="scope.row.deduction_points" :min="-100" :max="0" :step="1" size="small" style="width: 100%" />
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Check, Refresh } from '@element-plus/icons-vue'
import { getScoringRulesAPI, batchUpdateRulesAPI, syncScoringColumnsAPI } from '../../api/scoring'

const tableData = ref([])
const loading = ref(false)
const saving = ref(false)
const syncing = ref(false)

// 🌟 自動收集目前表格中所有「不重複的群組名稱」，變成下拉選單的選項
const availableMergeGroups = computed(() => {
  const groups = new Set();
  tableData.value.forEach(row => {
    if (row.merge_group && row.merge_group.trim() !== '') {
      groups.add(row.merge_group.trim());
    }
  });
  return Array.from(groups).sort();
});

// 🌟 魔法函數：將「文字」轉換成固定的「粉嫩色碼 (Pastel Color)」
const stringToColor = (str) => {
  if (!str) return 'transparent';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = '#';
  for (let i = 0; i < 3; i++) {
    // 加上 255 再除以 2，確保產生出來的顏色是好看的馬卡龍/粉嫩色系
    let value = (hash >> (i * 8)) & 0xFF;
    value = Math.floor((value + 255) / 2); 
    color += ('00' + value.toString(16)).substr(-2);
  }
  return color;
};

const fetchData = async () => {
  loading.value = true
  try {
    const res = await getScoringRulesAPI()
    if (res.data.success) tableData.value = res.data.data
  } catch (error) { ElMessage.error('載入計分規則失敗') } 
  finally { loading.value = false }
}

const handleSyncColumns = async () => {
  syncing.value = true
  try {
    const res = await syncScoringColumnsAPI()
    if (res.data.success) {
      ElMessage.success(res.data.message)
      fetchData() 
    }
  } catch (error) { ElMessage.error('自動載入欄位失敗') } 
  finally { syncing.value = false }
}

const handleSave = async () => {
  saving.value = true
  try {
    const res = await batchUpdateRulesAPI({ rules: tableData.value })
    if (res.data.success) ElMessage.success('所有規則已成功儲存！')
  } catch (error) { ElMessage.error('儲存失敗') } 
  finally { saving.value = false }
}

onMounted(fetchData)
</script>

<style scoped>
.scoring-container { padding: 20px; background-color: #fff; border-radius: 8px; box-shadow: 0 2px 12px 0 rgba(0,0,0,0.1); }
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.actions { display: flex; gap: 15px; align-items: center; }
h2 { margin: 0; color: #303133; font-size: 20px; }

/* 🌟 1. 解除 Element Plus 元件的字體大小鎖定，使其跟隨外層縮放 */
:deep(.el-input__inner),
:deep(.el-alert__title),
:deep(.el-table .cell) {
  font-size: 1em !important;
}

/* 🌟 2. 讓下拉選單展開時，裡面的選項也能放大 */
:deep(.el-select-dropdown__item) {
  font-size: 1em !important;
}

/* 🌟 3. 解除 size="small" 的高度限制，避免字體放大後文字被裁切 */
:deep(.el-input--small .el-input__wrapper) {
  height: auto !important;
  min-height: 24px;
  padding-top: 4px;
  padding-bottom: 4px;
}

/* 🌟 群組顏色圓點的樣式 */
.color-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: inline-block;
  box-shadow: 0 0 2px rgba(0,0,0,0.2);
}

/* 微調下拉選單內的圓點位置 */
:deep(.group-select .el-input__prefix-inner) {
  align-items: center;
  padding-left: 5px;
}

/* 📱 手機版排版 */
@media (max-width: 768px) {
  .scoring-container { padding: 10px; }
  .header { flex-direction: column; align-items: flex-start; gap: 15px; }
  .actions { width: 100%; flex-direction: column; gap: 10px; }
  .mobile-btn { width: 100%; margin-left: 0 !important; }
  
  /* 手機版維持固定大小避免跑版 */
  :deep(.el-alert__title) { font-size: 12px !important; line-height: 1.4; }
  :deep(.el-table .cell) { padding: 0 5px; font-size: 13px !important; }
  :deep(.el-input__inner) { font-size: 13px !important; }
}
</style>