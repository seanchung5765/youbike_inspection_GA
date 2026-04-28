<template>
  <el-dialog v-model="visible" :title="isEdit ? '編輯閱覽權限' : '新增閱覽權限'" width="550px">
    <el-form label-position="top" v-loading="loading">
      <el-form-item label="選擇人員" v-if="!isEdit" required>
        <el-select v-model="formData.user_id" placeholder="請搜尋同單位人員" filterable style="width: 100%">
          <el-option 
            v-for="user in userOptions" :key="user.id" 
            :label="`${user.name} (${user.emp_id}) [${user.front_role_name || '無前台角色'}]`" 
            :value="user.id" 
          />
        </el-select>
      </el-form-item>

      <el-form-item :label="isEdit ? `修改 [${currentUserName}] 的閱覽權限` : '勾選閱覽地區'" required>
        <el-checkbox-group v-model="formData.region_ids" class="region-grid">
          <el-checkbox v-for="r in regionOptions" :key="r.id" :label="r.id" border>{{ r.name }}</el-checkbox>
        </el-checkbox-group>
        <div class="notice">※ 地區範圍受限於所屬單位授權區域 [cite: 300]</div>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="submit" :loading="submitting">確認配置</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getUnitAllowedRegionsAPI, getUnitUsersAPI, saveViewerPermissionAPI } from '../../api/viewers'

const visible = ref(false), loading = ref(false), submitting = ref(false), isEdit = ref(false)
const userOptions = ref([]), regionOptions = ref([]), currentUserName = ref('')
const formData = ref({ user_id: null, region_ids: [] })
const emit = defineEmits(['success'])

const open = async (mode, row = null) => {
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}')
  visible.value = true; isEdit.value = mode === 'edit'; loading.value = true
  
  try {
    // 🌟 關鍵 1：只能抓取自己單位授權的地區 [cite: 270]
    const regRes = await getUnitAllowedRegionsAPI(currentUser.unit_id)
    regionOptions.value = regRes.data.data

    if (isEdit.value) {
      currentUserName.value = row.name
      formData.value = { 
        user_id: row.id, 
        region_ids: row.view_regions_ids ? row.view_regions_ids.split(',').map(Number) : [] 
      }
    } else {
      formData.value = { user_id: null, region_ids: [] }
      // 🌟 關鍵 2：只能選擇同單位的人員
      const userRes = await getUnitUsersAPI(currentUser.unit_id)
      userOptions.value = userRes.data.data
    }
  } catch (e) { ElMessage.error('載入失敗') } finally { loading.value = false }
}

const submit = async () => {
  if (!formData.value.user_id || formData.value.region_ids.length === 0) return ElMessage.warning('請完整填寫')
  submitting.value = true
  try {
    const opId = JSON.parse(localStorage.getItem('user')).id
    await saveViewerPermissionAPI({ ...formData.value, operator_id: opId })
    ElMessage.success('權限配置成功'); visible.value = false; emit('success')
  } catch (e) { ElMessage.error('儲存失敗') } finally { submitting.value = false }
}
defineExpose({ open })
</script>

<style scoped>
.region-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.notice { font-size: 12px; color: #f56c6c; margin-top: 10px; }
</style>