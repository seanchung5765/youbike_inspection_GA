<template>
  <div class="bg-slate-50 flex flex-col h-screen overflow-hidden font-sans">
    <header class="h-16 bg-slate-800 text-white flex items-center justify-between px-4 shadow-md z-40 border-b-4 border-orange-600 flex-shrink-0">
      <div class="flex items-center space-x-4">
        <button @click="sidebarOpen = !sidebarOpen" class="p-2 rounded-md hover:bg-orange-600 transition">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div class="text-xl font-black tracking-wider text-orange-500">
          YouBike1.0<span class="text-white">模擬體驗後台</span>
        </div>
      </div>

      <div class="relative" @mouseenter="clearMenuTimer" @mouseleave="startMenuTimer">
        <button @click="userMenuOpen = !userMenuOpen" class="flex items-center space-x-2 hover:opacity-80 transition">
          <div class="text-right hidden sm:block">
            <p class="font-bold text-sm leading-tight">{{ user.name }}</p>
            <p class="text-[10px] text-orange-400 font-mono">{{ user.role }}</p>
          </div>
          <div class="w-9 h-9 rounded-full bg-orange-600 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
            </svg>
          </div>
        </button>
        
        <transition
          enter-active-class="transition duration-100 ease-out"
          enter-from-class="transform scale-95 opacity-0"
          enter-to-class="transform scale-100 opacity-100"
          leave-active-class="transition duration-75 ease-in"
          leave-from-class="transform scale-100 opacity-100"
          leave-to-class="transform scale-95 opacity-0"
        >
          <div v-if="userMenuOpen" class="absolute right-0 mt-2 w-48 bg-white border rounded shadow-xl py-1 z-50 text-slate-800 ring-1 ring-black ring-opacity-5">
            <button @click="logout" class="w-full text-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition">
              登出系統
            </button>
          </div>
        </transition>
      </div>
    </header>

    <div class="flex flex-1 overflow-hidden relative">
      <div v-if="sidebarOpen" @click="sidebarOpen = false" class="lg:hidden absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-40"></div>

      <aside 
        :class="sidebarOpen ? 'translate-x-0 w-72' : '-translate-x-full w-0'" 
        class="bg-slate-900 text-slate-300 shadow-2xl z-30 transform transition-all duration-300 ease-in-out overflow-y-auto flex-shrink-0"
      >
        <nav class="p-4 space-y-2 w-72"> <div v-for="group in filteredMenu" :key="group.title" class="mb-4">
            
            <button 
              @click="toggleGroup(group.title)"
              class="w-full flex items-center justify-between px-3 py-2 text-[10px] text-slate-500 uppercase font-bold tracking-widest hover:text-orange-400 transition-colors"
            >
              <span>{{ group.title }}</span>
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                class="h-3 w-3 transition-transform duration-300" 
                :class="openGroups[group.title] ? 'rotate-180' : ''"
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <transition
              enter-active-class="transition-[max-height,opacity] duration-300 ease-out"
              enter-from-class="max-h-0 opacity-0"
              enter-to-class="max-h-[1000px] opacity-100"
              leave-active-class="transition-[max-height,opacity] duration-200 ease-in"
              leave-from-class="max-h-[1000px] opacity-100"
              leave-to-class="max-h-0 opacity-0"
            >
              <div v-show="openGroups[group.title]" class="space-y-1 mt-1 overflow-hidden">
                <a 
                  v-for="item in group.items" 
                  :key="item.path"
                  href="#" 
                  @click.prevent="router.push(item.path)"
                  class="block px-4 py-3 rounded-lg hover:bg-slate-800 transition text-sm ml-2"
                  :class="currentPath === item.path ? 'bg-slate-800 text-orange-400 font-bold border-l-4 border-orange-500' : ''"
                >
                  <span class="mr-2">{{ item.icon }}</span> {{ item.name }}
                </a>
              </div>
            </transition>

          </div>
        </nav>
      </aside>

      <main class="flex-1 bg-white overflow-y-auto p-0">
        <RouterView /> 
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter, useRoute, RouterView } from 'vue-router';
import { menuConfig } from '@/constants/menuConfig';

const router = useRouter();
const route = useRoute();

// --- 狀態定義 ---
const sidebarOpen = ref(true); 
const userMenuOpen = ref(false);
const user = ref({ name: '讀取中...', role: 'USER' });

// 當前路徑（用於側邊欄高亮）
const currentPath = computed(() => route.path);

const openGroups = ref({
  '業務分析報表': false,
  '管理控制台': false
});

const toggleGroup = (title) => {
  openGroups.value[title] = !openGroups.value[title];
};

// --- 權限過濾邏輯 ---
const filteredMenu = computed(() => {
  return menuConfig.map(group => ({
    ...group,
    items: group.items.filter(item => item.roles.includes(user.value.role))
  })).filter(group => group.items.length > 0);
});

// --- 用戶選單自動關閉定時器 ---
let menuTimer = null;
const startMenuTimer = () => { menuTimer = setTimeout(() => { userMenuOpen.value = false; }, 500); };
const clearMenuTimer = () => { if (menuTimer) { clearTimeout(menuTimer); menuTimer = null; } };

// --- 初始化獲取權限 ---
onMounted(async () => {
  try {
    const res = await fetch('http://localhost:3000/api/me', { credentials: 'include' });
    const data = await res.json();
    
    // 直接信任後端判定的角色，或是判定 role 欄位是否為 'ADMIN'
    const roleFromBackend = (data.user?.role || 'USER').toUpperCase();
    
    user.value = {
      name: data.user?.cn || '使用者',
      role: roleFromBackend // 不再檢查特定工號
    };
  } catch (err) {
    console.warn("後端 API 連線失敗，進入開發者預設權限");
    user.value = { name: '開發測試員', role: 'ADMIN' };
  }
});

// --- 登出 ---
const logout = () => { 
  if (confirm("確定要登出嗎？")) {
    router.push('/'); 
  }
};
</script>

<style scoped>
/* 確保側邊欄捲動條樣式美化（可選） */
aside::-webkit-scrollbar {
  width: 4px;
}
aside::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 10px;
}
</style>