<template>
  <div class="unit-management">
    <el-card>
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>單位權限管理</span>
          <el-button type="primary" icon="Plus" @click="handleAdd">新增單位權限</el-button>
        </div>
      </template>

      <el-table :data="tableData" style="width: 100%" v-loading="loading" border stripe>
        <el-table-column prop="unit_name" label="單位名稱" width="180" />
        
        <el-table-column label="閱覽地區">
          <template #default="scope">
            <el-tag 
              v-for="region in formatRegions(scope.row.allowed_regions_name)" 
              :key="region"
              size="small"
              class="region-tag"
            >
              {{ region }}
            </el-tag>
            <span v-if="!scope.row.allowed_regions_name" class="text-gray">尚未配置</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="200" fixed="right">
          <template #default="scope">
            <el-button 
              size="small" 
              type="primary" 
              plain 
              @click="handleEdit(scope.row)"
            >編輯</el-button>
            <el-button 
              size="small" 
              type="danger" 
              plain 
              @click="handleDelete(scope.row)"
            >刪除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <UnitDialog ref="unitDialogRef" @success="fetchUnits" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getUnitsAPI, deleteUnitAPI } from '../api/units'
import { ElMessage, ElMessageBox } from 'element-plus'
import UnitDialog from '../components/unit/UnitDialog.vue'

const tableData = ref([])
const loading = ref(false)
const unitDialogRef = ref(null)

// 撈取單位清單
const fetchUnits = async () => {
  loading.value = true
  try {
    const res = await getUnitsAPI()
    if (res.data.success) {
      tableData.value = res.data.data
    }
  } catch (error) {
    ElMessage.error('獲取單位列表失敗')
  } finally {
    loading.value = false
  }
}

// 處理地區名稱字串轉陣列
const formatRegions = (regionsStr) => {
  return regionsStr ? regionsStr.split(', ') : []
}

// 點擊編輯
const handleEdit = (row) => {
  if (unitDialogRef.value) {
    unitDialogRef.value.open('edit', row)
  }
}

// 點擊新增
const handleAdd = () => {
  if (unitDialogRef.value) {
    // 🌟 開啟時傳入 'add' 模式
    unitDialogRef.value.open('add')
  }
}

// 刪除邏輯
const handleDelete = (row) => {
  ElMessageBox.confirm(
    `確定要刪除「${row.unit_name}」嗎？此動作無法復原！`,
    '警告',
    {
      confirmButtonText: '確定刪除',
      cancelButtonText: '取消',
      type: 'warning',
    }
  ).then(async () => {
    try {
      const res = await deleteUnitAPI(row.id)
      if (res.data.success) {
        ElMessage.success('單位已成功刪除')
        fetchUnits() // 刪除成功後，重新撈取表格資料
      }
    } catch (error) {
      // 如果後端回傳 400 (例如底下還有人員)，就會顯示後端的錯誤訊息
      ElMessage.error(error.response?.data?.message || '刪除失敗，請聯絡管理員')
    }
  }).catch(() => {
    // 使用者點擊取消，不做任何事
    ElMessage.info('已取消刪除')
  })
}


onMounted(() => {
  fetchUnits()
})


</script>

<style scoped>
.region-tag {
  margin-right: 5px;
  margin-bottom: 5px;
}
.text-gray {
  color: #909399;
  font-size: 12px;
}
</style>