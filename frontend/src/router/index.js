//frontend/src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import Login from '../views/Login.vue' 
import MainLayout from '../layout/MainLayout.vue' 

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: Login
  },
  {
    path: '/photo-viewer',
    name: 'PhotoViewer',
    component: () => import('../views/PhotoViewer.vue'), // 路徑請依照你實際放的位置調整
    meta: { requiresAuth: true } // 💡 視情況決定要不要擋權限 (看下方說明)
  },
  {
    path: '/',
    component: MainLayout,
    redirect: '/dashboard', 
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('../views/Dashboard.vue'), 
      },
      // 📂 1. 權限管理 (route_code: admin-root)
      {
        path: 'admin',
        children: [
          {
            path: 'unit-management',
            name: 'unit-management',
            component: () => import('../views/admin/UnitManagement.vue'), 
          },
          {
            path: 'user-management',
            name: 'user-management',
            component: () => import('../views/admin/UserManagement.vue'), 
          },
          {
            path: 'view-auth',
            name: 'view-auth',
            component: () => import('../views/admin/ViewAuthView.vue'), 
          }
        ]
      },
      // 📂 2. 資料管理 (route_code: DataGroup)
      {
        path: 'data',
        children: [
          {
            path: 'monthly-sync',
            name: 'monthly-sync',
            component: () => import('../views/dataprocess/SyncManager.vue'), 
          },
          {
            path: 'data-edit',      
            name: 'data-edit',
            component: () => import('../views/dataprocess/DataEditList.vue'), 
          },
        ]
      },
      // 📂 3. 系統設定 (route_code: SystemGroup)
      {
        path: 'System',
        children: [
          {
            path: 'scoring-rules',      
            name: 'scoring-rules',
            component: () => import('../views/system/ScoringRules.vue'), 
          }
        ]
      },
      // 📂 4. 報表統計 (route_code: ReportGroup)  <-- 🌟 新增這裡！
      {
        path: 'report',
        children: [
          {
            path: 'total-score',      
            name: 'total-score',
            // 請確認你的檔案建在這個路徑下
            component: () => import('../views/report/SummaryDashboard.vue'), 
          }
        ]
      },
      // 📂 5. 問題表
      /*{
        path: 'report',
        children: [
          {
            path: 'city-issue',      
            name: 'city-issue',
            // 請確認你的檔案建在這個路徑下
      //      component: () => import('../views/report/DefectGallery.vue'), 
      //    }
      ]
      },*/
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router