//人員管理
<template>
  <div class="user-management">
    <el-card class="box-card">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span>人員權限管理</span>
        </div>
      </template>
      <div class="header-action">
        <el-input
          v-model="searchQuery"
          placeholder="請輸入工號或姓名"
          class="search-input"
          clearable
          @clear="fetchUsers"
          @keyup.enter="fetchUsers"
        >
          <template #append>
            <el-button icon="Search" @click="fetchUsers" />
          </template>
        </el-input>
        <el-button type="primary" icon="Plus" @click="openAddDialog">新增人員</el-button>
      </div>

<el-table :data="tableData" style="width: 100%" v-loading="loading" border stripe>
        <el-table-column prop="emp_id" label="工號" width="100" />
        <el-table-column prop="name" label="姓名" width="120" />
        <el-table-column prop="unit_name" label="所屬單位" width="120" />
        
        <el-table-column prop="view_regions_name" label="閱覽地區" min-width="150">
          <template #default="scope">
            {{ scope.row.view_regions_name || '無' }}
          </template>
        </el-table-column>

        <el-table-column prop="front_role_name" label="前台角色" width="120">
          <template #default="scope">
            {{ scope.row.front_role_name || '無角色' }}
          </template>
        </el-table-column>

        <el-table-column prop="role_name" label="系統角色" width="120">
          <template #default="scope">
            <el-tag :type="scope.row.role_name === '高階管理員' ? 'danger' : 'info'">
              {{ scope.row.role_name || '無角色' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="150" fixed="right">
          <template #default="scope">
            <el-button size="small" type="primary" plain @click="handleEdit(scope.row)">編輯</el-button>
            <el-button size="small" type="danger" plain @click="handleDelete(scope.row)">刪除</el-button>
          </template>
        </el-table-column>

        </el-table> <div class="pagination-container">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          :total="totalUsers"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>

    <AddUserDialog ref="dialogRef" @success="fetchUsers" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getUsersAPI } from '../api/users'
import { deleteUserAPI } from '../api/users'
import AddUserDialog from '../components/user/AddUserDialog.vue' // 引入子元件

const tableData = ref([])
const loading = ref(false)
const searchQuery = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const totalUsers = ref(0)

const fetchUsers = async () => {
  loading.value = true
  try {
    const res = await getUsersAPI({
      page: currentPage.value,
      limit: pageSize.value,
      search: searchQuery.value
    })
    tableData.value = res.data.data
    totalUsers.value = res.data.total
  } catch (error) {
    ElMessage.error('無法獲取人員資料')
  } finally {
    loading.value = false
  }
}

const handleDelete = (row) => {
  ElMessageBox.confirm(
    `確定要刪除「${row.name}」嗎？此動作無法復原！`,
    '警告',
    { confirmButtonText: '確定刪除', cancelButtonText: '取消', type: 'warning' }
  ).then(async () => {
    try {
      const res = await deleteUserAPI(row.id)
      if (res.data.success) {
        ElMessage.success('刪除成功')
        fetchUsers() // 重新刷清單
      }
    } catch (error) {
      ElMessage.error('刪除失敗')
    }
  })
}

// --- 📝 處理編輯 ---
const handleEdit = (row) => {
  if (dialogRef.value) {
    // 🌟 我們呼叫子元件的 open 方法，並把這一列的資料 (row) 傳進去
    // 這樣彈出視窗才能「反填」舊資料
    dialogRef.value.open('edit', row)
  }
}

const handleSizeChange = (val) => { pageSize.value = val; fetchUsers() }
const handleCurrentChange = (val) => { currentPage.value = val; fetchUsers() }

//處理打開彈出視窗的邏輯
const dialogRef = ref(null)
const openAddDialog = () => {
  if (dialogRef.value) {
    dialogRef.value.open()
  }
}

onMounted(() => {
  fetchUsers()
})
</script>

<style scoped>
.user-management { padding: 10px; }
.header-action { display: flex; justify-content: space-between; margin-bottom: 20px; }
.search-input { width: 300px; }
.pagination-container { margin-top: 20px; display: flex; justify-content: flex-end; }
</style>