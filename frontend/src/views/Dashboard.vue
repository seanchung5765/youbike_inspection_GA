<template>
  <div class="dashboard-wrapper">
    <!-- 🌟 使用 border-card 樣式讓分頁看起來更有立體感 -->
    <el-tabs v-model="activeTab" type="border-card" class="dashboard-tabs">
      
      <el-tab-pane label="🏆 總分與維護率表" name="summary">
        <SummaryDashboard />
      </el-tab-pane>
      
      <el-tab-pane label="🚨 縣市缺失統計表" name="issues">
        <CityIssueReport />
      </el-tab-pane>
      
    </el-tabs>
  </div>
</template>

<script setup>
import { ref } from 'vue'
// 引入報表組件
import SummaryDashboard from './report/SummaryDashboard.vue'
import CityIssueReport from './report/CityIssueReport.vue'

// 🌟 設定預設開啟的分頁，對應 name 屬性
const activeTab = ref('summary')
</script>

<style scoped>
.dashboard-wrapper {
  /* 讓最外層容器撐滿，並且確保背景色與內距協調 */
  width: 100%;
}

/* 🌟 去除不必要的卡片邊距，讓畫面更緊湊 */
:deep(.el-tabs__content) {
  padding: 15px 0 0 0; /* 縮減上下左右的留白 */
  background-color: transparent;
}

/* 📱 手機版微調：讓分頁標籤稍微小一點，避免擠爆 */
@media (max-width: 768px) {
  :deep(.el-tabs__item) {
    font-size: 13px;
    padding: 0 10px;
  }
}
</style>