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
            :label="`${item.name} (${item.emp_id}) - ${item.department || '無單位'}`" 
            :value="item.emp_id" 
          />
        </el-select>
      </el-form-item>
      
      <el-form-item label="人員" v-else>
        <el-input v-model="currentUserName" disabled />
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
import { searchLdapAPI } from '../../api/ldap'
// 🌟 引入封裝好的 API 函式 (已對齊 viewers.js 名稱)
import { 
  getUnitAllowedRegionsAPI, 
  getViewersAPI, 
  getEligibleUsersAPI, 
  addViewerAPI, 
  updateViewerAPI 
} from '../../api/viewers'

const excludeEmpIds = ref([])

const visible = ref(false)
const isEdit = ref(false)
const userOptions = ref([])
const regionOptions = ref([])
const currentUserName = ref('')
const submitting = ref(false)
const searching = ref(false)

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
      const resReg = await getUnitAllowedRegionsAPI(currentUser.id)
      if (resReg.data.success) regionOptions.value = resReg.data.data

    if (isEdit.value) {
      currentUserName.value = row.name
      
      // 🌟 1. 安全轉型：確保字串切割後，每一個 ID 都是真正的 Number
      const allUserRegions = row.view_regions_ids 
        ? String(row.view_regions_ids).split(',').map(Number) 
        : []
        
      // 🌟 2. 安全轉型：確保從 API 撈回來的可用地區 ID 也全部都是 Number
      const allowedRegionIds = regionOptions.value.map(r => Number(r.id))

      formData.value = { 
        user_id: row.id, 
        // 🌟 這樣過濾時，Number 比對 Number，絕對不會再失誤！
        region_ids: allUserRegions.filter(id => allowedRegionIds.includes(id)) 
      }
      hiddenRegionIds.value = allUserRegions.filter(id => !allowedRegionIds.includes(id))
    } else {
        // 🌟 3. 復活黑名單建立邏輯 (針對新增模式)
        const resViewers = await getViewersAPI({ 
          unit_id: currentUser.unit_id, 
          role_level: currentUser.role_level, 
          user_id: currentUser.id 
        })
        if (resViewers.data.success) {
          // 把畫面上已經有權限的工號全部塞進黑名單
          excludeEmpIds.value = resViewers.data.data.map(v => v.emp_id)
          excludeEmpIds.value.push(currentUser.emp_id) // 當然也要排除自己
        }
      }
    } catch (e) { ElMessage.error('載入失敗') }
  }

// 🌟 處理人員選單的搜尋 
const searchLdap = async (query) => {
  if (query) {
    searching.value = true
    try {
      // 🎯 1. 修正：把包裝的物件拿掉，直接傳 query 字串！
      const res = await searchLdapAPI(query) 
      
      if (res.data.success) {
        // 🎯 2. 黑名單過濾：拿 LDAP 回傳的名單，踢掉在黑名單裡的人
        userOptions.value = res.data.data.filter(u => 
          !excludeEmpIds.value.includes(u.emp_id)
        )
      }
    } catch (e) { 
      console.error('LDAP 搜尋失敗:', e) 
    } finally { 
      searching.value = false 
    }
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
    // 送出前，把畫面上編輯的地區，跟剛剛暗中保留的高階地區「合併」起來
    const finalRegionIds = [...formData.value.region_ids, ...hiddenRegionIds.value]
    
    const payload = {
      ...formData.value,
      region_ids: finalRegionIds, // 傳送合併後的完整清單給後端
      operator_id: currentUser.id
    }

    // 🌟 根據模式判斷呼叫 新增 或 更新 API
    if (isEdit.value) {
      await updateViewerAPI(formData.value.user_id, payload)
    } else {
      await addViewerAPI(payload)
    }

    ElMessage.success(isEdit.value ? '權限更新成功' : '權限新增成功')
    visible.value = false
    emit('success')
  } catch (e) { ElMessage.error('儲存失敗') }
  finally { submitting.value = false }
}

const emit = defineEmits(['success'])
defineExpose({ open })
</script>