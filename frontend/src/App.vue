// 前端的最外層容器
<template>
  <router-view />
</template>

<script setup>
// 目前不需要寫什麼邏輯
</script>

<style>
/* 簡單清除一下瀏覽器預設的邊界 */
body {
  margin: 0;
  padding: 0;
  font-family: 'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB',
  'Microsoft YaHei', '微軟正黑', Arial, sans-serif;
}
</style>