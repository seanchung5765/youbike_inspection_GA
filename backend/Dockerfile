# 宣告使用 Node.js 官方輕量版映像檔
FROM node:20-alpine

# 設定雲端容器內的工作目錄
WORKDIR /app

# 先複製依賴清單以善用 Docker 快取機制
COPY package*.json ./

# 安裝專案相依套件
RUN npm install

# 複製其餘所有後端程式碼（會自動避開 .gcloudignore 裡宣告忽略的檔案）
COPY . .

# 暴露後端 API 運行的 Port (例如 3000，請依你的專案調整)
EXPOSE 3000

# 啟動後端伺服器的指令 (請依你的 package.json 內的 start script 調整，例如 node server.js)
CMD ["node", "server.js"]