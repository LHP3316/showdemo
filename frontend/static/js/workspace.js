/**
 * Workspace page (vanilla JS)
 */
(function () {
  const RECENT_CARD_IDS = ["#2_127", "#2_143", "#2_159"];

  document.addEventListener("DOMContentLoaded", async function () {
    if (!window.CommonApp || !window.api) return;
    const ok = await CommonApp.ensureSession(true);
    if (!ok) return;

    bindActions();
    await loadDashboard();
  });

  function bindActions() {
    bindClick("#2_57", loadDashboard); // refresh

    // Header nav (strong binding inside workspace)
    bindClick("#2_37", () => go("workspace"));
    bindClick("#2_39", () => openProjectOrFallback());
    bindClick("#2_41", () => go("render"));
    bindClick("#2_43", () => go("review"));
    bindClick("#2_50", () => CommonApp.logout());

    // Task cards -> workbenches
    bindClick("#2_89", () => go("script"));
    bindClick("#2_104", () => go("storyboard"));
    bindClick("#2_103", () => go("script"));
    bindClick("#2_117", () => go("storyboard"));

    // Recent project cards
    bindClick("#2_127", () => openRecentProject(0));
    bindClick("#2_143", () => openRecentProject(1));
    bindClick("#2_159", () => openRecentProject(2));

    // New project
    bindClick("#2_122", createProjectAndOpen);
  }

  function bindClick(selector, handler) {
    const node = document.querySelector(selector);
    if (!node) return;
    if (node.dataset.wsBound === "1") return;
    node.dataset.wsBound = "1";
    node.style.cursor = "pointer";
    node.addEventListener("click", function (event) {
      event.preventDefault();
      handler();
    });
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

      setText("#2_67", String(stats.total || 0));
      setText("#2_79", String(stats.approved || 0));

      const todoCount = tasks.filter((t) => t.status === "pending" || t.status === "processing").length;
      setText("#2_71", String(todoCount));
      setText("#2_87", `${todoCount} pending`);
      setText("#2_75", String(pending.length));

      localStorage.setItem("workspaceProjectsCache", JSON.stringify(projects));
      if (projects[0] && projects[0].id) {
        localStorage.setItem("activeProjectId", String(projects[0].id));
      }

      patchRecentProjects(projects);
      patchWelcome(stats.total || 0);
    } catch (err) {
      console.error("Failed to load workspace data:", err);
    }
  }

  function patchWelcome(totalProjects) {
    const user = safeJson(localStorage.getItem("user"));
    const name = (user && (user.display_name || user.username)) || "User";
    setText("#2_55", `Welcome back, ${name}`);
    setText("#2_56", `You are currently participating in ${totalProjects} projects`);
    setText("#2_49", name);
  }

  function patchRecentProjects(projects) {
    const map = [
      { title: "#2_139", subtitle: "#2_140", status: "#2_142" },
      { title: "#2_155", subtitle: "#2_156", status: "#2_158" },
      { title: "#2_171", subtitle: "#2_172", status: "#2_174" },
    ];

    map.forEach((slot, index) => {
      const item = projects[index];
      if (!item) return;
      setText(slot.title, item.title || "Untitled project");
      setText(
        slot.subtitle,
        `${item.genre || "N/A"} - ${item.episode_count || 0} eps - ${mapProjectStatus(item.status)}`
      );
      setText(slot.status, mapProjectStatus(item.status));
    });

    RECENT_CARD_IDS.forEach((id, idx) => {
      const node = document.querySelector(id);
      if (!node) return;
      node.dataset.projectIndex = String(idx);
    });
  }

  function openRecentProject(index) {
    const list = safeJson(localStorage.getItem("workspaceProjectsCache")) || [];
    const item = list[index];
    if (!item || !item.id) return;
    localStorage.setItem("activeProjectId", String(item.id));
    window.location.href = `project.html?id=${item.id}`;
  }

  function go(route) {
    if (!window.CommonApp) return;
    CommonApp.routeTo(route);
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
      // Non-director users may not have create permission; fallback to project page.
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
})();

