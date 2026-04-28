<template>
  <div class="view-auth-container">
    <el-card>
      <template #header>
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
          <span>閱覽管理</span>
          <el-button type="primary" @click="handleAdd">新增閱覽權限</el-button>
        </div>
      </template>

      <div class="search-bar" style="margin-bottom: 20px;">
        <el-input
          v-model="searchQuery"
          placeholder="請輸入工號或姓名"
          style="width: 300px; margin-right: 10px;"
          clearable
        />
        <el-button type="primary" @click="fetchViewers">查詢</el-button>
      </div>

      <el-table :data="filteredViewers" border stripe v-loading="loading">
        <el-table-column label="姓名/工號" width="200">
          <template #default="scope">
            {{ scope.row.name }} ({{ scope.row.emp_id }})
          </template>
        </el-table-column>
        
        <el-table-column prop="unit_name" label="單位" width="130" />

        <el-table-column prop="front_role_name" label="前台角色" width="130">
          <template #default="scope">
            <el-tag v-if="scope.row.front_role_name" size="small">{{ scope.row.front_role_name }}</el-tag>
            <span v-else style="color: #909399; font-size: 12px;">無前台角色</span>
          </template>
        </el-table-column>
        
        <el-table-column label="閱覽地區">
          <template #default="scope">
            <el-tag 
              v-for="region in formatRegions(scope.row.view_regions_name)" 
              :key="region"
              size="small"
              style="margin-right: 5px;"
            >
              {{ region }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="180" fixed="right">
          <template #default="scope">
            <el-button size="small" @click="handleEdit(scope.row)">編輯</el-button>
            <el-button size="small" type="danger" @click="handleDelete(scope.row)">刪除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <ViewerDialog ref="viewerDialogRef" @success="fetchViewers" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
// 🌟 改用獨立的 API 檔案，保持程式碼整潔
import { getViewersAPI } from '../api/viewers' 
import ViewerDialog from '../components/viewer/ViewerDialog.vue'

const searchQuery = ref('')
const loading = ref(false)
const viewers = ref([])
const viewerDialogRef = ref(null) // 🌟 綁定彈窗參考

// 取得閱覽人員清單
const fetchViewers = async () => {
  loading.value = true
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    console.log('檢查前端 user 物件內容:', user);// 👈 先加這行在 fetchViewers 裡
    // 🌟 核心修改：除了傳入單位與等級，也要傳入自己的 ID
    const res = await getViewersAPI({ 
      unit_id: user.unit_id, 
      role_level: user.role_level,
      user_id: user.id // 讓後端知道要排除掉誰
    })
    
    if (res.data.success) {
      viewers.value = res.data.data
    }
  } catch (error) {
    ElMessage.error('載入閱覽權限清單失敗')
  } finally {
    loading.value = false
  }
}

// 關鍵字過濾 
const filteredViewers = computed(() => {
  if (!searchQuery.value) return viewers.value
  return viewers.value.filter(v => 
    v.name.includes(searchQuery.value) || v.emp_id.includes(searchQuery.value)
  )
})

const formatRegions = (str) => str ? str.split(', ') : []

// 🌟 觸發彈窗的 open 方法 (新增模式)
const handleAdd = () => {
  if (viewerDialogRef.value) {
    viewerDialogRef.value.open('add')
  }
}

// 🌟 觸發彈窗的 open 方法 (編輯模式)
const handleEdit = (row) => {
  if (viewerDialogRef.value) {
    viewerDialogRef.value.open('edit', row)
  }
}

const handleDelete = (row) => {
  ElMessageBox.confirm(`確定要移除 ${row.name} 的閱覽權限嗎？`)
}

onMounted(() => {
  fetchViewers()
})
</script>