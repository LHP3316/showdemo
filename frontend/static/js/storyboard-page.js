/**
 * Storyboard workbench page
 */
(function () {
  let projectId = null;
  let scenes = [];

  document.addEventListener("DOMContentLoaded", async function () {
    if (!window.CommonApp || !window.api) return;
    const ok = await CommonApp.ensureSession(true);
    if (!ok) return;

    projectId = await ensureProjectId();
    bindActions();
    await loadData();
  });

  function bindActions() {
    bindClick("#btn-add-scene", addScene);
    bindClick("#btn-batch-image", batchGenerateImages);
    bindClick("#btn-batch-video", batchGenerateVideos);
  }

  function bindClick(selector, handler) {
    const node = document.querySelector(selector);
    if (!node) return;
    node.addEventListener("click", handler);
  }

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
      window.history.replaceState({}, "", `storyboard.html?id=${first.id}`);
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
      const [projectRes, scenesRes] = await Promise.all([
        api.get(`/projects/${projectId}`),
        api.get(`/api/scenes/?project_id=${projectId}`),
      ]);
      const p = (projectRes && projectRes.data) || {};
      scenes = (scenesRes && scenesRes.data) || [];

      setText("#storyboard-page-title", `分镜工位 - ${p.title || "Untitled"}`);
      setText("#storyboard-page-subtitle", `Total scenes: ${scenes.length}`);
      renderSceneTable();
      setStatus("Loaded");
    } catch (e) {
      setStatus(e.message || "Load failed", true);
    }
  }

  function renderSceneTable() {
    const body = document.querySelector("#scene-table-body");
    if (!body) return;
    if (!scenes.length) {
      body.innerHTML = "<tr><td colspan='4'>暂无数据</td></tr>";
      return;
    }
    body.innerHTML = scenes.map((s) => `
      <tr>
        <td>${s.scene_index}</td>
        <td>${escapeHtml(s.scene_description || "-")}</td>
        <td><span class="badge">${escapeHtml(s.status || "-")}</span></td>
        <td>
          <div class="actions">
            <button class="btn js-gen-image" data-id="${s.id}" type="button">文生图</button>
            <button class="btn js-gen-video" data-id="${s.id}" type="button">图生视频</button>
          </div>
        </td>
      </tr>
    `).join("");

    body.querySelectorAll(".js-gen-image").forEach((btn) => {
      btn.addEventListener("click", () => generateImage(btn.getAttribute("data-id")));
    });
    body.querySelectorAll(".js-gen-video").forEach((btn) => {
      btn.addEventListener("click", () => generateVideo(btn.getAttribute("data-id")));
    });
  }

  async function addScene() {
    if (!projectId) return;
    const description = val("#scene-description");
    const prompt = val("#scene-prompt");
    const nextIndex = (scenes.length ? Math.max(...scenes.map((s) => Number(s.scene_index || 0))) : 0) + 1;

    try {
      await api.post("/api/scenes/", {
        project_id: Number(projectId),
        episode_number: 1,
        scene_index: nextIndex,
        scene_description: description || `Scene ${nextIndex}`,
        prompt: prompt || `Scene ${nextIndex}, cinematic`,
      });
      setStatus("Scene created");
      await loadData();
    } catch (e) {
      setStatus(e.message || "Create scene failed", true);
    }
  }

  async function generateImage(sceneId) {
    if (!sceneId) return;
    try {
      await api.post(`/api/scenes/${sceneId}/generate-image`);
      setStatus(`Image generated for scene ${sceneId}`);
      await loadData();
    } catch (e) {
      setStatus(e.message || "Generate image failed", true);
    }
  }

  async function generateVideo(sceneId) {
    if (!sceneId) return;
    try {
      await api.post(`/api/scenes/${sceneId}/generate-video`);
      setStatus(`Video generated for scene ${sceneId}`);
      await loadData();
    } catch (e) {
      setStatus(e.message || "Generate video failed", true);
    }
  }

  async function batchGenerateImages() {
    if (!projectId) return;
    try {
      await api.post(`/api/scenes/batch/generate-images?project_id=${projectId}`);
      setStatus("Batch image generation triggered");
      await loadData();
    } catch (e) {
      setStatus(e.message || "Batch image failed", true);
    }
  }

  async function batchGenerateVideos() {
    if (!projectId) return;
    try {
      await api.post(`/api/scenes/batch/generate-videos?project_id=${projectId}`);
      setStatus("Batch video generation triggered");
      await loadData();
    } catch (e) {
      setStatus(e.message || "Batch video failed", true);
    }
  }

  function val(selector) {
    const node = document.querySelector(selector);
    return node ? node.value.trim() : "";
  }

  function setText(selector, text) {
    const node = document.querySelector(selector);
    if (node) node.textContent = text;
  }

  function setStatus(message, isError) {
    const node = document.querySelector("#storyboard-status");
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

