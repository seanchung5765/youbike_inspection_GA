<人員管理/新增人員的彈出視窗>
<template>
  <el-dialog
    v-model="visible"
    :title="isEdit ? '編輯系統授權人員' : '新增系統授權人員'"
    width="600px"
    @close="resetForm"
  >
    <el-form :model="addForm" label-width="110px" v-loading="loadingOptions">
      
      <el-form-item :label="isEdit ? '授權員工' : '搜尋員工'" required>
        
        <el-select
          v-if="!isEdit"
          v-model="selectedEmployee"
          filterable
          remote
          reserve-keyword
          placeholder="請輸入工號或姓名搜尋"
          :remote-method="handleLdapSearch"
          :loading="ldapLoading"
          value-key="emp_id" 
          style="width: 100%"
        >
          <el-option
            v-for="item in ldapOptions"
            :key="item.emp_id"
            :label="`${item.emp_id} - ${item.name} (${item.department})`"
            :value="item"
          />
        </el-select>

        <el-input 
          v-else 
          :value="`${addForm.name} (${addForm.emp_id})`" 
          disabled 
        />
      </el-form-item>

      <el-form-item label="所屬單位" required>
        <el-select v-model="addForm.unit_id" placeholder="請選擇單位" style="width: 100%">
          <el-option 
            v-for="unit in optionsData?.units" 
            :key="unit.id" 
            :label="unit.name" 
            :value="unit.id" 
          />
        </el-select>
      </el-form-item>

      <el-form-item label="系統角色" required>
        <el-select v-model="addForm.back_role_id" placeholder="請選擇系統角色" style="width: 100%">
          <el-option 
            v-for="role in optionsData?.backRoles" 
            :key="role.id" 
            :label="role.name" 
            :value="role.id" 
          />
        </el-select>
      </el-form-item>

      <el-form-item label="前台角色">
        <el-select v-model="addForm.front_role_id" placeholder="請選擇前台角色" style="width: 100%">
          <el-option 
            v-for="role in optionsData?.frontRoles" 
            :key="role.id" 
            :label="role.name" 
            :value="role.id" 
          />
        </el-select>
      </el-form-item>
      
      <el-form-item label="閱覽地區">
        <el-select v-model="addForm.view_regions" multiple placeholder="請選擇可閱覽地區 (可複選)" style="width: 100%">
          <el-option 
            v-for="region in optionsData?.regions" 
            :key="region.id" 
            :label="region.name" 
            :value="region.id" 
          />
        </el-select>
      </el-form-item>

    </el-form>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" @click="submitAddUser">
          {{ isEdit ? '確認修改' : '確認新增' }}
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, defineExpose, defineEmits } from 'vue'
import { ElMessage } from 'element-plus'
import { searchLdapAPI } from '../../api/ldap'
import { addPermissionsAPI, updatePermissionsAPI } from '../../api/users'
import { getSystemOptionsAPI } from '../../api/system.js' // 🌟 引入拿系統選項的 API

const emit = defineEmits(['success'])
const visible = ref(false)

// --- 編輯模式新增的狀態 ---
const isEdit = ref(false)       // 判斷當前是新增還是編輯
const currentUserId = ref(null) // 紀錄編輯時的使用者 ID

// --- 系統選項狀態 ---
const loadingOptions = ref(false)
const optionsData = ref({
  units: [],
  regions: [],
  frontRoles: [],
  backRoles: []
})

// --- 表單與 LDAP 狀態 ---
const ldapLoading = ref(false)
const ldapOptions = ref([])
const selectedEmployee = ref(null)

//表單預設資料結構  (配合後端 Transaction)
const addForm = ref({ 
  emp_id: '',
  name: '',
  unit_id: '', 
  back_role_id: '',
  front_role_id: '', 
  view_regions: []
})

// 初始化：打 API 撈取所有下拉選單的選項
const fetchOptions = async () => {
  loadingOptions.value = true
  try {
    const res = await getSystemOptionsAPI()
    console.log('👀 後端傳來的選項資料：', res.data) // 除錯用
    
    if (res.data && res.data.success && res.data.data) {
      optionsData.value = res.data.data
    } else {
      console.error('資料格式不對，保持原本的空陣列')
    }
  } catch (error) {
    console.error('獲取系統選項失敗', error)
    ElMessage.error('無法載入系統選項')
  } finally {
    loadingOptions.value = false
  }
}

// 清空/還原表單
const resetForm = () => {
  selectedEmployee.value = null
  ldapOptions.value = []
  // 還原表單為預設狀態
  addForm.value = { 
    unit_id: '', 
    back_role_id: '',
    front_role_id: '', 
    view_regions: []
  }
}

// LDAP 搜尋
const handleLdapSearch = async (query) => {
  if (query) {
    ldapLoading.value = true
    try {
      const res = await searchLdapAPI(query)
      if (res.data.success) {
        ldapOptions.value = res.data.data
      }
    } catch (error) {
      console.error('LDAP 搜尋失敗', error)
      ElMessage.error('搜尋 LDAP 失敗')
    } finally {
      ldapLoading.value = false
    }
  } else {
    ldapOptions.value = []
  }
}

// 送出表單 (真的打 API)
const submitAddUser = async () => {
  if (!isEdit.value && !selectedEmployee.value) return ElMessage.warning('請先搜尋並選擇員工！')
  if (!addForm.value.back_role_id || !addForm.value.unit_id) return ElMessage.warning('請選擇後台角色與單位！')

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  // 打包大禮包
  const payload = {
    unit_id: addForm.value.unit_id,
    back_role_id: addForm.value.back_role_id,
    front_role_id: addForm.value.front_role_id,
    view_regions: addForm.value.view_regions,
    operator_id: currentUser.id
  }

  try {
    if (isEdit.value) {
      // --- 編輯模式 ---
      payload.name = addForm.value.name // 編輯時把原本的名字送回去
      
      const res = await updatePermissionsAPI(currentUserId.value, payload)
      if (res.data.success) {
        ElMessage.success('權限修改成功！')
        visible.value = false
        emit('success')
      }
    } else {
      // --- 新增模式 ---
      payload.emp_id = selectedEmployee.value.emp_id
      payload.name = selectedEmployee.value.name
      
      const res = await addPermissionsAPI(payload)
      if (res.data.success) {
        ElMessage.success('權限新增成功！')
        visible.value = false
        emit('success')
      }
    }
  } catch (error) {
    console.error('資料寫入失敗', error)
    ElMessage.error(error.response?.data?.message || '操作失敗，請聯絡系統管理員')
  }
}

// 🌟 暴露給父元件的方法 (升級版)
// 接收 mode 和當前行的資料 rowData
const open = (mode = 'add', rowData = null) => {
  visible.value = true
  isEdit.value = mode === 'edit'
  
  // 如果選項還是空的，就去後端撈
  if (optionsData.value.units.length === 0) {
    fetchOptions()
  }

  if (isEdit.value && rowData) {
    // 【編輯模式】：自動填入舊資料
    currentUserId.value = rowData.id
    addForm.value = {
      emp_id: rowData.emp_id,
      name: rowData.name,
      unit_id: rowData.unit_id,
      back_role_id: rowData.back_role_id,
      front_role_id: rowData.front_role_id || '', // 處理 null 的情況
      view_regions: rowData.view_regions_ids ? rowData.view_regions_ids.split(',').map(Number) : []
    }
  } else {
    // 【新增模式】：確保表單是乾淨的
    resetForm()
  }
}

defineExpose({ open })
</script>