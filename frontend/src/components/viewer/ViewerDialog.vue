<閱覽管理的彈出視窗>
<template>
  <el-dialog :title="isEdit ? '編輯閱覽權限' : '新增閱覽權限'" v-model="visible" width="500px">
    <el-form :model="formData" label-width="80px">
      
      <el-form-item label="人員" v-if="!isEdit">
        <el-select 
          v-model="formData.emp_id" 
          filterable 
          remote 
          reserve-keyword
          placeholder="請輸入關鍵字搜尋 LDAP" 
          :remote-method="searchLdap"
          :loading="searching"
          @change="handleUserSelect"
          style="width: 100%"
        >
          <el-option 
            v-for="item in userOptions" 
            :key="item.emp_id" 
            :label="`${item.name} (${item.emp_id}) - ${item.department}`" 
            :value="item.emp_id" 
          />
        </el-select>
      </el-form-item>
      
      <el-form-item label="人員" v-else>
        <el-input :value="currentUserName" disabled />
      </el-form-item>

      <el-form-item label="閱覽地區">
        <el-select v-model="formData.region_ids" multiple placeholder="請選擇地區群組" style="width: 100%">
          <el-option v-for="reg in regionOptions" :key="reg.id" :label="reg.name" :value="reg.id" />
        </el-select>
      </el-form-item>

    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="submit" :loading="submitting">確定儲存</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import axios from 'axios'

//使用 Vite 的環境變數來決定後端 API 的網址
// 本地開發時會是 localhost，上雲端時會讀取雲端的正式網址
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const visible = ref(false)
const isEdit = ref(false)
const userOptions = ref([])
const regionOptions = ref([])
const currentUserName = ref('')
const submitting = ref(false)
const searching = ref(false)
const excludeEmpIds = ref([]) // 🌟 黑名單：用來存放自己與已經有權限的人

// 🚨 注意：這裡改成存 emp_id 和 name，因為 LDAP 來的還沒有本機 ID
const formData = ref({ emp_id: null, name: '', region_ids: [] })
const hiddenRegionIds = ref([])
let currentUser = {}

const open = async (mode, row = null) => {
  visible.value = true
  isEdit.value = mode === 'edit'
  
  formData.value = { emp_id: null, name: '', region_ids: [] }
  userOptions.value = []
  regionOptions.value = []
  
  const userString = localStorage.getItem('user')
  if (!userString) return ElMessage.error('請先登入')
  currentUser = JSON.parse(userString)

  try {
    // 1. 撈取該單位可用的地區
    const resReg = await axios.get(`${API_BASE_URL}/api/viewers/unit-regions?user_id=${currentUser.id}`)
    if (resReg.data.success) regionOptions.value = resReg.data.data

    if (isEdit.value) {
      currentUserName.value = row.name
      // 編輯時我們依然傳原本資料庫裡的 user_id
      // 將資料庫裡該員工「所有的地區 ID」轉成陣列
      const allUserRegions = row.view_regions_ids ? row.view_regions_ids.split(',').map(Number) : []
      // 取得目前這位主管「有權限看到的地區 ID」清單
      const allowedRegionIds = regionOptions.value.map(r => r.id)
      // 只把「主管有權限的地區」放進 formData，讓它顯示在選單裡
      formData.value = { 
        user_id: row.id, 
        region_ids: allUserRegions.filter(id => allowedRegionIds.includes(id)) 
      }
      //把「主管沒權限的地區 (3, 4, 5)」暗中存起來，不顯示在畫面上
      hiddenRegionIds.value = allUserRegions.filter(id => !allowedRegionIds.includes(id))
    } else {
      // 2. 🌟 建立黑名單：去要目前已經在名單上的人 (用你原本的清單 API 即可)
     const resViewers = await axios.get(`${API_BASE_URL}/api/viewers`, {
        params: { unit_id: currentUser.unit_id, role_level: currentUser.role_level, user_id: currentUser.id }
      })
      if (resViewers.data.success) {
        // 把清單上的人的工號抓出來，再加上自己的工號
        excludeEmpIds.value = resViewers.data.data.map(v => v.emp_id)
        excludeEmpIds.value.push(currentUser.emp_id) // 排除自己
      }
    }
  } catch (e) { ElMessage.error('載入失敗') }
}

// 🌟 當你在下拉選單打字時，去呼叫 LDAP
const searchLdap = async (query) => {
  if (query) {
    searching.value = true
    try {
      const res = await axios.get(`${API_BASE_URL}/api/ldap/search?q=${query}`)
      if (res.data.success) {
        // 🌟 完美過濾：只顯示「不在黑名單 (excludeEmpIds)」裡面的人！
        userOptions.value = res.data.data.filter(u => !excludeEmpIds.value.includes(u.emp_id))
      }
    } catch (e) { console.error(e) }
    finally { searching.value = false }
  } else {
    userOptions.value = []
  }
}

// 記下選中人員的姓名，等一下要一起傳給後端建檔
const handleUserSelect = (val) => {
  const selectedUser = userOptions.value.find(u => u.emp_id === val)
  if (selectedUser) formData.value.name = selectedUser.name
}

const submit = async () => {
  if ((!isEdit.value && !formData.value.emp_id) || formData.value.region_ids.length === 0) {
    return ElMessage.warning('人員與閱覽地區不可為空')
  }
  submitting.value = true
  try {
   const url = isEdit.value ? `${API_BASE_URL}/api/viewers/${formData.value.user_id}` : `${API_BASE_URL}/api/viewers`
    const method = isEdit.value ? 'put' : 'post'

    // 送出前，把畫面上編輯的地區，跟剛剛暗中保留的高階地區「合併」起來
    const finalRegionIds = [...formData.value.region_ids, ...hiddenRegionIds.value]
    
    await axios[method](url, {
      ...formData.value,
      region_ids: finalRegionIds,// 傳送合併後的完整清單給後端
      operator_id: currentUser.id
    })
    ElMessage.success(isEdit.value ? '權限更新成功' : '權限新增成功')
    visible.value = false
    emit('success')
  } catch (e) { ElMessage.error('儲存失敗') }
  finally { submitting.value = false }
}

const emit = defineEmits(['success'])
defineExpose({ open })
</script>