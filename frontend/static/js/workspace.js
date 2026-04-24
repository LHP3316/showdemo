/**
 * Workspace page (Pixso layout + live data)
 */
(function () {
  const SNAPSHOT_MODE = true;
  const SNAPSHOT_DATA = {
    userName: "张导演",
    joinedDays: 128,
    stats: {
      total: 12,
      pendingTasks: 5,
      review: 3,
      done: 8,
    },
    tasks: [
      {
        title: "寻龙少年·第一集",
        desc: "剧本创作工位 · 剧情第1-3幕初稿待完善，导演已反馈修改意见",
        deadline: "2024-03-15",
        statusText: "进行中",
        statusClass: "is-doing",
        route: "script",
      },
      {
        title: "星际逃亡·第三集",
        desc: "分镜设计工位 · 第15-22场分镜图需要重新绘制并配置提示词",
        deadline: "2024-03-18",
        statusText: "待处理",
        statusClass: "is-pending",
        route: "storyboard",
      },
    ],
    projects: [
      {
        id: "demo-1",
        title: "寻龙少年·热血奇遇记",
        subtitle: "古风热血 · 12集 · 分镜阶段",
        statusText: "制作中",
        statusClass: "is-warn",
      },
      {
        id: "demo-2",
        title: "星际逃亡·迷途天际",
        subtitle: "科幻悬疑 · 8集 · 生成队列",
        statusText: "生成中",
        statusClass: "is-primary",
      },
      {
        id: "demo-3",
        title: "都市情缘·她的选择",
        subtitle: "都市爱情 · 6集 · 审核阶段",
        statusText: "待审核",
        statusClass: "is-success",
      },
    ],
  };

  document.addEventListener("DOMContentLoaded", async function () {
    document.body.classList.add("workspace-screen");
    bindActions();
    setText(".brand-name", "AI短剧创作台");
    setText("#btn-new-project", "新建项目");

    if (SNAPSHOT_MODE) {
      renderSnapshot();
      return;
    }

    if (!window.CommonApp || !window.api) return;
    const ok = await CommonApp.ensureSession(true);
    if (!ok) return;
    await loadDashboard();
  });

  function bindActions() {
    bindClick("#btn-refresh", function () {
      if (SNAPSHOT_MODE) {
        renderSnapshot();
        return;
      }
      loadDashboard();
    });
    bindClick("#btn-new-project", createProjectAndOpen);
    bindClick("#stat-action-project", () => safeRouteTo("project"));
    bindClick("#stat-action-task", () => safeRouteTo("script"));
    bindClick("#stat-action-review", () => safeRouteTo("review"));
    bindClick("#stat-action-done", () => safeRouteTo("export"));
  }

  function bindClick(selector, handler) {
    const node = document.querySelector(selector);
    if (!node) return;
    node.style.cursor = "pointer";
    node.addEventListener("click", handler);
  }

  async function loadDashboard() {
    try {
      const [statsRes, tasksRes, pendingRes, projectsRes] = await Promise.all([
        api.get("/projects/stats"),
        api.get("/api/tasks/tasks?size=100"),
        api.get("/api/reviews/pending?size=50"),
        api.get("/projects?size=20"),
      ]);

      const stats = (statsRes && statsRes.data) || {};
      const tasks = (tasksRes && tasksRes.data && tasksRes.data.items) || [];
      const pending = (pendingRes && pendingRes.data && pendingRes.data.items) || [];
      const projects = (projectsRes && projectsRes.data && projectsRes.data.items) || [];

      const activeTasks = tasks.filter((t) => t.status === "pending" || t.status === "processing");
      setText("#stat-total", String(stats.total || 0));
      setText("#stat-pending-tasks", String(activeTasks.length));
      setText("#stat-review", String(pending.length));
      setText("#stat-done", String(stats.approved || 0));
      setText("#tasks-count-pill", `${activeTasks.length} 个待处理`);

      if (projects[0] && projects[0].id) {
        localStorage.setItem("activeProjectId", String(projects[0].id));
      }

      patchWelcome(stats.total || 0);
      patchTaskList(activeTasks);
      patchRecentProjects(projects);
    } catch (err) {
      console.error("Failed to load workspace data:", err);
      setText("#workspace-subtitle", "数据加载失败，请点击刷新重试");
    }
  }

  function renderSnapshot() {
    const stats = SNAPSHOT_DATA.stats;
    setText("#workspace-welcome", `欢迎回来，${SNAPSHOT_DATA.userName}`);
    setText("#workspace-subtitle", `今天是您加入平台的第 ${SNAPSHOT_DATA.joinedDays} 天，共参与 ${stats.total} 个项目`);
    setText("#top-username", SNAPSHOT_DATA.userName);
    setText("#top-avatar", SNAPSHOT_DATA.userName.charAt(0));
    setText("#stat-total", String(stats.total));
    setText("#stat-pending-tasks", String(stats.pendingTasks));
    setText("#stat-review", String(stats.review));
    setText("#stat-done", String(stats.done));
    setText("#tasks-count-pill", `${stats.pendingTasks} 个待处理`);
    patchTaskListSnapshot(SNAPSHOT_DATA.tasks);
    patchRecentProjectsSnapshot(SNAPSHOT_DATA.projects);
  }

  function patchTaskListSnapshot(tasks) {
    const list = document.querySelector("#task-list");
    if (!list) return;
    list.innerHTML = tasks.map((t) => {
      return `
        <li class="item-card item-card-task">
          <h3 class="item-title">${escapeHtml(t.title)}</h3>
          <p class="item-subtitle">${escapeHtml(t.desc)}</p>
          <div class="item-foot">
            <span class="pill status-pill ${escapeHtml(t.statusClass)}">${escapeHtml(t.statusText)}</span>
            <span class="item-meta">截止：${escapeHtml(t.deadline)}</span>
            <button class="link-btn data-enter-task" data-route="${escapeHtml(t.route)}" type="button">进入工位</button>
          </div>
        </li>
      `;
    }).join("");

    list.querySelectorAll(".data-enter-task").forEach((el) => {
      el.addEventListener("click", function () {
        const route = el.getAttribute("data-route");
        if (!route) return;
        safeRouteTo(route);
      });
    });
  }

  function patchRecentProjectsSnapshot(projects) {
    const list = document.querySelector("#recent-project-list");
    if (!list) return;
    list.innerHTML = projects.map((p) => {
      const iconClass = `icon-${getIconSeed(String(p.id || ""))}`;
      return `
        <li class="item-card item-card-project data-open-project" data-id="${escapeHtml(String(p.id))}">
          <span class="project-icon ${iconClass}" aria-hidden="true"></span>
          <div class="project-main">
            <h3 class="item-title">${escapeHtml(p.title)}</h3>
            <p class="item-subtitle">${escapeHtml(p.subtitle)}</p>
          </div>
          <div class="item-foot">
            <span class="pill status-pill ${escapeHtml(p.statusClass)}">${escapeHtml(p.statusText)}</span>
            <button class="link-btn" type="button">打开项目</button>
          </div>
        </li>
      `;
    }).join("");

    list.querySelectorAll(".data-open-project").forEach((el) => {
      el.style.cursor = "pointer";
      el.addEventListener("click", function () {
        const projectId = el.getAttribute("data-id");
        if (!projectId) return;
        localStorage.setItem("activeProjectId", String(projectId));
        if (String(projectId).startsWith("demo-")) return;
        window.location.href = `project.html?id=${projectId}`;
      });
    });
  }

  function patchWelcome(totalProjects) {
    const user = safeJson(localStorage.getItem("user"));
    const name = (user && (user.display_name || user.username)) || "User";
    const first = name.charAt(0).toUpperCase();
    setText("#workspace-welcome", `欢迎回来，${name}`);
    setText("#workspace-subtitle", `今天共参与 ${totalProjects} 个项目`);
    setText("#top-username", name);
    setText("#top-avatar", first);
  }

  function patchTaskList(tasks) {
    const list = document.querySelector("#task-list");
    if (!list) return;

    if (!tasks.length) {
      list.innerHTML = taskEmptyHtml();
      return;
    }

    list.innerHTML = tasks.slice(0, 4).map((t) => {
      const sceneText = `任务类型：${escapeHtml(t.task_type || "-")} · 进度 ${escapeHtml(String(t.progress || 0))}%`;
      const due = formatDate(t.created_at || t.updated_at || new Date().toISOString());
      const route = t.task_type === "img2video" ? "render" : "script";
      return `
        <li class="item-card item-card-task">
          <h3 class="item-title">任务 #${t.id}</h3>
          <p class="item-subtitle">${sceneText}</p>
          <div class="item-foot">
            <span class="pill">${escapeHtml(mapTaskStatus(t.status))} · ${escapeHtml(due)}</span>
            <button class="link-btn data-enter-task" data-route="${route}" type="button">进入工位</button>
          </div>
        </li>
      `;
    }).join("");

    list.querySelectorAll(".data-enter-task").forEach((el) => {
      el.addEventListener("click", function () {
        const route = el.getAttribute("data-route");
        if (!route) return;
        safeRouteTo(route);
      });
    });
  }

  function patchRecentProjects(projects) {
    const list = document.querySelector("#recent-project-list");
    if (!list) return;

    if (!projects.length) {
      list.innerHTML = projectEmptyHtml();
      return;
    }

    list.innerHTML = projects.slice(0, 4).map((p) => {
      const iconClass = `icon-${getIconSeed(String(p.id || ""))}`;
      return `
        <li class="item-card item-card-project data-open-project" data-id="${p.id}">
          <span class="project-icon ${iconClass}" aria-hidden="true"></span>
          <div class="project-main">
            <h3 class="item-title">${escapeHtml(p.title || "未命名项目")}</h3>
            <p class="item-subtitle">${escapeHtml(p.genre || "未分类")} · ${p.episode_count || 0}集 · ${escapeHtml(mapProjectStatus(p.status))}</p>
          </div>
          <div class="item-foot">
            <span class="pill">${escapeHtml(mapProjectStatus(p.status))}</span>
            <button class="link-btn" type="button">打开项目</button>
          </div>
        </li>
      `;
    }).join("");

    list.querySelectorAll(".data-open-project").forEach((el) => {
      el.style.cursor = "pointer";
      el.addEventListener("click", function () {
        const projectId = el.getAttribute("data-id");
        if (!projectId) return;
        localStorage.setItem("activeProjectId", String(projectId));
        window.location.href = `project.html?id=${projectId}`;
      });
    });
  }

  async function createProjectAndOpen() {
    if (SNAPSHOT_MODE) return;
    if (!window.api) return;
    try {
      const now = new Date();
      const title = `新项目 ${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
      const res = await api.post("/projects/", {
        title,
        description: "创建于工作台快捷入口",
        genre: "custom",
        episode_count: 1,
      });
      const projectId = res && res.data && res.data.id;
      if (!projectId) return;
      localStorage.setItem("activeProjectId", String(projectId));
      window.location.href = `project.html?id=${projectId}`;
    } catch (err) {
      console.error("Create project failed:", err);
    }
  }

  function taskEmptyHtml() {
    return `
      <li class="item-card">
        <h3 class="item-title">暂无任务</h3>
        <p class="item-subtitle">当前没有待处理任务，新的任务会自动出现在这里。</p>
      </li>
    `;
  }

  function projectEmptyHtml() {
    return `
      <li class="item-card">
        <h3 class="item-title">暂无项目</h3>
        <p class="item-subtitle">点击“新建项目”即可开始创作。</p>
      </li>
    `;
  }

  function mapProjectStatus(status) {
    const map = {
      draft: "草稿",
      processing: "制作中",
      review: "待审核",
      approved: "已完成",
      rejected: "已驳回",
    };
    return map[status] || "制作中";
  }

  function mapTaskStatus(status) {
    const map = {
      pending: "待处理",
      processing: "进行中",
      completed: "已完成",
      failed: "失败",
    };
    return map[status] || "待处理";
  }

  function getIconSeed(idText) {
    const seedMap = ["gold", "purple", "green"];
    let total = 0;
    for (let i = 0; i < idText.length; i += 1) {
      total += idText.charCodeAt(i);
    }
    return seedMap[total % seedMap.length];
  }

  function setText(selector, text) {
    const node = document.querySelector(selector);
    if (node) node.textContent = text;
  }

  function formatDate(raw) {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "-";
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function pad2(v) {
    return String(v).padStart(2, "0");
  }

  function safeJson(raw) {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function escapeHtml(text) {
    return String(text || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function safeRouteTo(route) {
    if (window.CommonApp && typeof CommonApp.routeTo === "function") {
      CommonApp.routeTo(route);
    }
  }
})();

