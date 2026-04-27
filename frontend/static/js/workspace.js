/**
 * Workspace page (Pixso layout + live data)
 */
(function () {
  const SNAPSHOT_MODE = false;
  let currentUser = null;
  let staffUsers = [];
  let createProjectModalNode = null;
  let dashboardLoading = false;
  let createProjectSubmitting = false;

  document.addEventListener("DOMContentLoaded", async function () {
    document.body.classList.add("workspace-screen");
    bindActions();

    if (SNAPSHOT_MODE) {
      renderSnapshotFallback();
      return;
    }

    if (!window.CommonApp || !window.api) return;
    const ok = await CommonApp.ensureSession(true);
    if (!ok) return;
    currentUser = safeJson(localStorage.getItem("user"));
    // 兜底：有些情况下 localStorage.user 可能未及时写入或被清空
    if (!currentUser) {
      try {
        const me = await api.get("/auth/me");
        localStorage.setItem("user", JSON.stringify(me));
        currentUser = me;
      } catch {
        // ignore
      }
    }
    applyRoleLayout();
    // 兜底：即使后端接口暂时不可用，也先把欢迎语填上（避免一直显示 User）
    patchWelcome(0);
    // 兜底：某些浏览器/样式更新后可能导致事件丢失，二次绑定确保可点击
    bindActions();
    await loadDashboard();
  });

  function bindActions() {
    bindClick("#btn-refresh", function () {
      loadDashboard({ manual: true });
    });
    bindClick("#btn-new-project", createProjectAndOpen);
    bindClick("#stat-action-project", () => safeRouteTo("project"));
    bindClick("#stat-action-task", () => safeRouteTo(isDirector() ? "project" : "storyboard"));
    bindClick("#stat-action-review", () => safeRouteTo("review"));
    bindClick("#stat-action-done", () => safeRouteTo("export"));
  }

  function bindClick(selector, handler) {
    const node = document.querySelector(selector);
    if (!node) return;
    if (node.dataset.boundClick === "1") return;
    node.dataset.boundClick = "1";
    node.style.cursor = "pointer";
    node.addEventListener("click", handler);
  }

  async function loadDashboard(options = {}) {
    if (dashboardLoading) return;
    dashboardLoading = true;
    setRefreshLoading(true);
    try {
      const requests = [
        api.get("/projects/stats"),
        api.get("/api/tasks/tasks?size=100"),
        api.get("/projects?size=20"),
      ];
      if (isDirector()) {
        requests.push(api.get("/api/reviews/pending?size=50"));
        requests.push(api.get("/auth/users"));
      } else {
        requests.push(Promise.resolve({ data: { items: [] } }));
        requests.push(Promise.resolve([]));
      }
      const [statsRes, tasksRes, projectsRes, pendingRes, usersRes] = await Promise.all(requests);

      const stats = (statsRes && statsRes.data) || {};
      const tasks = (tasksRes && tasksRes.data && tasksRes.data.items) || [];
      const projects = (projectsRes && projectsRes.data && projectsRes.data.items) || [];
      const pending = (pendingRes && pendingRes.data && pendingRes.data.items) || [];
      const users = Array.isArray(usersRes) ? usersRes : [];
      staffUsers = users.filter((u) => u && u.role === "staff");

      const activeTasks = tasks.filter((t) =>
        t && (t.status === "pending" || t.status === "processing" || t.status === "running" || t.status === "success")
      );

      const staffFallbackTasks = isDirector() ? [] : buildProjectLevelTasks(projects);
      const staffTaskCount = isDirector() ? 0 : ((activeTasks.length ? activeTasks.length : staffFallbackTasks.length));

      setText("#stat-total", String(stats.total || 0));
      setText("#stat-pending-tasks", String(isDirector() ? activeTasks.length : staffTaskCount));
      setText("#stat-review", String(isDirector() ? pending.length : (stats.review || 0)));
      setText("#stat-done", String(stats.approved || 0));
      setText("#tasks-count-pill", isDirector() ? `${pending.length} 个待审核` : `${staffTaskCount} 个待处理`);

      if (projects[0] && projects[0].id) {
        localStorage.setItem("activeProjectId", String(projects[0].id));
      }

      patchWelcome(stats.total || 0);
      if (isDirector()) {
        patchDirectorTaskPanel(projects, pending);
        patchDirectorProjectList(projects);
      } else {
        patchStaffTaskList(activeTasks, projects);
        patchStaffProjectList(projects);
      }
      if (options.manual) {
        setText("#workspace-subtitle", "数据已刷新");
      }
    } catch (err) {
      console.error("Failed to load workspace data:", err);
      setText("#workspace-subtitle", "数据加载失败，请点击刷新重试");
    } finally {
      dashboardLoading = false;
      setRefreshLoading(false);
    }
  }

  function patchDirectorTaskPanel(projects, pending) {
    const list = document.querySelector("#task-list");
    if (!list) return;

    const unassigned = projects.filter((p) => !p.assigned_to);
    const queue = []
      .concat(unassigned.map((p) => ({ type: "assign", project: p })))
      .concat(pending.map((p) => ({ type: "review", project: p })));

    if (!queue.length) {
      list.innerHTML = `
        <li class="item-card item-card-empty">
          <h3 class="item-title">暂无导演待办</h3>
          <p class="item-subtitle">项目分配与审核任务将在这里显示。</p>
        </li>
      `;
      return;
    }

    list.innerHTML = queue.slice(0, 6).map((item) => {
      if (item.type === "assign") {
        const p = item.project;
        return `
          <li class="item-card item-card-task">
            <h3 class="item-title">待分配：${escapeHtml(p.title || "未命名项目")}</h3>
            <p class="item-subtitle">该项目尚未分配工作人员，分配后即可进入执行。</p>
            <div class="item-foot">
              <span class="pill">状态：${escapeHtml(mapProjectStatus(p.status))}</span>
              <button class="link-btn data-assign-project" data-id="${escapeHtml(String(p.id))}" type="button">立即分配</button>
            </div>
          </li>
        `;
      }
      const p = item.project;
      return `
        <li class="item-card item-card-task">
          <h3 class="item-title">待审核：${escapeHtml(p.title || "未命名项目")}</h3>
          <p class="item-subtitle">工作人员已提交成果，等待导演审核。</p>
          <div class="item-foot">
            <span class="pill">状态：待审核</span>
            <button class="link-btn data-open-review" data-id="${escapeHtml(String(p.id))}" type="button">进入审核</button>
          </div>
        </li>
      `;
    }).join("");

    list.querySelectorAll(".data-assign-project").forEach((el) => {
      el.addEventListener("click", function () {
        const projectId = el.getAttribute("data-id");
        if (!projectId) return;
        assignProjectFlow(projectId);
      });
    });

    list.querySelectorAll(".data-open-review").forEach((el) => {
      el.addEventListener("click", function () {
        const projectId = el.getAttribute("data-id");
        if (!projectId) return;
        localStorage.setItem("review_focus_project_id", String(projectId));
        window.location.href = `review-workbench.html?id=${encodeURIComponent(String(projectId))}`;
      });
    });
  }

  function patchWelcome(totalProjects) {
    const user = currentUser || safeJson(localStorage.getItem("user"));
    const name = (user && (user.display_name || user.username)) || "User";
    const first = name.charAt(0).toUpperCase();
    setText("#workspace-welcome", `欢迎回来，${name}`);
    setText("#workspace-subtitle", isDirector() ? `当前共有 ${totalProjects} 个项目等待统筹` : `今天共参与 ${totalProjects} 个我的作品`);
    setText("#top-username", name);
    setText("#top-avatar", first);
  }

  function patchStaffTaskList(tasks, projects) {
    const list = document.querySelector("#task-list");
    if (!list) return;

    // 优先展示真实任务队列；若队列为空，退化为“项目级任务”，避免工作人员页面长期空白。
    const queueTasks = Array.isArray(tasks) ? tasks : [];
    const fallbackTasks = buildProjectLevelTasks(Array.isArray(projects) ? projects : []);
    const merged = queueTasks.length ? queueTasks : fallbackTasks;

    if (!merged.length) {
      list.innerHTML = taskEmptyHtml();
      return;
    }

    list.innerHTML = merged.slice(0, 4).map((t) => {
      const isProjectTask = t.__kind === "project";
      const sceneText = isProjectTask
        ? `项目任务：${escapeHtml(t.task_type || "项目执行")} · 状态 ${escapeHtml(mapProjectStatus(t.project_status || "processing"))}`
        : `任务类型：${escapeHtml(t.task_type || "-")} · 进度 ${escapeHtml(String(t.progress || 0))}%`;
      const due = formatDate(t.created_at || t.updated_at || new Date().toISOString());
      const route = isProjectTask
        ? "project"
        : (t.task_type === "img2video" ? "render" : "script");
      const routeProjectId = t.project_id || "";
      return `
        <li class="item-card item-card-task">
          <h3 class="item-title">${isProjectTask ? `项目任务 #${escapeHtml(String(t.project_id || "-"))}` : `任务 #${t.id}`}</h3>
          <p class="item-subtitle">${sceneText}</p>
          <div class="item-foot">
            <span class="pill">${escapeHtml(mapTaskStatus(t.status))} · ${escapeHtml(due)}</span>
            <button class="link-btn data-enter-task" data-route="${route}" data-project-id="${escapeHtml(String(routeProjectId))}" type="button">进入工位</button>
          </div>
        </li>
      `;
    }).join("");

    list.querySelectorAll(".data-enter-task").forEach((el) => {
      el.addEventListener("click", function () {
        const route = el.getAttribute("data-route");
        const projectId = el.getAttribute("data-project-id");
        if (projectId) localStorage.setItem("activeProjectId", String(projectId));
        if (!route) return;
        safeRouteTo(route);
      });
    });
  }

  function buildProjectLevelTasks(projects) {
    return projects
      .filter((p) => p && p.id && p.status !== "approved")
      .slice(0, 8)
      .map((p) => ({
        __kind: "project",
        id: `p-${p.id}`,
        project_id: p.id,
        project_status: p.status || "processing",
        task_type: "项目执行",
        status: p.status === "review" ? "processing" : "pending",
        progress: 0,
        created_at: p.created_at,
        updated_at: p.updated_at,
      }));
  }

  function patchDirectorProjectList(projects) {
    const list = document.querySelector("#recent-project-list");
    if (!list) return;
    if (!projects.length) {
      list.innerHTML = projectEmptyHtml();
      return;
    }

    list.innerHTML = projects.slice(0, 8).map((p) => {
      const coverUrl = getProjectCoverUrl(p);
      const assignedText = p.assigned_to ? `已分配 #${p.assigned_to}` : "未分配";
      return `
        <li class="item-card item-card-project" data-id="${p.id}">
          <span class="project-icon" aria-hidden="true">
            <img class="project-icon__img ${coverUrl ? "" : "is-fallback"}" src="${escapeHtml(coverUrl || "tu.png")}" alt="项目封面">
          </span>
          <div class="project-main">
            <h3 class="item-title">${escapeHtml(p.title || "未命名项目")}</h3>
            <p class="item-subtitle">${escapeHtml(p.genre || "未分类")} · ${p.episode_count || 0}集 · ${escapeHtml(assignedText)}</p>
          </div>
          <div class="item-foot">
            <span class="pill">${escapeHtml(mapProjectStatus(p.status))}</span>
            <button class="link-btn data-assign-project" data-id="${p.id}" type="button">分配</button>
            <button class="link-btn data-open-project" data-id="${p.id}" type="button">打开</button>
          </div>
        </li>
      `;
    }).join("");

    list.querySelectorAll(".data-open-project").forEach((el) => {
      el.addEventListener("click", function () {
        const projectId = el.getAttribute("data-id");
        if (!projectId) return;
        localStorage.setItem("activeProjectId", String(projectId));
        window.location.href = `project.html?id=${projectId}`;
      });
    });

    list.querySelectorAll(".data-assign-project").forEach((el) => {
      el.addEventListener("click", function () {
        const projectId = el.getAttribute("data-id");
        if (!projectId) return;
        assignProjectFlow(projectId);
      });
    });
  }

  function patchStaffProjectList(projects) {
    const list = document.querySelector("#recent-project-list");
    if (!list) return;

    if (!projects.length) {
      list.innerHTML = `
        <li class="item-card">
          <h3 class="item-title">暂无分配作品</h3>
          <p class="item-subtitle">导演分配后，你的作品会出现在这里。</p>
        </li>
      `;
      return;
    }

    list.innerHTML = projects.slice(0, 8).map((p) => {
      const coverUrl = getProjectCoverUrl(p);
      return `
        <li class="item-card item-card-project data-open-project" data-id="${p.id}">
          <span class="project-icon" aria-hidden="true">
            <img class="project-icon__img ${coverUrl ? "" : "is-fallback"}" src="${escapeHtml(coverUrl || "tu.png")}" alt="项目封面">
          </span>
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

  async function assignProjectFlow(projectId) {
    if (!isDirector()) return;
    if (window.CommonApp && typeof CommonApp.openAssignModal === "function") {
      CommonApp.openAssignModal({
        projectId,
        onAssigned: async function () {
          setText("#workspace-subtitle", `项目 ${projectId} 分配成功`);
          await loadDashboard();
        },
      });
    }
  }

  async function createProjectAndOpen() {
    console.log("[workspace] click new project button");
    if (SNAPSHOT_MODE) return;
    // 每次创建前拉一次实时身份，避免 localStorage 角色过期/错乱
    try {
      const me = await api.get("/auth/me");
      if (me) {
        currentUser = me;
        localStorage.setItem("user", JSON.stringify(me));
      }
    } catch {
      // ignore, fall through to local role check
    }

    if (!isDirector()) {
      console.log("[workspace] role check failed", currentUser);
      const role = currentUser && currentUser.role ? currentUser.role : "unknown";
      const msg = `仅导演可新建项目。\n当前账号角色：${role}`;
      setText("#workspace-subtitle", msg);
      if (window.CommonApp && typeof CommonApp.showError === "function") {
        CommonApp.showError(msg, "权限不足");
      }
      return;
    }
    console.log("[workspace] role check passed, open modal");
    openCreateProjectModal();
  }

  function taskEmptyHtml() {
    return `
      <li class="item-card item-card-empty">
        <h3 class="item-title">暂无任务</h3>
        <p class="item-subtitle">当前没有待处理任务。</p>
      </li>
    `;
  }

  function projectEmptyHtml() {
    return `
      <li class="item-card item-card-empty">
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
      running: "进行中",
      completed: "已完成",
      success: "已完成",
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

  function getProjectCoverUrl(project) {
    const raw = project && project.cover_image_url ? String(project.cover_image_url).trim() : "";
    if (!raw) return "";
    return raw.replaceAll("\\", "/");
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

  function isDirector() {
    return !!(currentUser && currentUser.role === "director");
  }

  function applyRoleLayout() {
    setText("#workspace-task-title", isDirector() ? "导演待办" : "我的任务");
    setText("#workspace-project-title", isDirector() ? "项目监控列表" : "我的作品列表");

    const newBtn = document.querySelector("#btn-new-project");
    if (newBtn) {
      const show = isDirector();
      newBtn.toggleAttribute("hidden", !show);
      newBtn.disabled = !show;
      newBtn.style.display = show ? "" : "none";
      newBtn.textContent = show ? "+ 新建项目" : "";
    }

    setText("#stat-action-project .stat-title", isDirector() ? "全部项目" : "我的作品");
    setText("#stat-action-task .stat-title", isDirector() ? "待分配/处理" : "待处理任务");
    setText("#stat-action-review .stat-title", isDirector() ? "待审核" : "审核状态");
  }

  function setRefreshLoading(loading) {
    const btn = document.querySelector("#btn-refresh");
    if (!btn) return;
    btn.disabled = !!loading;
    btn.textContent = loading ? "刷新中..." : "刷新";
  }

  function renderSnapshotFallback() {
    setText("#workspace-welcome", "欢迎回来");
    setText("#workspace-subtitle", "演示模式");
  }

  function openCreateProjectModal() {
    console.log("[workspace] openCreateProjectModal");
    mountCreateProjectModal();
    if (!createProjectModalNode) return;
    const titleInput = createProjectModalNode.querySelector("#create-project-title");
    if (titleInput) {
      const now = new Date();
      titleInput.value = `新项目 ${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
      setTimeout(() => {
        try { titleInput.focus(); } catch { /* no-op */ }
      }, 0);
    }
  }

  function mountCreateProjectModal() {
    if (createProjectModalNode && document.body.contains(createProjectModalNode)) return;
    console.log("[workspace] mount create project modal");
    const overlay = document.createElement("div");
    overlay.className = "assign-modal-overlay";
    overlay.innerHTML = `
      <section class="assign-modal" role="dialog" aria-modal="true" aria-labelledby="create-project-title-label">
        <header class="assign-modal__head">
          <div>
            <h2 class="assign-modal__title" id="create-project-title-label">新建项目</h2>
            <p class="assign-modal__sub">填写项目基础信息后进入项目详情页</p>
          </div>
          <button type="button" class="assign-modal__close" id="create-project-close">关闭</button>
        </header>
        <div class="assign-modal__body">
          <label class="assign-modal__label" for="create-project-title">项目标题</label>
          <input id="create-project-title" class="assign-modal__select" type="text" maxlength="255" placeholder="请输入项目标题">

          <label class="assign-modal__label" for="create-project-genre">项目类型</label>
          <input id="create-project-genre" class="assign-modal__select" type="text" maxlength="50" placeholder="如：古风 / 科幻 / 都市">

          <label class="assign-modal__label" for="create-project-episodes">总集数</label>
          <input id="create-project-episodes" class="assign-modal__select" type="number" min="1" max="999" value="1">

          <label class="assign-modal__label" for="create-project-desc">项目描述</label>
          <textarea id="create-project-desc" class="assign-modal__select" style="height:88px;padding:10px 12px;resize:vertical;" placeholder="可选：填写项目说明"></textarea>
          <p id="create-project-status" class="assign-modal__hint" style="margin-top:10px;"></p>
        </div>
        <footer class="assign-modal__foot">
          <button type="button" class="assign-modal__btn" id="create-project-cancel">取消</button>
          <button type="button" class="assign-modal__btn assign-modal__btn--primary" id="create-project-confirm">创建项目</button>
        </footer>
      </section>
    `;
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeCreateProjectModal();
    });
    document.body.appendChild(overlay);
    createProjectModalNode = overlay;

    overlay.querySelector("#create-project-close")?.addEventListener("click", closeCreateProjectModal);
    overlay.querySelector("#create-project-cancel")?.addEventListener("click", closeCreateProjectModal);
    const confirmBtn = overlay.querySelector("#create-project-confirm");
    if (confirmBtn) {
      if (confirmBtn.dataset.boundClick !== "1") {
        confirmBtn.dataset.boundClick = "1";
        confirmBtn.addEventListener("click", submitCreateProject);
      }
      console.log("[workspace] bind create-project-confirm click");
    }
  }

  function closeCreateProjectModal() {
    if (!createProjectModalNode) return;
    if (createProjectModalNode.parentNode) createProjectModalNode.parentNode.removeChild(createProjectModalNode);
    createProjectModalNode = null;
  }

  async function submitCreateProject() {
    console.log("[workspace] click create-project-confirm");
    if (createProjectSubmitting) return;
    if (!createProjectModalNode) return;
    const apiClient =
      (typeof window !== "undefined" && window.api)
      || (typeof api !== "undefined" ? api : null);
    if (!apiClient) {
      console.error("[workspace] api client is unavailable");
      const statusNode = createProjectModalNode.querySelector("#create-project-status");
      if (statusNode) statusNode.textContent = "初始化失败：api 客户端未加载";
      if (window.CommonApp && typeof CommonApp.showError === "function") {
        CommonApp.showError("初始化失败：api 客户端未加载");
      }
      return;
    }
    const statusNode = createProjectModalNode.querySelector("#create-project-status");
    if (statusNode) statusNode.textContent = "";
    const title = valueOf("#create-project-title");
    const genre = valueOf("#create-project-genre");
    const desc = valueOf("#create-project-desc");
    const episodesRaw = valueOf("#create-project-episodes");
    const episodeCount = Number(episodesRaw || "1");

    if (!title) {
      console.log("[workspace] validate failed: empty title");
      if (statusNode) statusNode.textContent = "请填写项目标题";
      if (window.CommonApp && typeof CommonApp.showError === "function") {
        CommonApp.showError("请填写项目标题");
      }
      return;
    }
    if (!Number.isInteger(episodeCount) || episodeCount < 1) {
      console.log("[workspace] validate failed: invalid episode_count", episodesRaw);
      if (statusNode) statusNode.textContent = "总集数需为大于 0 的整数";
      if (window.CommonApp && typeof CommonApp.showError === "function") {
        CommonApp.showError("总集数需为大于 0 的整数");
      }
      return;
    }

    const confirmBtn = createProjectModalNode.querySelector("#create-project-confirm");
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = "创建中…";
    }
    createProjectSubmitting = true;
    if (statusNode) statusNode.textContent = "正在创建项目，请稍候…";
    try {
      console.log("[workspace] creating project payload", {
        title,
        description: desc || "创建于工作台弹窗",
        genre: genre || "custom",
        episode_count: episodeCount,
      });
      setText("#workspace-subtitle", "正在创建项目…");
      const res = await apiClient.post("/projects/", {
        title,
        description: desc || "创建于工作台弹窗",
        genre: genre || "custom",
        episode_count: episodeCount,
      });
      console.log("[workspace] create project api response", res);
      const projectId = res && res.data && res.data.id;
      if (!projectId) {
        console.log("[workspace] create project response missing id", res);
        throw new Error("后端未返回项目ID");
      }
      console.log("[workspace] create success, goto project", projectId);
      closeCreateProjectModal();
      localStorage.setItem("activeProjectId", String(projectId));
      window.location.href = `project.html?id=${projectId}`;
    } catch (err) {
      console.error("[workspace] create project failed", err);
      const msg = (err && err.message) ? `新建失败：${err.message}` : "新建失败";
      setText("#workspace-subtitle", msg);
      if (statusNode) statusNode.textContent = msg;
      if (window.CommonApp && typeof CommonApp.showError === "function") {
        CommonApp.showError(msg);
      }
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = "创建项目";
      }
    } finally {
      createProjectSubmitting = false;
    }
  }

  function valueOf(selector) {
    if (!createProjectModalNode) return "";
    const node = createProjectModalNode.querySelector(selector);
    return node ? String(node.value || "").trim() : "";
  }
})();

