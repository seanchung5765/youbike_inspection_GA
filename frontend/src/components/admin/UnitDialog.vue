<template>
  <el-dialog
    v-model="visible"
    :title="isEdit ? `編輯 [${formData.name}] 權限` : '新增單位與權限'"
    :width="isMobile ? '95%' : '550px'"
    @close="resetForm"
  >
    <el-form label-position="top" v-loading="loading">
      <el-form-item label="單位名稱" required >
        <el-input v-model="formData.name" placeholder="請輸入單位名稱" maxlength="50" show-word-limit />
      </el-form-item>

      <el-form-item label="請勾選此單位可視的地區 (可多選)">
        <el-checkbox-group v-model="formData.region_ids" class="region-checkbox-group">
          <el-checkbox v-for="region in allRegions" :key="region.id" :value="region.id" border class="region-checkbox">
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
import { ref, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getSystemOptionsAPI } from '../../api/system' 
import { updateUnitRegionsAPI, addUnitAPI } from '../../api/units' 

const emit = defineEmits(['success'])
const visible = ref(false)
const loading = ref(false)
const submitting = ref(false)
const isEdit = ref(false)
const allRegions = ref([]) 
const formData = ref({ id: null, name: '', region_ids: [] })

// 🌟 手機版偵測
const isMobile = ref(false);
const checkMobile = () => { isMobile.value = window.innerWidth <= 768; }

onMounted(() => { checkMobile(); window.addEventListener('resize', checkMobile); })
onUnmounted(() => { window.removeEventListener('resize', checkMobile); })

const open = async (mode, row = null) => {
  visible.value = true
  isEdit.value = mode === 'edit'
  if (isEdit.value && row) {
    formData.value = { id: row.id, name: row.unit_name || row.name, region_ids: row.allowed_regions_ids ? row.allowed_regions_ids.split(',').map(Number) : [] }
  } else { formData.value = { id: null, name: '', region_ids: [] } }
  if (allRegions.value.length === 0) fetchRegions()
}

const fetchRegions = async () => {
  loading.value = true
  try {
    const res = await getSystemOptionsAPI()
    if (res.data?.success) allRegions.value = res.data.data.regions
  } catch (error) { ElMessage.error('無法載入選項') } finally { loading.value = false }
}

const submitForm = async () => {
  if (!isEdit.value && !formData.value.name.trim()) return ElMessage.warning('請輸入名稱！')
  if (formData.value.region_ids.length === 0) return ElMessage.warning('請選擇地區！')

  submitting.value = true
  try {
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}')
    const payload = { name: formData.value.name, region_ids: formData.value.region_ids, operator_id: currentUser.id }
    let res = isEdit.value ? await updateUnitRegionsAPI(formData.value.id, payload) : await addUnitAPI(payload)
    if (res.data.success) { ElMessage.success('操作成功'); visible.value = false; emit('success') }
  } catch (error) { ElMessage.error('操作失敗') } finally { submitting.value = false }
}

const resetForm = () => { formData.value = { id: null, name: '', region_ids: [] } }
defineExpose({ open })
</script>

<style scoped>
.region-checkbox-group { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.region-checkbox { margin-right: 0 !important; width: 100%; }

/* 📱 手機版調整 Checkbox 排版 */
@media (max-width: 768px) {
  .region-checkbox-group { grid-template-columns: repeat(2, 1fr); }
}
</style>