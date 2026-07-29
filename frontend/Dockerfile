# ==========================================
# Stage 1: Build (打包階段)
# ==========================================
FROM node:20-alpine as build-stage

WORKDIR /app

# 複製 package.json 並安裝所有依賴 (包含 Vite 等編譯工具)
COPY package*.json ./
RUN npm install

# 複製前端原始碼並執行 Vite 打包指令
COPY . .
RUN npm run build

# ==========================================
# Stage 2: Production (正式運行階段 - Nginx)
# ==========================================
# ... 上面的 build-stage 保持不變 ...

FROM nginx:stable-alpine as production-stage

COPY --from=build-stage /app/dist /usr/share/nginx/html

# 🌟 用 COPY 取代原本危險的 RUN echo
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]