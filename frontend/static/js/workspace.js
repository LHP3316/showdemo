/**
 * Workspace page (semantic layout)
 */
(function () {
  document.addEventListener("DOMContentLoaded", async function () {
    if (!window.CommonApp || !window.api) return;
    const ok = await CommonApp.ensureSession(true);
    if (!ok) return;

    bindActions();
    await loadDashboard();
  });

  function bindActions() {
    bindClick("#btn-refresh", loadDashboard);
    bindClick("#btn-new-project", createProjectAndOpen);
    bindClick("#nav-project", openProjectOrFallback);
  }

  function bindClick(selector, handler) {
    const node = document.querySelector(selector);
    if (!node) return;
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

      setText("#stat-total", String(stats.total || 0));
      setText("#stat-done", String(stats.approved || 0));

      const todoCount = tasks.filter((t) => t.status === "pending" || t.status === "processing").length;
      setText("#stat-pending-tasks", String(todoCount));
      setText("#tasks-count-pill", `${todoCount} pending`);
      setText("#stat-review", String(pending.length));

      localStorage.setItem("workspaceProjectsCache", JSON.stringify(projects));
      if (projects[0] && projects[0].id) {
        localStorage.setItem("activeProjectId", String(projects[0].id));
      }

      patchWelcome(stats.total || 0);
      patchTaskList(tasks);
      patchRecentProjects(projects);
    } catch (err) {
      console.error("Failed to load workspace data:", err);
      setText("#workspace-subtitle", "Load failed. Please refresh.");
    }
  }

  function patchWelcome(totalProjects) {
    const user = safeJson(localStorage.getItem("user"));
    const name = (user && (user.display_name || user.username)) || "User";
    setText("#workspace-welcome", `Welcome back, ${name}`);
    setText("#workspace-subtitle", `You are currently participating in ${totalProjects} projects`);
    setText("#top-username", name);
  }

  function patchTaskList(tasks) {
    const list = document.querySelector("#task-list");
    if (!list) return;

    const show = tasks.filter((t) => t.status === "pending" || t.status === "processing").slice(0, 4);
    if (!show.length) {
      list.innerHTML = `
        <li class="item-card">
          <h3 class="item-title">No tasks</h3>
          <p class="item-subtitle">Tasks assigned to you will appear here.</p>
        </li>
      `;
      return;
    }

    list.innerHTML = show.map((t) => {
      const route = t.task_type === "img2video" ? "render" : "script";
      return `
        <li class="item-card">
          <h3 class="item-title">Task #${t.id}</h3>
          <p class="item-subtitle">Type: ${escapeHtml(t.task_type)} - Status: ${escapeHtml(t.status)}</p>
          <div class="item-foot">
            <span class="pill">${escapeHtml(String(t.progress || 0))}%</span>
            <button class="link-btn" data-route="${route}" type="button">进入工位</button>
          </div>
        </li>
      `;
    }).join("");

    list.querySelectorAll(".link-btn").forEach((btn) => {
      btn.addEventListener("click", function () {
        const route = btn.getAttribute("data-route");
        if (route && window.CommonApp) CommonApp.routeTo(route);
      });
    });
  }

  function patchRecentProjects(projects) {
    const list = document.querySelector("#recent-project-list");
    if (!list) return;

    const show = projects.slice(0, 5);
    if (!show.length) {
      list.innerHTML = `
        <li class="item-card">
          <h3 class="item-title">No projects</h3>
          <p class="item-subtitle">Create your first project from the button above.</p>
        </li>
      `;
      return;
    }

    list.innerHTML = show.map((p) => `
      <li class="item-card">
        <h3 class="item-title">${escapeHtml(p.title || "Untitled project")}</h3>
        <p class="item-subtitle">${escapeHtml(p.genre || "N/A")} - ${p.episode_count || 0} eps - ${escapeHtml(mapProjectStatus(p.status))}</p>
        <div class="item-foot">
          <span class="pill">${escapeHtml(mapProjectStatus(p.status))}</span>
          <button class="link-btn js-open-project" data-id="${p.id}" type="button">打开项目</button>
        </div>
      </li>
    `).join("");

    list.querySelectorAll(".js-open-project").forEach((btn) => {
      btn.addEventListener("click", function () {
        const id = btn.getAttribute("data-id");
        if (!id) return;
        localStorage.setItem("activeProjectId", String(id));
        window.location.href = `project.html?id=${id}`;
      });
    });
  }

  function openProjectOrFallback() {
    const projectId = localStorage.getItem("activeProjectId");
    if (projectId) {
      window.location.href = `project.html?id=${projectId}`;
      return;
    }
    window.location.href = "project.html";
  }

  async function createProjectAndOpen() {
    try {
      const now = new Date();
      const title = `New Project ${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
      const res = await api.post("/projects/", {
        title,
        description: "Created from workspace quick action",
        genre: "custom",
        episode_count: 1,
      });

      const projectId = res && res.data && res.data.id;
      if (!projectId) {
        await loadDashboard();
        openProjectOrFallback();
        return;
      }

      localStorage.setItem("activeProjectId", String(projectId));
      window.location.href = `project.html?id=${projectId}`;
    } catch (err) {
      console.error("Create project failed:", err);
      openProjectOrFallback();
    }
  }

  function setText(selector, text) {
    const node = document.querySelector(selector);
    if (node) node.textContent = text;
  }

  function mapProjectStatus(status) {
    const map = {
      draft: "Draft",
      processing: "In progress",
      review: "In review",
      approved: "Done",
      rejected: "Rejected",
    };
    return map[status] || status || "Unknown";
  }

  function safeJson(raw) {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function pad2(v) {
    return String(v).padStart(2, "0");
  }

  function escapeHtml(text) {
    return String(text || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }
})();

