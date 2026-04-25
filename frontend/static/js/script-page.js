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
    bindAction("save", saveScript);
    bindAction("decompose", decomposeScript);
    bindAction("submit", submitReview);
  }

  function bindClick(selector, handler) {
    const node = document.querySelector(selector);
    if (!node) return;
    if (node.dataset.boundClick === "1") return;
    node.dataset.boundClick = "1";
    node.addEventListener("click", handler);
  }

  function bindAction(actionName, handler) {
    document.querySelectorAll(`[data-action='${actionName}']`).forEach((node) => {
      if (node.dataset.boundClick === "1") return;
      node.dataset.boundClick = "1";
      node.addEventListener("click", handler);
    });
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
      const episode = p.current_episode || 1;
      const title = p.title || "未命名项目";

      setText("#script-page-title", "剧本工位");
      setText("#script-page-subtitle", `${title} · 第${episode}集`);
      setText("#script-project-name", title);
      setText("#script-project-episode", `第${episode}集`);
      setText("#script-project-writer", p.writer || "李编剧");
      setText("#script-project-stage", p.status_label || "草稿编辑中");

      const summaryNode = document.querySelector("#script-summary-input");
      if (summaryNode) {
        summaryNode.value = p.description || p.summary || summaryNode.value || "";
      }

      const episodeTitleNode = document.querySelector("#script-title-input");
      if (episodeTitleNode && p.episode_title) {
        episodeTitleNode.value = p.episode_title;
      }

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
      list.innerHTML = `
        <li class="script-version-item is-active">
          <span class="script-version-dot"></span>
          <span class="script-version-main">当前版本 v0.1</span>
          <span class="script-version-time">刚刚</span>
        </li>
      `;
      return;
    }
    list.innerHTML = scenes
      .slice(0, 8)
      .map(
        (s, index) => `
      <li class="script-version-item ${index === 0 ? "is-active" : ""}">
        <span class="script-version-dot"></span>
        <span class="script-version-main">Scene ${escapeHtml(String(s.scene_index || index + 1))} 版本</span>
        <span class="script-version-time">${index === 0 ? "刚刚" : `${index + 1}小时前`}</span>
      </li>
    `,
      )
      .join("");
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
