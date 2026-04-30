//登入畫面
<template>
  <div class="login-wrapper">
    <div class="login-card">
      
      <!-- 頂部 Logo 與標題 -->
      <div class="card-header">
        <div class="logo-box">YB</div>
        <h1 class="card-title">YouBike 模擬體驗後台系統</h1>
      </div>

      <!-- 表單區域 -->
      <el-form 
        :model="loginForm" 
        :rules="rules" 
        ref="loginFormRef"
        label-position="top"
        class="login-form"
      >
        <el-form-item label="帳號" prop="username">
          <el-input 
            v-model="loginForm.username" 
            placeholder="例如 : GB1234" 
            class="custom-input"
          />
        </el-form-item>

        <el-form-item label="密碼" prop="password">
          <el-input 
            v-model="loginForm.password" 
            type="password" 
            placeholder="••••••••" 
            show-password
            class="custom-input"
            @keyup.enter="handleLogin"
          />
        </el-form-item>

        <el-form-item class="submit-item">
          <el-button 
            type="primary" 
            class="submit-btn" 
            :loading="loading" 
            @click="handleLogin"
          >
            登入
          </el-button>
        </el-form-item>
      </el-form>

    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'//可以做到即時更新
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'//負責噴彈出畫面"登入成功"之類的
import { loginAPI } from '../api/auth'

const router = useRouter()
const loginFormRef = ref(null)//確認是否輸入帳密
const loading = ref(false)

// 1. 表單資料
const loginForm = reactive({
  username: '',
  password: ''
})

// 2. 表單驗證規則
const rules = {
  username: [{ required: true, message: '請輸入工號', trigger: 'blur' }],//required意思不准空白。trigger點開輸入框立刻檢查
  password: [{ required: true, message: '請輸入密碼', trigger: 'blur' }]
}

// 3. 登入邏輯
const handleLogin = async () => {
  if (!loginFormRef.value) return // 先驗證欄位是否有填寫
  await loginFormRef.value.validate(async (valid) => {//.validate是內建驗證功能
    if (valid) {
      loading.value = true
      try {
        // 串接後端 API
          const response = await loginAPI({
          username: loginForm.username,
          password: loginForm.password
        })

        if (response.data.success) {
          ElMessage.success('登入成功！')
          
          // 將使用者資訊轉成字串存進瀏覽器
          localStorage.setItem('user', JSON.stringify(response.data.user))
          
          // 導向後台首頁 (假設你的首頁路由名稱是 'Dashboard')
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
/* 頁面背景：淡淡的灰藍底色 */
.login-wrapper {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #f0f3f6; /* 原圖背景色 */
  font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
}

/* 卡片主體：精準比例與圓角 */
.login-card {
  width: 420px;            /* 寬度與原圖比例一致 */
  background: #ffffff;
  border-radius: 20px;     /* 大圓角 */
  padding: 45px 40px;      /* 內部大量的呼吸空間 */
  box-shadow: 0px 10px 40px rgba(0, 0, 0, 0.05); /* 柔和的立體陰影 */
}

/* 頂部區域 */
.card-header {
  display: flex;
  align-items: center;
  gap: 15px;               /* Logo 與文字的距離 */
  margin-bottom: 40px;     /* 距離下方表單的高度 */
}

.logo-box {
  width: 52px;
  height: 52px;
  background-color: #0f172a; /* 深色背景 */
  color: #ffffff;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 14px;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 1px;
}

.card-title {
  font-size: 24px;
  color: #0f172a;
  margin: 0;
  font-weight: 500;
  letter-spacing: 0.5px;
}

/* 表單與標籤 */
.login-form :deep(.el-form-item) {
  margin-bottom: 24px; /* 每個輸入框之間的距離 */
}

.login-form :deep(.el-form-item__label) {
  color: #64748b;        /* 原圖淡淡的灰藍色字體 */
  font-size: 14px;
  padding-bottom: 8px !important; /* 標籤與輸入框的距離 */
  line-height: 1;
}

/* 覆寫 Element Plus 輸入框外觀，做到 1:1 還原 */
.custom-input :deep(.el-input__wrapper) {
  background-color: #ffffff;
  border: 1px solid #cbd5e1; /* 原圖的淺灰色細邊框 */
  box-shadow: none !important; /* 拿掉 Element Plus 預設藍色光暈 */
  border-radius: 12px;
  padding: 2px 15px; /* 控制高度 */
  height: 48px;
  transition: all 0.2s ease;
}

/* 點擊輸入框時邊框變深色 */
.custom-input :deep(.el-input__wrapper.is-focus) {
  border-color: #64748b;
}

.custom-input :deep(.el-input__inner) {
  color: #334155;
  font-size: 16px;
}

/* 修改 Placeholder 的顏色，讓它像原圖一樣淡 */
.custom-input :deep(.el-input__inner::placeholder) {
  color: #94a3b8;
}

/* 按鈕區域 */
.submit-item {
  margin-top: 10px; 
  margin-bottom: 0 !important;
}

.submit-btn {
  width: 100%;
  height: 52px;
  background-color: #0f172a !important; /* 深黑藍色 */
  border-color: #0f172a !important;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 500;
  letter-spacing: 2px; /* 原圖「登入」字樣略微拉開 */
}

.submit-btn:hover {
  background-color: #1e293b !important; /* 滑鼠移過去稍微變淡 */
  border-color: #1e293b !important;
}

/* 底部文字 (helloworld) */
.card-footer {
  margin-top: 35px;
  padding-top: 25px;
  border-top: 1px solid #e2e8f0; /* 一條極細的淺色分隔線 */
  color: #64748b;
  font-size: 13px;
  font-family: monospace; /* 原圖 "helloworld" 字體看起來有一點像代碼字體 */
}
</style>