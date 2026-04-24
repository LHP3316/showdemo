# AI短剧协作台 - 电影工业风UI重塑

## 设计方向
- **风格**: 暗色电影工业风 (类似 DaVinci Resolve / Premiere Pro)
- **导航**: 去掉左侧边栏，改为顶部横条导航
- **布局**: 沉浸式全宽工作区，去掉管理后台的"卡片+表格"模式
- **色调**: 深色底(#0a0e1a) + 冷蓝渐变光效 + 玻璃态面板
- **视觉元素**: 电影胶片、场记板、时间线轨道、进度流水线

## 改造任务

### Task 1: 框架层 - 布局与导航重构
**文件**: `index.html`, `css/style.css`, `js/app.js`
- index.html: 去掉 aside#sidebar，改为顶部导航 + 全宽内容区
- style.css: 全面重写，加入电影工业风设计变量、渐变光效、玻璃态、动画
- app.js: 更新 _renderLayout 逻辑，去掉 Sidebar/Header 调用，改用 TopNav + BreadcrumbBar

### Task 2: 导航组件重构
**文件**: `js/components/sidebar.js` -> 重写为 `js/components/topnav.js`, `js/components/header.js` -> 重写为 `js/components/breadcrumb.js`
- topnav.js: 顶部横条导航，左侧品牌Logo + 导航标签页，右侧用户信息+退出
- breadcrumb.js: 二级面包屑栏，显示当前项目名+当前工位，带步骤条迷你预览
- 注: 由于index.html中script标签引用的是sidebar.js和header.js，我们直接在这两个文件中改写内容，保持文件名不变避免改html

### Task 3: 通用组件视觉升级
**文件**: `js/components/Stepper.js`, `TaskCard.js`, `SceneCard.js`, `Timeline.js`, `AssigneePill.js`, `ReviewDialog.js`, `modal.js`
- Stepper: 改为横向轨道式步骤条，带发光节点和连线
- TaskCard: 改为宽幅任务条，左侧状态灯+中间信息+右侧动作，像剪辑软件的轨道
- SceneCard: 改为缩略图卡片，带序号角标和状态指示
- Timeline: 改为竖向时间轴，带节点发光和连线
- AssigneePill: 改为头像圆点+名字的胶囊
- ReviewDialog/modal: 加毛玻璃背景和圆角

### Task 4: 登录页电影化
**文件**: `js/pages/login.js`
- 全屏暗色渐变背景 + 电影胶片动画装饰
- 居中玻璃态登录卡片
- 品牌Logo大写 + 副标题
- 角色选择改为可视化角色卡片而非下拉框

### Task 5: 工作区 - 从仪表盘到创作台
**文件**: `js/pages/workspace.js`
- 去掉数字统计卡片，改为"今日待办"轨道视图
- 项目列表改为宽幅海报卡片(左侧渐变色块+右侧信息)
- 添加"快速开始"入口区(创建新项目大按钮)
- 整体像剪辑软件的项目启动页

### Task 6: 项目驾驶舱 - 从仪表盘到制片控制台
**文件**: `js/pages/project-cockpit.js`
- 顶部大号步骤条(全宽轨道)
- 中部三栏: 左侧项目信息面板(玻璃态) + 中部场景网格预览 + 右侧动态
- 阻塞提醒改为顶部警示条(红/黄色横幅)
- 时间线改为底部横向滚动轨道

### Task 7: 剧本工位 - 沉浸式写作
**文件**: `js/pages/script-workbench.js`
- 居中全高写作区域(类似 Final Draft)
- 左侧窄栏: 项目信息+步骤状态
- 底部固定操作栏: 保存/提交按钮
- 去掉右侧"操作说明"侧栏

### Task 8: 分镜工位 - 剪辑台风格
**文件**: `js/pages/storyboard-workbench.js`
- 左侧: 垂直胶片条(缩略图列表，可滚动)
- 中部: 大画面预览区(16:9比例)
- 右侧: 紧凑参数面板(折叠式分组)
- 底部: 迷你操作条(文生图/图生视频/保存/提交)

### Task 9: 生成队列 - 渲染管线视图
**文件**: `js/pages/render-queue.js`
- 改为横向管线视图: 每个分镜一行，左到右显示 图片生成->视频生成 状态
- 进度用发光条而非badge文字
- 批量操作按钮在顶部工具栏

### Task 10: 审核会话 - 放映室风格
**文件**: `js/pages/review-session.js`
- 上方: 大画面轮播预览区
- 下方: 审核操作面板(通过/驳回+意见输入)
- 右侧窄栏: 审核历史记录

### Task 11: 导出中心 - 交付打包
**文件**: `js/pages/export-center.js`
- 顶部: 项目完成状态横幅(带动画)
- 中部: 资产网格(缩略图+下载)
- 底部: 一键导出按钮

## 技术约束
- 保持 HTML/CSS/原生JS + Tailwind CDN 技术栈不变
- 保持所有API调用和数据流逻辑不变
- 保持路由和权限守卫逻辑不变
- 只改视觉层和布局层，不改业务逻辑
