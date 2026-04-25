/**
 * Workspace page (Pixso layout + live data)
 */
(function () {
  const SNAPSHOT_MODE = false;
  let currentUser = null;
  let staffUsers = [];

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
    applyRoleLayout();
    await loadDashboard();
  });

  function bindActions() {
    bindClick("#btn-refresh", function () {
      loadDashboard();
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
    node.style.cursor = "pointer";
    node.addEventListener("click", handler);
  }

  async function loadDashboard() {
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

      const activeTasks = tasks.filter((t) => t.status === "pending" || t.status === "processing" || t.status === "running");
      setText("#stat-total", String(stats.total || 0));
      setText("#stat-pending-tasks", String(activeTasks.length));
      setText("#stat-review", String(isDirector() ? pending.length : (stats.review || 0)));
      setText("#stat-done", String(stats.approved || 0));
      setText("#tasks-count-pill", isDirector() ? `${pending.length} 个待审核` : `${activeTasks.length} 个待处理`);

      if (projects[0] && projects[0].id) {
        localStorage.setItem("activeProjectId", String(projects[0].id));
      }

      patchWelcome(stats.total || 0);
      if (isDirector()) {
        patchDirectorTaskPanel(projects, pending);
        patchDirectorProjectList(projects);
      } else {
        patchStaffTaskList(activeTasks);
        patchStaffProjectList(projects);
      }
    } catch (err) {
      console.error("Failed to load workspace data:", err);
      setText("#workspace-subtitle", "数据加载失败，请点击刷新重试");
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
        <li class="item-card">
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
        localStorage.setItem("activeProjectId", String(projectId));
        window.location.href = `review.html?id=${projectId}`;
      });
    });
  }

  function patchWelcome(totalProjects) {
    const user = safeJson(localStorage.getItem("user"));
    const name = (user && (user.display_name || user.username)) || "User";
    const first = name.charAt(0).toUpperCase();
    setText("#workspace-welcome", `欢迎回来，${name}`);
    setText("#workspace-subtitle", isDirector() ? `当前共有 ${totalProjects} 个项目等待统筹` : `今天共参与 ${totalProjects} 个我的作品`);
    setText("#top-username", name);
    setText("#top-avatar", first);
  }

  function patchStaffTaskList(tasks) {
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

  function patchDirectorProjectList(projects) {
    const list = document.querySelector("#recent-project-list");
    if (!list) return;
    if (!projects.length) {
      list.innerHTML = projectEmptyHtml();
      return;
    }

    list.innerHTML = projects.slice(0, 8).map((p) => {
      const iconClass = `icon-${getIconSeed(String(p.id || ""))}`;
      const assignedText = p.assigned_to ? `已分配 #${p.assigned_to}` : "未分配";
      return `
        <li class="item-card item-card-project" data-id="${p.id}">
          <span class="project-icon ${iconClass}" aria-hidden="true"></span>
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

  async function assignProjectFlow(projectId) {
    if (!isDirector()) return;
    if (!staffUsers.length) {
      try {
        const users = await api.get("/auth/users");
        staffUsers = (Array.isArray(users) ? users : []).filter((u) => u && u.role === "staff");
      } catch {
        // ignore
      }
    }
    if (!staffUsers.length) {
      setText("#workspace-subtitle", "暂无可分配的工作人员账号");
      return;
    }
    const options = staffUsers.map((u) => `${u.id}:${u.display_name || u.username}`).join(" | ");
    const raw = window.prompt(`请输入分配目标 staff ID。\n可选：${options}`);
    if (!raw) return;
    const assignedTo = Number(raw.trim());
    if (!Number.isInteger(assignedTo) || assignedTo <= 0) {
      setText("#workspace-subtitle", "请输入有效的 staff ID");
      return;
    }
    try {
      await api.put(`/projects/${projectId}/assign?assigned_to=${assignedTo}`, {});
      setText("#workspace-subtitle", `项目 ${projectId} 分配成功`);
      await loadDashboard();
    } catch (err) {
      setText("#workspace-subtitle", err && err.message ? err.message : "分配失败");
    }
  }

  async function createProjectAndOpen() {
    if (SNAPSHOT_MODE) return;
    if (!isDirector()) {
      setText("#workspace-subtitle", "仅导演可新建项目");
      return;
    }
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
        <p class="item-subtitle">当前没有待处理任务。</p>
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

  function isDirector() {
    return !!(currentUser && currentUser.role === "director");
  }

  function applyRoleLayout() {
    setText("#workspace-task-title", isDirector() ? "导演待办" : "我的任务");
    setText("#workspace-project-title", isDirector() ? "项目监控列表" : "我的作品列表");

    const newBtn = document.querySelector("#btn-new-project");
    if (newBtn) {
      newBtn.toggleAttribute("hidden", !isDirector());
      newBtn.textContent = isDirector() ? "+ 新建项目" : "";
    }

    setText("#stat-action-project .stat-title", isDirector() ? "全部项目" : "我的作品");
    setText("#stat-action-task .stat-title", isDirector() ? "待分配/处理" : "待处理任务");
    setText("#stat-action-review .stat-title", isDirector() ? "待审核" : "审核状态");
  }

  function renderSnapshotFallback() {
    setText("#workspace-welcome", "欢迎回来");
    setText("#workspace-subtitle", "演示模式");
  }
})();

