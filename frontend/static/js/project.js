/**
 * Project detail page (semantic layout)
 */
(function () {
  document.addEventListener("DOMContentLoaded", async function () {
    if (!window.CommonApp || !window.api) return;
    const ok = await CommonApp.ensureSession(true);
    if (!ok) return;

    bindActions();
    await loadProjectInfo();
  });

  function bindActions() {
    bindClick("#btn-go-script", () => goToWorkbench("script"));
    bindClick("#btn-go-storyboard", () => goToWorkbench("storyboard"));
    bindClick("#btn-go-render", () => goToWorkbench("render"));
    bindClick("#btn-go-review", () => goToWorkbench("review"));
    bindClick("#btn-go-export", () => goToWorkbench("export"));
  }

  function bindClick(selector, handler) {
    const node = document.querySelector(selector);
    if (!node) return;
    node.addEventListener("click", handler);
  }

  async function loadProjectInfo() {
    try {
      let id = getProjectId();
      if (!id) {
        const projectsRes = await api.get("/projects?size=1");
        const first = projectsRes && projectsRes.data && projectsRes.data.items ? projectsRes.data.items[0] : null;
        if (!first || !first.id) return;
        id = String(first.id);
        localStorage.setItem("activeProjectId", id);
        window.history.replaceState({}, "", `project.html?id=${id}`);
      }

      const [projectRes, tasksRes, assetsRes] = await Promise.all([
        api.get(`/projects/${id}`),
        api.get("/api/tasks/tasks?size=200"),
        api.get(`/api/export/export/project/${id}/assets`),
      ]);

      const project = projectRes && projectRes.data ? projectRes.data : {};
      const tasks = tasksRes && tasksRes.data && tasksRes.data.items ? tasksRes.data.items : [];
      const assets = assetsRes && assetsRes.data ? assetsRes.data : {};

      patchProjectHeader(project);
      patchProgress(project, tasks);
      patchAssets(assets);
      patchTimeline(project);
      patchBlockers(project);
    } catch (err) {
      console.error("Failed to load project detail:", err);
      setText("#project-subtitle", "Load failed. Please refresh.");
    }
  }

  function getProjectId() {
    const queryId = new URLSearchParams(window.location.search).get("id");
    if (queryId) {
      localStorage.setItem("activeProjectId", String(queryId));
      return String(queryId);
    }
    return localStorage.getItem("activeProjectId");
  }

  function goToWorkbench(route) {
    if (window.CommonApp) {
      CommonApp.routeTo(route);
      return;
    }
    const id = getProjectId();
    const base = `${route}.html`;
    window.location.href = id ? `${base}?id=${id}` : base;
  }

  function patchProjectHeader(project) {
    const title = project.title || "Untitled project";
    const meta = `${project.genre || "N/A"} - ${project.episode_count || 0} eps`;
    setText("#project-breadcrumb-current", title);
    setText("#project-title", title);
    setText("#project-meta", meta);
    setText("#project-subtitle", project.description || "No description");
  }

  function patchProgress(project, tasks) {
    const sceneCount = Number(project.scene_count || 0);
    const done = tasks.filter((t) => t.status === "success").length;
    const total = Math.max(sceneCount, done, 1);
    const percent = Math.min(100, Math.floor((done / total) * 100));

    setText("#project-progress-percent", `${percent}%`);
    setText(
      "#project-progress-summary",
      `${mapProjectStatus(project.status)} - EP ${project.current_episode || 1}/${project.episode_count || 0}`
    );

    const bar = document.querySelector("#project-progress-bar");
    if (bar) bar.style.width = `${percent}%`;
  }

  function patchAssets(assets) {
    setText("#asset-images", String(assets.images_count || 0));
    setText("#asset-videos", String(assets.videos_count || 0));
    setText("#asset-scenes", String(assets.total_scenes || 0));
  }

  function patchTimeline(project) {
    const items = [];
    items.push(`Project created`);
    items.push(`Current status: ${mapProjectStatus(project.status)}`);
    if (project.updated_at) {
      items.push(`Last updated: ${project.updated_at}`);
    }

    const list = document.querySelector("#project-timeline");
    if (!list) return;
    list.innerHTML = items.map((it) => `<li>${escapeHtml(it)}</li>`).join("");
  }

  function patchBlockers(project) {
    const box = document.querySelector("#project-blockers");
    if (!box) return;
    if (project.status === "rejected") {
      box.innerHTML = "<li>Project was rejected. Please review comments and resubmit.</li>";
      return;
    }
    box.innerHTML = "<li>No critical blockers detected.</li>";
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

  function escapeHtml(text) {
    return String(text || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }
})();

