/**
 * Render queue page
 */
(function () {
  let projectId = null;
  let scenes = [];

  document.addEventListener("DOMContentLoaded", async function () {
    if (!window.CommonApp || !window.api) return;
    const ok = await CommonApp.ensureSession(true);
    if (!ok) return;

    projectId = await ensureProjectId();
    await loadData();
  });

  async function ensureProjectId() {
    const fromQuery = new URLSearchParams(window.location.search).get("id");
    if (fromQuery) {
      localStorage.setItem("activeProjectId", fromQuery);
      return fromQuery;
    }
    const fromCache = localStorage.getItem("activeProjectId");
    if (fromCache) return fromCache;

    const res = await api.get("/projects?size=1");
    const first = res && res.data && res.data.items ? res.data.items[0] : null;
    if (first && first.id) {
      localStorage.setItem("activeProjectId", String(first.id));
      window.history.replaceState({}, "", `render.html?id=${first.id}`);
      return String(first.id);
    }
    return null;
  }

  async function loadData() {
    if (!projectId) {
      setStatus("No project available", true);
      return;
    }
    try {
      const [projectRes, scenesRes, tasksRes] = await Promise.all([
        api.get(`/projects/${projectId}`),
        api.get(`/api/scenes/?project_id=${projectId}`),
        api.get("/api/tasks/tasks?size=100"),
      ]);
      const p = (projectRes && projectRes.data) || {};
      scenes = (scenesRes && scenesRes.data) || [];
      const tasks = (tasksRes && tasksRes.data && tasksRes.data.items) || [];

      setText("#render-page-title", `生成队列 - ${p.title || "Untitled"}`);
      setText("#render-page-subtitle", `Scenes: ${scenes.length}, Tasks: ${tasks.length}`);
      renderSceneRows();
      renderTaskRows(tasks);
      setStatus("Loaded");
    } catch (e) {
      setStatus(e.message || "Load failed", true);
    }
  }

  function renderSceneRows() {
    const body = document.querySelector("#render-scene-body");
    if (!body) return;
    if (!scenes.length) {
      body.innerHTML = "<tr><td colspan='3'>暂无数据</td></tr>";
      return;
    }
    body.innerHTML = scenes.map((s) => `
      <tr>
        <td>#${s.scene_index}</td>
        <td><span class="badge">${escapeHtml(s.status || "-")}</span></td>
        <td>
          <div class="actions">
            <button class="btn js-task-img" data-id="${s.id}" type="button">队列文生图</button>
            <button class="btn js-task-video" data-id="${s.id}" type="button">队列图生视频</button>
          </div>
        </td>
      </tr>
    `).join("");

    body.querySelectorAll(".js-task-img").forEach((btn) => {
      btn.addEventListener("click", () => createTask(btn.getAttribute("data-id"), "text2img"));
    });
    body.querySelectorAll(".js-task-video").forEach((btn) => {
      btn.addEventListener("click", () => createTask(btn.getAttribute("data-id"), "img2video"));
    });
  }

  function renderTaskRows(tasks) {
    const body = document.querySelector("#render-task-body");
    if (!body) return;
    if (!tasks.length) {
      body.innerHTML = "<tr><td colspan='4'>暂无任务</td></tr>";
      return;
    }
    body.innerHTML = tasks.slice(0, 50).map((t) => `
      <tr>
        <td>${t.id}</td>
        <td>${escapeHtml(t.task_type || "-")}</td>
        <td><span class="badge">${escapeHtml(t.status || "-")}</span></td>
        <td>${t.progress || 0}%</td>
      </tr>
    `).join("");
  }

  async function createTask(sceneId, taskType) {
    if (!sceneId) return;
    try {
      await api.post("/api/tasks/tasks", { scene_id: Number(sceneId), task_type: taskType });
      setStatus(`Task queued: ${taskType} for scene ${sceneId}`);
      await loadData();
    } catch (e) {
      setStatus(e.message || "Queue failed", true);
    }
  }

  function setText(selector, text) {
    const node = document.querySelector(selector);
    if (node) node.textContent = text;
  }

  function setStatus(message, isError) {
    const node = document.querySelector("#render-status");
    if (!node) return;
    node.textContent = message;
    node.classList.toggle("error", !!isError);
  }

  function escapeHtml(text) {
    return String(text || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }
})();

