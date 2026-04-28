// 導航地圖。決定網址輸入 /user 時，畫面要切換到哪一個頁面
import { createRouter, createWebHistory } from 'vue-router'
import Login from '../views/Login.vue' //login 頁面
import MainLayout from '../layout/MainLayout.vue' // 引入大外殼
import Dashboard from '../views/Dashboard.vue'    // 引入首頁
import UserManagement from '../views/UserManagement.vue' // 引入人員管理
import UnitManagement from '../views/UnitManagement.vue'// 引入單位權限

// 定義路由規則 (網址對應到哪個頁面)
const routes = [
  {
    path: '/login',
    name: 'Login',
    component: Login
  },
  {
    // 根目錄設定為大外殼
    path: '/',
    component: MainLayout,
    redirect: '/dashboard', // 預設導向 dashboard
    //children 裡面的頁面，都會被塞進 MainLayout 的 <router-view /> 裡面
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: Dashboard
      },
      {
        path: 'UserAuth', 
        name: 'UserAuth',
        component: UserManagement
      },
      {
        path: 'UnitAuth', 
        name: 'UnitAuth',
        component: UnitManagement
      },
      {
        path: '/ViewAuth',
        name: 'ViewAuth',
        component: () => import('../views/ViewAuthView.vue'), 
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router