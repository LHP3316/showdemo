# AI短剧生产平台：前端生成模型 Prompt（协作版）

你现在是一个资深前端产品开发助手。请根据以下“产品目标 + 角色 + 页面 + 交互 + 状态机 + 约束”生成一个可运行的前端应用（以 SPA 形态实现）。

## 1. 目标
- 构建“创作协作前端”，不是后台管理系统。
- 核心是多账号、多步骤、可回流的生产流程。
- 主流程：剧本 -> 分镜 -> 图片 -> 视频 -> 审核 -> 导出。

## 2. 角色与权限
- Director（导演）：创建项目、分配任务、发起审核、导出。
- Writer（编剧）：编辑剧本并提交到分镜阶段。
- StoryboardArtist（分镜师）：编辑分镜卡、维护 prompt、触发文生图。
- Generator（生成师）：触发图生视频、处理失败重试。
- Reviewer（审核）：对项目快照进行通过/驳回。

要求：
- 登录后按角色展示不同入口和操作按钮。
- 禁止越权操作（非审核角色不能通过/驳回）。

## 3. 页面清单（必须实现）
1. 登录页 `#/login`
2. 我的工作区 `#/workspace`
3. 项目驾驶舱 `#/project/:id`
4. 剧本工位 `#/project/:id/script`
5. 分镜工位 `#/project/:id/storyboard`
6. 生成队列 `#/project/:id/render`
7. 审核会话 `#/project/:id/review`
8. 导出中心 `#/project/:id/export`

## 4. 页面核心交互

### 4.1 我的工作区
- 展示“待我处理”“我负责项目”“待我审核”。
- 用任务卡片展示，不要后台表格风格。
- 卡片应显示：项目名、当前步骤、负责人、更新时间、下一步动作。

### 4.2 项目驾驶舱
- 顶部：步骤条（高亮当前步骤）。
- 中部：阻塞提醒（例如“分镜未提交，无法进入生成”）。
- 底部：时间线（提交、驳回、转交记录）。

### 4.3 分镜工位（重点）
- 左：分镜卡片列表（可切换、可排序）。
- 中：当前分镜预览（图/视频）。
- 右：编辑面板（角色、场景、镜头、情绪、台词、prompt）。
- 底部：评论/反馈区。
- 动作：保存、提交、批量生成、失败重试、转交。

### 4.4 审核会话
- 审核对象是“项目版本快照”。
- 支持通过/驳回。
- 驳回时审核意见必填，且可指定回流步骤。

## 5. 状态机（前端必须内建）

### 5.1 项目状态
- draft
- script_ready
- storyboard_in_progress
- render_in_progress
- in_review
- approved
- rejected
- exported

### 5.2 分镜状态
- todo -> editing -> image_ready -> video_ready -> accepted

规则：
- 未完成前置步骤时，后续操作按钮置灰并解释原因。
- 每一步必须有“提交动作”和状态反馈（loading/success/error）。

## 6. UI与体验约束
- 这是创作工作台，不是后台管理台。
- 首页必须是“我的工作区”，不是系统菜单页。
- 以卡片、步骤条、画布、时间线为主，不以大表格为主。
- 页面有明确“当前责任人”和“下一步动作”。
- 支持桌面端与移动端基本可用。

## 7. 技术约束
- 使用 HTML/CSS/原生 JS（可用 Tailwind CDN）。
- 使用 hash 路由。
- 封装统一 API 客户端、全局状态、角色守卫。
- 避免整页反复刷新；提交后优先局部更新。

## 8. 接口契约（可先 mock）
- `POST /auth/login`
- `GET /auth/me`
- `GET /workspace/my-tasks`
- `GET /workspace/my-projects`
- `GET /projects/:id`
- `POST /projects/:id/transition`
- `GET /projects/:id/scenes`
- `PUT /scenes/:sceneId`
- `POST /scenes/:sceneId/lock`
- `POST /scenes/:sceneId/unlock`
- `POST /scenes/:sceneId/generate-image`
- `POST /scenes/:sceneId/generate-video`
- `POST /projects/:id/review/approve`
- `POST /projects/:id/review/reject`

## 9. 输出要求
- 给出完整目录结构。
- 给出关键页面代码与核心组件代码。
- 给出路由、权限守卫、状态管理、API 封装实现。
- 给出可直接运行步骤。
- 若接口未就绪，提供 mock 数据与 mock API 层。

---

## 可直接追加的一句话（给生成模型）
“请优先生成前端协作体验，不要生成后台管理系统风格；先保证多角色流程闭环，再补充视觉细节。”
