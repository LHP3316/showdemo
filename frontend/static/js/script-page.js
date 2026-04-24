/**
 * Script workbench page
 */
(function () {
  let projectId = null;

  document.addEventListener("DOMContentLoaded", async function () {
    if (!window.CommonApp || !window.api) return;
    const ok = await CommonApp.ensureSession(true);
    if (!ok) return;

    projectId = await ensureProjectId();
    bindActions();
    await loadData();
  });

  function bindActions() {
    bindClick("#btn-save-script", saveScript);
    bindClick("#btn-decompose", decomposeScript);
    bindClick("#btn-submit-review", submitReview);
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
      window.history.replaceState({}, "", `script.html?id=${first.id}`);
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
      const res = await api.get(`/projects/${projectId}`);
      const p = (res && res.data) || {};
      setText("#script-page-title", `剧本工位 - ${p.title || "Untitled"}`);
      setText("#script-page-subtitle", `${p.genre || "N/A"} - EP ${p.current_episode || 1}/${p.episode_count || 0}`);

      const editor = document.querySelector("#script-editor");
      if (editor) editor.value = p.script || "";

      renderScenes(p.scenes || []);
      setStatus("Loaded");
    } catch (e) {
      setStatus(e.message || "Load failed", true);
    }
  }

  function renderScenes(scenes) {
    const list = document.querySelector("#script-scenes-list");
    if (!list) return;
    if (!scenes.length) {
      list.innerHTML = "<li class='list-item'>暂无分镜</li>";
      return;
    }
    list.innerHTML = scenes.slice(0, 8).map((s) => `
      <li class="list-item">
        <p class="item-title">Scene #${s.scene_index}</p>
        <p class="item-subtitle">${escapeHtml(s.scene_description || "-")}</p>
      </li>
    `).join("");
  }

  async function saveScript() {
    if (!projectId) return;
    const editor = document.querySelector("#script-editor");
    if (!editor) return;
    try {
      await api.put(`/projects/${projectId}`, { script: editor.value });
      setStatus("Script saved");
    } catch (e) {
      setStatus(e.message || "Save failed", true);
    }
  }

  async function decomposeScript() {
    if (!projectId) return;
    try {
      await api.post(`/projects/${projectId}/decompose`);
      setStatus("AI decompose completed");
      await loadData();
    } catch (e) {
      setStatus(e.message || "Decompose failed", true);
    }
  }

  async function submitReview() {
    if (!projectId) return;
    try {
      await api.post(`/projects/${projectId}/submit-review`);
      setStatus("Submitted for review");
      await loadData();
    } catch (e) {
      setStatus(e.message || "Submit failed", true);
    }
  }

  function setText(selector, text) {
    const node = document.querySelector(selector);
    if (node) node.textContent = text;
  }

  function setStatus(message, isError) {
    const node = document.querySelector("#script-status");
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

