//登入畫面
<template>
  <div class="login-container">
    <el-card class="login-card">
      <template #header>
        <div class="login-header">
          <h2>YouBike 管理系統</h2>
          <p>請輸入工號與密碼登入</p>
        </div>
      </template>

      <el-form :model="loginForm" :rules="rules" ref="loginFormRef">
        <el-form-item prop="username">
          <el-input 
            v-model="loginForm.username" 
            placeholder="工號 (例如: GB5765)" 
            prefix-icon="User"
          />
        </el-form-item>

        <el-form-item prop="password">
          <el-input 
            v-model="loginForm.password" 
            type="password" 
            placeholder="LDAP 密碼" 
            prefix-icon="Lock"
            show-password
            @keyup.enter="handleLogin"
          />
        </el-form-item>

        <el-form-item>
          <el-button 
            type="primary" 
            class="login-button" 
            :loading="loading" 
            @click="handleLogin"
          >
            登入
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { loginAPI } from '../api/auth'

const router = useRouter()
const loginFormRef = ref(null)
const loading = ref(false)

// 1. 表單資料
const loginForm = reactive({
  username: '',
  password: ''
})

// 2. 表單驗證規則
const rules = {
  username: [{ required: true, message: '請輸入工號', trigger: 'blur' }],
  password: [{ required: true, message: '請輸入密碼', trigger: 'blur' }]
}

// 3. 登入邏輯
const handleLogin = async () => {
  if (!loginFormRef.value) return

  // 先驗證欄位是否有填寫
  await loginFormRef.value.validate(async (valid) => {
    if (valid) {
      loading.value = true
      try {
        // 🌟 串接後端 API (這裡就是你在 Postman 測試的網址)
          const response = await loginAPI({
          username: loginForm.username,
          password: loginForm.password
        })

        if (response.data.success) {
          ElMessage.success('登入成功！')
          
          // 💾 將使用者資訊存入 localStorage (或是你之後會用的 Pinia)
          localStorage.setItem('user', JSON.stringify(response.data.user))
          
          // 🚀 導向後台首頁 (假設你的首頁路由名稱是 'Dashboard')
          router.push('/dashboard')
        }
      } catch (error) {
        console.error('登入錯誤:', error)
        // 處理後端回傳的錯誤訊息 (401, 403 等)
        const errMsg = error.response?.data?.message || '登入失敗，請檢查網路連線'
        ElMessage.error(errMsg)
      } finally {
        loading.value = false
      }
    }
  })
}
</script>

<style scoped>
.login-container {
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #f5f7fa;
}

.login-card {
  width: 400px;
}

.login-header {
  text-align: center;
}

.login-header h2 {
  margin: 0;
  color: #409eff;
}

.login-header p {
  color: #909399;
  font-size: 14px;
}

.login-button {
  width: 100%;
  margin-top: 10px;
}
</style>