<template>
  <el-dialog
    v-model="visible"
    :title="isEdit ? `編輯 [${formData.name}] 權限範圍` : '新增單位與權限'"
    width="550px"
    @close="resetForm"
  >
    <el-form label-position="top" v-loading="loading">
      
      <el-form-item label="單位名稱" required >
        <el-input 
          v-model="formData.name" 
          placeholder="請輸入單位名稱" 
          maxlength="50"
          show-word-limit
        />
      </el-form-item>

      <el-form-item label="請勾選此單位可視的地區 (可多選)">
        <el-checkbox-group v-model="formData.region_ids" class="region-checkbox-group">
          <el-checkbox 
            v-for="region in allRegions" 
            :key="region.id" 
            :value="region.id"  border
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
import { updateUnitRegionsAPI, addUnitAPI } from '../../api/units' 

const emit = defineEmits(['success'])

const visible = ref(false)
const loading = ref(false)
const submitting = ref(false)
const isEdit = ref(false)
const allRegions = ref([]) 

// 🌟 1. 宣告統一的表單變數 (把那些零碎的變數都淘汰掉)
const formData = ref({
  id: null,
  name: '',
  region_ids: []
})

// 🌟 2. 乾淨的 open 方法
const open = async (mode, row = null) => {
  visible.value = true
  isEdit.value = mode === 'edit'
  
  if (isEdit.value && row) {
    formData.value = { 
      id: row.id, 
      name: row.unit_name || row.name, // 確保抓到名字
      region_ids: row.allowed_regions_ids ? row.allowed_regions_ids.split(',').map(Number) : []
    }
  } else {
    formData.value = { id: null, name: '', region_ids: [] }
  }

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

// 🌟 3. 送出邏輯：全面改用 formData
const submitForm = async () => {
  // 防呆檢查改看 formData
  if (!isEdit.value && !formData.value.name.trim()) {
    return ElMessage.warning('請輸入單位名稱！')
  }
  if (formData.value.region_ids.length === 0) {
    return ElMessage.warning('請至少選擇一個地區！')
  }

  submitting.value = true
  try {
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}')
    
    // 把資料打包好
    const payload = {
      name: formData.value.name, // 單位名稱 (後端 PUT/POST 應該都是收 name)
      region_ids: formData.value.region_ids, // 勾選的地區陣列
      operator_id: currentUser.id
    }

    let res;
    if (isEdit.value) {
      // 編輯 API (帶入 formData 的 id)
      res = await updateUnitRegionsAPI(formData.value.id, payload)
    } else {
      // 新增 API
      res = await addUnitAPI(payload)
    }

    if (res.data.success) {
      ElMessage.success(isEdit.value ? '單位權限更新成功' : '單位新增成功')
      visible.value = false
      emit('success')
    }
  } catch (error) {
    ElMessage.error(error.response?.data?.message || '操作失敗，請聯絡系統管理員')
  } finally {
    submitting.value = false
  }
}

// 🌟 4. 關閉時清空
const resetForm = () => {
  formData.value = { id: null, name: '', region_ids: [] }
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