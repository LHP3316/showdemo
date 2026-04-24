/**
 * Project detail page
 */
$(document).ready(async function () {
  const ok = await CommonApp.ensureSession(true);
  if (!ok) return;

  bindQuickLinks();
  await loadProjectInfo();
});

function bindQuickLinks() {
  $("#2_285").css("cursor", "pointer").on("click", function () {
    const id = getProjectId();
    window.location.href = id ? `script.html?id=${id}` : "script.html";
  });

  $("#2_296").css("cursor", "pointer").on("click", function () {
    const id = getProjectId();
    window.location.href = id ? `storyboard.html?id=${id}` : "storyboard.html";
  });

  $("#2_299").css("cursor", "pointer").on("click", function () {
    const id = getProjectId();
    window.location.href = id ? `render.html?id=${id}` : "render.html";
  });
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
  } catch (err) {
    console.error("Failed to load project detail:", err);
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

function patchProjectHeader(project) {
  const title = project.title || "Untitled project";
  const meta = `${project.genre || "N/A"} - ${project.episode_count || 0} eps`;

  $("#2_182").text(title);
  $("#2_184").text(title);
  $("#2_186").text(meta);
}

function patchProgress(project, tasks) {
  const sceneCount = Number(project.scene_count || 0);
  const done = tasks.filter((t) => t.status === "success").length;
  const total = Math.max(sceneCount, done, 1);
  const percent = Math.min(100, Math.floor((done / total) * 100));

  $("#2_220").text(`${percent}%`);
  $("#2_223").text(`${mapProjectStatus(project.status)} - EP ${project.current_episode || 1}/${project.episode_count || 0}`);
}

function patchAssets(assets) {
  $("#2_246").text(String(assets.images_count || 0));
  $("#2_249").text(String(assets.videos_count || 0));
  $("#2_252").text(String(assets.total_scenes || 0));
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
