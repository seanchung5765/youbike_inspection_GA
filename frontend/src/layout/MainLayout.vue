<外框地圖。定義了畫面上的頂部標題（鍾翔宇 ▽）和左側選單列。>
<template>
  <el-container class="layout-container">
    <el-aside width="200px" class="aside">
      <div class="logo">YouBike 後台</div>
      
      <el-menu
        active-text-color="#ffd04b"
        background-color="#304156"
        text-color="#fff"
        :default-active="$route.path"
        router
        class="el-menu-vertical"
      >
        <el-menu-item index="/dashboard">
          <el-icon><DataLine /></el-icon>
          <span>系統首頁</span>
        </el-menu-item>

        <template v-for="menu in menuList" :key="menu.id">
          <el-sub-menu v-if="menu.children && menu.children.length > 0" :index="String(menu.id)">
            <template #title>
              <el-icon><component :is="menu.icon_code || 'Menu'" /></el-icon>
              <span>{{ menu.name }}</span>
            </template>
            <el-menu-item 
              v-for="child in menu.children" 
              :key="child.id" 
              :index="child.route_code"
            >
              {{ child.name }}
            </el-menu-item>
          </el-sub-menu>

          <el-menu-item v-else :index="menu.route_code">
            <el-icon><component :is="menu.icon_code || 'Document'" /></el-icon>
            <span>{{ menu.name }}</span>
          </el-menu-item>
        </template>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="header">
        <div class="header-left"></div>
        <div class="header-right">
          <el-dropdown @command="handleCommand">
            <span class="user-info">
              {{ userName }} <el-icon class="el-icon--right"><arrow-down /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="logout">登出</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <el-main class="main-content">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getMenusAPI } from '../api/menus'

const router = useRouter()
const userName = ref('使用者')
const menuList = ref([]) 

// 將扁平陣列轉為樹狀結構
const buildTree = (data) => {
  const tree = []
  const lookup = {}

  // 1. 先把所有的項目放進字典裡 (強制把 ID 轉成字串)
  data.forEach(item => {
    const idStr = String(item.id)
    lookup[idStr] = { ...item, children: [] }
  })

  // 2. 把子項目塞進父項目的 children 陣列中
  data.forEach(item => {
    const idStr = String(item.id)
    
    // 寬容判斷：只要是 null 或是沒填，就是最上層父選單
    if (item.parent_id === null || item.parent_id === undefined) {
      tree.push(lookup[idStr])
    } else {
      // 如果有爸爸，把爸爸的 ID 也轉字串去字典裡找
      const parentIdStr = String(item.parent_id)
      if (lookup[parentIdStr]) {
        lookup[parentIdStr].children.push(lookup[idStr])
      } else {
        // 找不到爸爸的孤兒，也先當作父選單顯示出來
        tree.push(lookup[idStr])
      }
    }
  })
  return tree
}

// 畫面載入時執行
onMounted(async () => {
  // 1. 抓取登入時存的資料
  const userString = localStorage.getItem('user')
  if (!userString) {
    ElMessage.error('尚未登入，請先登入')
    router.push('/login')
    return
  }

  const user = JSON.parse(userString)
  userName.value = user.name || user.emp_id

  // 2. 拿使用者的 role (權限 ID) 去跟後端要選單
  try {
    const res = await getMenusAPI(user.role)
    if (res.data.success) {
      // 把後端給的陣列，轉換成有層級的樹狀結構！
      menuList.value = buildTree(res.data.data)
    }
  } catch (error) {
    console.error('抓取選單失敗', error)
    ElMessage.error('抓取選單失敗，請聯絡系統管理員')
  }
})

// 處理右上角下拉選單點擊
const handleCommand = (command) => {
  if (command === 'logout') {
    localStorage.removeItem('user') 
    ElMessage.success('已登出系統')
    router.push('/login') 
  }
}

</script>

<style scoped>
.layout-container {
  height: 100vh;
}
.aside {
  background-color: #304156;
  color: white;
}
.logo {
  height: 60px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 18px;
  font-weight: bold;
  border-bottom: 1px solid #1f2d3d;
  color: #ffd04b;
}
.el-menu-vertical {
  border-right: none;
}
.header {
  background-color: #fff;
  border-bottom: 1px solid #e6e6e6;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
}
.user-info {
  cursor: pointer;
  display: flex;
  align-items: center;
  font-weight: bold;
}
.main-content {
  background-color: #f0f2f5;
  padding: 20px;
}
</style>