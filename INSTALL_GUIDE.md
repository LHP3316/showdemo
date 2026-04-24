# 🚀 安装与启动指南

## 📦 前置依赖安装

### 1. Node.js 和 npm

**Windows 系统：**

1. 访问 [Node.js 官网](https://nodejs.org/)
2. 下载 LTS 版本（推荐 v20.x 或更高）
3. 运行安装程序，保持默认选项
4. 验证安装：
   ```bash
   node --version
   npm --version
   ```

**或使用 Chocolatey（包管理器）：**
```bash
choco install nodejs-lts
```

---

## 🔧 前端依赖安装

### 步骤 1：进入前端目录
```bash
cd D:\Project\showdemo\frontend\react
```

### 步骤 2：安装核心依赖
```bash
npm install
```

### 步骤 3：安装额外依赖（如果 package.json 中没有）
```bash
# HTTP 客户端
npm install axios

# 路由（如果还没安装）
npm install react-router-dom

# 工具库（可选）
npm install dayjs clsx
```

### 步骤 4：安装开发依赖（如果需要）
```bash
# TypeScript 类型定义
npm install --save-dev @types/react @types/react-dom

# Vite 插件（如果需要）
npm install --save-dev @vitejs/plugin-react
```

### 验证安装
```bash
# 查看已安装的包
npm list --depth=0

# 检查 node_modules 目录
ls node_modules
```

---

## 🐍 后端依赖安装

### 方式 1：使用 Conda（推荐）

```bash
# 激活环境
conda activate showdemo

# 进入后端目录
cd D:\Project\showdemo\backend

# 安装 Python 依赖
pip install -r requirements.txt
```

### 方式 2：使用 venv

```bash
# 创建虚拟环境
python -m venv venv

# 激活环境（Windows）
venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt
```

### 核心依赖清单
```
fastapi>=0.104.0
uvicorn>=0.24.0
sqlalchemy>=2.0.0
pymysql>=1.1.0
pydantic>=2.5.0
python-jose[cryptography]>=3.3.0
passlib[bcrypt]>=1.7.4
python-multipart>=0.0.6
httpx>=0.25.0
python-dotenv>=1.0.0
```

---

## 🗄️ 数据库初始化

### 步骤 1：确保 MySQL 运行
```bash
# Windows 服务
net start MySQL80

# 或使用 MySQL 客户端
mysql -u root -p
```

### 步骤 2：创建数据库
```sql
CREATE DATABASE IF NOT EXISTS showdemo 
DEFAULT CHARACTER SET utf8mb4 
DEFAULT COLLATE utf8mb4_unicode_ci;
```

### 步骤 3：导入数据库脚本
```bash
# Windows PowerShell
cd D:\Project\showdemo\backend
Get-Content init_db_v2.sql | mysql -u root -p showdemo

# 或使用 MySQL 命令行
mysql -u root -p showdemo < init_db_v2.sql
```

### 步骤 4：验证数据库
```bash
mysql -u root -p showdemo -e "SHOW TABLES;"
```

应该看到以下表：
- users
- projects
- scenes
- reviews
- review_comments
- task_queue
- prompt_configs

---

## 🔑 环境变量配置

### 后端 .env 文件

创建或更新 `backend/.env`：

```env
# 数据库配置
DATABASE_URL=mysql+pymysql://root:your_password@localhost:3306/showdemo

# JWT 密钥（请更换为随机字符串）
SECRET_KEY=your-secret-key-here-change-this
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# 管理员账号（首次初始化使用）
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=admin123
DEFAULT_ADMIN_ROLE=director

# GeekNow AI API（如果需要AI生成功能）
GEEKNOW_API_KEY=your-geeknow-api-key
GEEKNOW_API_URL=https://api.geeknow.com

# CORS 配置
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5500
```

---

## 🚀 启动服务

### 启动后端

```bash
# 进入后端目录
cd D:\Project\showdemo\backend

# 激活 Conda 环境
conda activate showdemo

# 启动开发服务器（自动重载）
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 或生产模式
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

**验证后端：**
- 访问：http://localhost:8000
- API 文档：http://localhost:8000/docs
- 健康检查：http://localhost:8000/health

### 启动前端

```bash
# 进入前端目录
cd D:\Project\showdemo\frontend\react

# 启动开发服务器
npm run dev

# 或指定端口
npm run dev -- --port 5173
```

**验证前端：**
- 访问：http://localhost:5173
- 登录页会自动打开

---

## ✅ 验证清单

### 后端验证
- [ ] MySQL 服务运行正常
- [ ] 数据库 showdemo 已创建
- [ ] 7个数据表已导入
- [ ] Python 依赖已安装
- [ ] .env 配置正确
- [ ] 后端服务启动成功（端口 8000）
- [ ] API 文档可访问（/docs）
- [ ] 可以登录（admin/admin123）

### 前端验证
- [ ] Node.js 已安装（v20+）
- [ ] npm 依赖已安装
- [ ] node_modules 目录存在
- [ ] 前端服务启动成功（端口 5173）
- [ ] 登录页显示正常
- [ ] 可以成功登录
- [ ] 路由跳转正常
- [ ] API 调用正常

---

## 🐛 常见问题

### 1. npm install 失败

**错误：** `npm ERR! code ENOENT`

**解决：**
```bash
# 清理缓存
npm cache clean --force

# 删除 node_modules 和 package-lock.json
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json

# 重新安装
npm install
```

### 2. 端口被占用

**错误：** `Port 8000 is already in use`

**解决：**
```bash
# 查找占用端口的进程（Windows）
netstat -ano | findstr :8000

# 终止进程
taskkill /PID <PID> /F
```

### 3. 数据库连接失败

**错误：** `Can't connect to MySQL server`

**解决：**
```bash
# 检查 MySQL 服务
Get-Service MySQL80

# 启动服务
Start-Service MySQL80

# 测试连接
mysql -u root -p -e "SELECT 1;"
```

### 4. TypeScript 类型错误

**错误：** `找不到模块 "react"`

**解决：**
```bash
# 安装类型定义
npm install --save-dev @types/react @types/react-dom

# 或重新安装所有依赖
npm install
```

### 5. CORS 错误

**错误：** `No 'Access-Control-Allow-Origin' header`

**解决：**
- 检查 `.env` 中的 `ALLOWED_ORIGINS`
- 确保包含前端地址：`http://localhost:5173`
- 重启后端服务

---

## 📝 快速启动脚本

### Windows PowerShell 一键启动

创建 `start-all.ps1`：

```powershell
# 启动后端
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd D:\Project\showdemo\backend; conda activate showdemo; python -m uvicorn app.main:app --reload --port 8000"

# 等待2秒
Start-Sleep -Seconds 2

# 启动前端
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd D:\Project\showdemo\frontend\react; npm run dev"

Write-Host "✅ 所有服务已启动！" -ForegroundColor Green
Write-Host "后端: http://localhost:8000" -ForegroundColor Cyan
Write-Host "前端: http://localhost:5173" -ForegroundColor Cyan
```

运行：
```powershell
.\start-all.ps1
```

---

## 🎯 下一步

安装完成后：

1. **测试登录**
   - 访问：http://localhost:5173
   - 账号：admin
   - 密码：admin123

2. **查看 API 文档**
   - 访问：http://localhost:8000/docs
   - 测试各个接口

3. **创建第一个项目**
   - 登录后进入工作台
   - 点击"创建项目"
   - 填写项目信息

4. **开始使用**
   - 剧本创作
   - 分镜管理
   - AI 生成
   - 审核流程

---

## 📞 需要帮助？

如果遇到问题：

1. 查看日志文件：
   - 后端：`backend/logs/`
   - 前端：浏览器控制台

2. 检查配置：
   - `.env` 文件
   - `package.json` 版本
   - `requirements.txt` 版本

3. 重新初始化：
   ```bash
   # 数据库
   mysql -u root -p showdemo < backend/init_db_v2.sql
   
   # 前端依赖
   cd frontend/react && npm install
   ```

---

**祝你使用愉快！** 🎬✨
