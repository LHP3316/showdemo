/**
 * Functional layer for all static pages
 */
(function () {
  const page = (window.location.pathname.split("/").pop() || "").toLowerCase();
  const skip = page === "login.html" || page === "index.html";
  if (skip) return;

  // 默认关闭调试面板，避免干扰业务页面。
  // 如需开启：控制台执行 localStorage.setItem("live_panel", "1")
  const ENABLE_LIVE_PANEL = (function () {
    try {
      return localStorage.getItem("live_panel") === "1";
    } catch {
      return false;
    }
  })();
  if (!ENABLE_LIVE_PANEL) return;

  document.addEventListener("DOMContentLoaded", async function () {
    if (!window.api || !window.CommonApp) return;
    const ok = await CommonApp.ensureSession(true);
    if (!ok) return;
    mountDock();
  });

  function mountDock() {
    const dock = document.createElement("aside");
    dock.className = "func-dock";
    dock.innerHTML = `
      <div class="func-dock__header">
        <span>Live Panel</span>
        <button id="func-refresh" type="button">Refresh</button>
      </div>
      <div id="func-body" class="func-dock__body"></div>
      <div id="func-status" class="func-dock__status">Ready</div>
    `;
    document.body.appendChild(dock);

    document.getElementById("func-refresh").addEventListener("click", renderByPage);
    renderByPage();
  }

  function setStatus(text, isError) {
    const el = document.getElementById("func-status");
    if (!el) return;
    el.textContent = text;
    el.classList.toggle("is-error", !!isError);
  }

  function setBody(html) {
    const el = document.getElementById("func-body");
    if (!el) return null;
    el.innerHTML = html;
    return el;
  }

  function bindExisting(id, handler) {
    const node = document.querySelector(id);
    if (!node) return;
    if (node.dataset.funcBound === "1") return;
    node.dataset.funcBound = "1";
    node.style.cursor = "pointer";
    node.addEventListener("click", handler);
  }

  async function ensureProjectId() {
    const search = new URLSearchParams(window.location.search);
    const id = search.get("id") || localStorage.getItem("activeProjectId");
    if (id) {
      localStorage.setItem("activeProjectId", String(id));
      return String(id);
    }
    const res = await api.get("/projects?size=1");
    const first = res && res.data && res.data.items ? res.data.items[0] : null;
    if (first && first.id) {
      localStorage.setItem("activeProjectId", String(first.id));
      return String(first.id);
    }
    return null;
  }

  async function renderByPage() {
    try {
      setStatus("Loading...", false);
      if (page === "workspace.html") return renderWorkspacePanel();
      if (page === "project.html") return renderProjectPanel();
      if (page === "script.html") return renderScriptPanel();
      if (page === "storyboard.html") return renderStoryboardPanel();
      if (page === "render.html") return renderRenderPanel();
      if (page === "review.html") return renderReviewPanel();
      if (page === "export.html") return renderExportPanel();
      setBody("<div>Unsupported page</div>");
      setStatus("No panel available", true);
    } catch (e) {
      setStatus(e.message || "Load failed", true);
    }
  }

  async function renderWorkspacePanel() {
    const [statsRes, projectsRes] = await Promise.all([
      api.get("/projects/stats"),
      api.get("/projects?size=6"),
    ]);
    const stats = (statsRes && statsRes.data) || {};
    const projects = (projectsRes && projectsRes.data && projectsRes.data.items) || [];
    setBody(`
      <div class="func-grid">
        <div>Total: ${stats.total || 0}</div>
        <div>Processing: ${stats.processing || 0}</div>
        <div>Review: ${stats.review || 0}</div>
        <div>Done: ${stats.approved || 0}</div>
      </div>
      <h4>Projects</h4>
      <ul class="func-list">
        ${projects.map((p) => `<li><a href="project.html?id=${p.id}">${esc(p.title)}</a><span>${esc(p.status || "")}</span></li>`).join("")}
      </ul>
    `);
    setStatus("Workspace synced");
  }

  async function renderProjectPanel() {
    const projectId = await ensureProjectId();
    if (!projectId) {
      setBody("<div>No project found</div>");
      setStatus("No project", true);
      return;
    }
    const res = await api.get(`/projects/${projectId}`);
    const p = (res && res.data) || {};
    setBody(`
      <h4>${esc(p.title || "Untitled")}</h4>
      <div class="func-grid">
        <div>Status: ${esc(p.status || "-")}</div>
        <div>Episode: ${p.current_episode || 1}/${p.episode_count || 0}</div>
        <div>Scenes: ${p.scene_count || 0}</div>
      </div>
      <div class="func-actions">
        <a class="func-btn" href="script.html?id=${projectId}">Script</a>
        <a class="func-btn" href="storyboard.html?id=${projectId}">Storyboard</a>
        <a class="func-btn" href="render.html?id=${projectId}">Render</a>
        <a class="func-btn" href="review.html?id=${projectId}">Review</a>
      </div>
    `);
    setStatus("Project synced");
  }

  async function renderScriptPanel() {
    const projectId = await ensureProjectId();
    if (!projectId) {
      setBody("<div>No project found</div>");
      setStatus("No project", true);
      return;
    }
    const res = await api.get(`/projects/${projectId}`);
    const p = (res && res.data) || {};
    const body = setBody(`
      <h4>Script: ${esc(p.title || "Untitled")}</h4>
      <textarea id="func-script-text" class="func-input func-textarea">${esc(p.script || "")}</textarea>
      <div class="func-actions">
        <button id="func-save-script" class="func-btn" type="button">Save Script</button>
        <button id="func-decompose" class="func-btn" type="button">AI Decompose</button>
        <button id="func-submit-review" class="func-btn" type="button">Submit Review</button>
      </div>
      <div>Scenes now: ${p.scene_count || 0}</div>
    `);
    if (!body) return;
    document.getElementById("func-save-script").addEventListener("click", async function () {
      try {
        const script = document.getElementById("func-script-text").value;
        await api.put(`/projects/${projectId}`, { script });
        setStatus("Script saved");
      } catch (e) {
        setStatus(e.message || "Save failed", true);
      }
    });
    document.getElementById("func-decompose").addEventListener("click", async function () {
      try {
        await api.post(`/projects/${projectId}/decompose`);
        setStatus("Decompose completed");
        renderScriptPanel();
      } catch (e) {
        setStatus(e.message || "Decompose failed", true);
      }
    });
    document.getElementById("func-submit-review").addEventListener("click", async function () {
      try {
        await api.post(`/projects/${projectId}/submit-review`);
        setStatus("Submitted for review");
      } catch (e) {
        setStatus(e.message || "Submit failed", true);
      }
    });
    bindExisting("#2_780", () => document.getElementById("func-save-script").click());
    bindExisting("#2_786", () => document.getElementById("func-submit-review").click());
    setStatus("Script panel ready");
  }

  async function renderStoryboardPanel() {
    const projectId = await ensureProjectId();
    if (!projectId) {
      setBody("<div>No project found</div>");
      setStatus("No project", true);
      return;
    }
    const scenesRes = await api.get(`/api/scenes/?project_id=${projectId}`);
    const scenes = (scenesRes && scenesRes.data) || [];
    const firstScene = scenes[0];

    const body = setBody(`
      <h4>Scenes (${scenes.length})</h4>
      <div class="func-actions">
        <button id="func-add-scene" class="func-btn" type="button">Add Scene</button>
      </div>
      <ul class="func-list">
        ${scenes.slice(0, 12).map((s) => `
          <li>
            <div>#${s.scene_index} ${esc(s.scene_description || "")}</div>
            <div class="func-actions">
              <button class="func-btn js-img" data-id="${s.id}" type="button">Text2Image</button>
              <button class="func-btn js-video" data-id="${s.id}" type="button">Image2Video</button>
            </div>
          </li>
        `).join("")}
      </ul>
    `);
    if (!body) return;

    document.getElementById("func-add-scene").addEventListener("click", async function () {
      try {
        const next = scenes.length + 1;
        await api.post("/api/scenes/", {
          project_id: Number(projectId),
          episode_number: 1,
          scene_index: next,
          scene_description: `Scene ${next}`,
          prompt: `Scene ${next}, cinematic`,
        });
        setStatus("Scene added");
        renderStoryboardPanel();
      } catch (e) {
        setStatus(e.message || "Add scene failed", true);
      }
    });

    body.querySelectorAll(".js-img").forEach((btn) => {
      btn.addEventListener("click", async function () {
        try {
          await api.post(`/api/scenes/${btn.dataset.id}/generate-image`);
          setStatus(`Image generated for scene ${btn.dataset.id}`);
        } catch (e) {
          setStatus(e.message || "Generate image failed", true);
        }
      });
    });
    body.querySelectorAll(".js-video").forEach((btn) => {
      btn.addEventListener("click", async function () {
        try {
          await api.post(`/api/scenes/${btn.dataset.id}/generate-video`);
          setStatus(`Video generated for scene ${btn.dataset.id}`);
        } catch (e) {
          setStatus(e.message || "Generate video failed", true);
        }
      });
    });
    if (firstScene && firstScene.id) {
      bindExisting("#2_431", () => api.post(`/api/scenes/${firstScene.id}/generate-image`).then(() => setStatus("Image generated")));
      bindExisting("#2_438", () => api.post(`/api/scenes/${firstScene.id}/generate-video`).then(() => setStatus("Video generated")));
    }

    setStatus("Storyboard panel ready");
  }

  async function renderRenderPanel() {
    const projectId = await ensureProjectId();
    if (!projectId) {
      setBody("<div>No project found</div>");
      setStatus("No project", true);
      return;
    }

    const [scenesRes, tasksRes] = await Promise.all([
      api.get(`/api/scenes/?project_id=${projectId}`),
      api.get("/api/tasks/tasks?size=50"),
    ]);
    const scenes = (scenesRes && scenesRes.data) || [];
    const firstScene = scenes[0];
    const tasks = (tasksRes && tasksRes.data && tasksRes.data.items) || [];
    const byScene = {};
    tasks.forEach((t) => {
      byScene[t.scene_id] = t.status;
    });

    const body = setBody(`
      <h4>Render Queue</h4>
      <ul class="func-list">
        ${scenes.slice(0, 12).map((s) => `
          <li>
            <div>Scene #${s.scene_index} - ${esc(s.status || "")} - Task: ${esc(byScene[s.id] || "-")}</div>
            <div class="func-actions">
              <button class="func-btn js-task-img" data-id="${s.id}" type="button">Queue Text2Image</button>
              <button class="func-btn js-task-video" data-id="${s.id}" type="button">Queue Image2Video</button>
            </div>
          </li>
        `).join("")}
      </ul>
    `);
    if (!body) return;
    body.querySelectorAll(".js-task-img").forEach((btn) => {
      btn.addEventListener("click", () => createTask(btn.dataset.id, "text2img"));
    });
    body.querySelectorAll(".js-task-video").forEach((btn) => {
      btn.addEventListener("click", () => createTask(btn.dataset.id, "img2video"));
    });
    if (firstScene && firstScene.id) {
      bindExisting("#2_509", () => createTask(firstScene.id, "text2img"));
      bindExisting("#2_511", () => createTask(firstScene.id, "img2video"));
    }
    setStatus("Render panel ready");
  }

  async function createTask(sceneId, taskType) {
    try {
      await api.post("/api/tasks/tasks", { scene_id: Number(sceneId), task_type: taskType });
      setStatus(`Task queued: ${taskType} scene ${sceneId}`);
      renderByPage();
    } catch (e) {
      setStatus(e.message || "Queue failed", true);
    }
  }

  async function renderReviewPanel() {
    const projectId = await ensureProjectId();
    if (!projectId) {
      setBody("<div>No project found</div>");
      setStatus("No project", true);
      return;
    }
    const [projectRes, reviewsRes] = await Promise.all([
      api.get(`/projects/${projectId}`),
      api.get(`/api/reviews/?project_id=${projectId}&size=20`),
    ]);
    const p = (projectRes && projectRes.data) || {};
    const history = (reviewsRes && reviewsRes.data && reviewsRes.data.items) || [];

    const body = setBody(`
      <h4>Review: ${esc(p.title || "Untitled")}</h4>
      <div class="func-actions">
        <select id="func-review-status" class="func-input">
          <option value="approved">approved</option>
          <option value="rejected">rejected</option>
        </select>
        <input id="func-review-comment" class="func-input" placeholder="Comment">
        <button id="func-review-submit" class="func-btn" type="button">Submit Review</button>
      </div>
      <h4>History</h4>
      <ul class="func-list">
        ${history.map((r) => `<li><div>${esc(r.status)}</div><div>${esc(r.comment || "")}</div></li>`).join("")}
      </ul>
    `);
    if (!body) return;
    document.getElementById("func-review-submit").addEventListener("click", async function () {
      try {
        const status = document.getElementById("func-review-status").value;
        const comment = document.getElementById("func-review-comment").value;
        await api.post("/api/reviews/", { project_id: Number(projectId), status, comment });
        setStatus("Review submitted");
        renderReviewPanel();
      } catch (e) {
        setStatus(e.message || "Submit failed", true);
      }
    });
    bindExisting("#2_588", () => document.getElementById("func-review-submit").click());
    setStatus("Review panel ready");
  }

  async function renderExportPanel() {
    const projectId = await ensureProjectId();
    if (!projectId) {
      setBody("<div>No project found</div>");
      setStatus("No project", true);
      return;
    }
    const assetsRes = await api.get(`/api/export/export/project/${projectId}/assets`);
    const a = (assetsRes && assetsRes.data) || {};
    const body = setBody(`
      <h4>Export Assets</h4>
      <div class="func-grid">
        <div>Total Scenes: ${a.total_scenes || 0}</div>
        <div>Images: ${a.images_count || 0}</div>
        <div>Videos: ${a.videos_count || 0}</div>
      </div>
      <div class="func-actions">
        <button id="func-export-package" class="func-btn" type="button">Build Package</button>
      </div>
      <div id="func-export-result"></div>
    `);
    if (!body) return;
    document.getElementById("func-export-package").addEventListener("click", async function () {
      try {
        const res = await api.post(`/api/export/export/project/${projectId}/package`);
        const data = (res && res.data) || {};
        const node = document.getElementById("func-export-result");
        if (node) node.textContent = `Package ready: ${data.download_url || "-"}`;
        setStatus("Package created");
      } catch (e) {
        setStatus(e.message || "Package failed", true);
      }
    });
    bindExisting("#2_716", () => document.getElementById("func-export-package").click());
    bindExisting("#2_718", () => document.getElementById("func-export-package").click());
    bindExisting("#2_720", () => document.getElementById("func-export-package").click());
    setStatus("Export panel ready");
  }

  function esc(v) {
    return String(v || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }
})();
