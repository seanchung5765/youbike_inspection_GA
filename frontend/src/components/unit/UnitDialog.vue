<template>
  <el-dialog
    v-model="visible"
    :title="isEdit ? `編輯 [${currentUnitName}] 權限範圍` : '新增單位與權限'"
    width="550px"
    @close="resetForm"
  >
    <el-form label-position="top" v-loading="loading">
      
      <el-form-item label="單位名稱" required v-if="!isEdit">
        <el-input 
          v-model="unitName" 
          placeholder="請輸入單位名稱" 
          maxlength="50"
          show-word-limit
        />
      </el-form-item>

      <el-form-item label="請勾選此單位可視的地區 (可多選)">
        <el-checkbox-group v-model="selectedRegions" class="region-checkbox-group">
          <el-checkbox 
            v-for="region in allRegions" 
            :key="region.id" 
            :label="region.id"
            border
            class="region-checkbox"
          >
            {{ region.name }}
          </el-checkbox>
        </el-checkbox-group>
      </el-form-item>
    </el-form>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" @click="submitForm" :loading="submitting">
          {{ isEdit ? '儲存權限' : '新增' }}
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getSystemOptionsAPI } from '../../api/system' 
// 🌟 記得要多引入 addUnitAPI
import { updateUnitRegionsAPI, addUnitAPI } from '../../api/units' 

const emit = defineEmits(['success'])

const visible = ref(false)
const loading = ref(false)
const submitting = ref(false)

// 🌟 新增模式判斷開關與欄位
const isEdit = ref(false)
const unitName = ref('') // 存新增時的單位名稱

const currentUnitId = ref(null)
const currentUnitName = ref('')
const allRegions = ref([]) 
const selectedRegions = ref([]) 

// 🌟 修改 open 方法，接收 mode 參數
const open = async (mode, row = null) => {
  visible.value = true
  isEdit.value = mode === 'edit' // 判斷是否為編輯模式
  
  if (isEdit.value && row) {
    // 【編輯模式】：自動填入舊資料
    currentUnitId.value = row.id
    currentUnitName.value = row.unit_name
    selectedRegions.value = row.allowed_regions_ids 
      ? row.allowed_regions_ids.split(',').map(Number) 
      : []
  } else {
    // 【新增模式】：確保表單是乾淨的
    currentUnitId.value = null
    currentUnitName.value = ''
    unitName.value = ''
    selectedRegions.value = []
  }

  // 撈取所有地區選項
  if (allRegions.value.length === 0) {
    fetchRegions()
  }
}

const fetchRegions = async () => {
  loading.value = true
  try {
    const res = await getSystemOptionsAPI()
    if (res.data?.success) {
      allRegions.value = res.data.data.regions
    }
  } catch (error) {
    ElMessage.error('無法載入地區選項')
  } finally {
    loading.value = false
  }
}

// 🌟 結合新增與編輯的送出邏輯
const submitForm = async () => {
  // 防呆檢查
  if (!isEdit.value && !unitName.value.trim()) {
    return ElMessage.warning('請輸入單位名稱！')
  }
  if (selectedRegions.value.length === 0) {
    return ElMessage.warning('請至少選擇一個地區！')
  }

  submitting.value = true
  try {
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}')
    
    // 共用的大禮包
    const payload = {
      region_ids: selectedRegions.value,
      operator_id: currentUser.id
    }

    let res;
    if (isEdit.value) {
      // 編輯 API
      res = await updateUnitRegionsAPI(currentUnitId.value, payload)
    } else {
      // 新增 API (要把單位名稱塞進去)
      payload.unit_name = unitName.value
      res = await addUnitAPI(payload)
    }

    if (res.data.success) {
      ElMessage.success(isEdit.value ? '單位權限更新成功' : '單位新增成功')
      visible.value = false
      emit('success')
    }
  } catch (error) {
    // 如果後端吐出 400 (例如名稱重複)，可以直接顯示後端的錯誤訊息
    ElMessage.error(error.response?.data?.message || '操作失敗，請聯絡系統管理員')
  } finally {
    submitting.value = false
  }
}

const resetForm = () => {
  unitName.value = ''
  selectedRegions.value = []
}

defineExpose({ open })
</script>

<style scoped>
.region-checkbox-group {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.region-checkbox {
  margin-right: 0 !important;
  width: 100%;
}
</style>