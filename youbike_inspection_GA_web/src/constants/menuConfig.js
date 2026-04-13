export const menuConfig = [
  {
    title: "業務分析報表",
    group: "analysis", // 程式判斷用 ID
    icon: "📈",         // 加上組別大圖標，開闔時更好看
    items: [
      { name: "首頁數據", path: "/HomeView/DashboardView", icon: "📊", roles: ["USER", "ADMIN"] },
      { name: "YouBike 流量分析", path: "/HomeView/TrafficReport", icon: "🚲", roles: ["USER", "ADMIN"] },
      { name: "站點異常統計", path: "/HomeView/ErrorLogReport", icon: "⚠️", roles: ["ADMIN"] },
    ]
  },
  {
    title: "管理控制台",
    group: "management",
    icon: "⚙️",
    items: [
      { name: "權限控制", path: "/HomeView/UserPermissionsView", icon: "👤", roles: ["ADMIN"] }
    ]
  }
];