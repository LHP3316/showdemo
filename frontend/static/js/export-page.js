/**
 * Export center page
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
    const btn = document.querySelector("#btn-export-package");
    if (btn) btn.addEventListener("click", buildPackage);
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
      window.history.replaceState({}, "", `export.html?id=${first.id}`);
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
      const [projectRes, assetsRes] = await Promise.all([
        api.get(`/projects/${projectId}`),
        api.get(`/api/export/export/project/${projectId}/assets`),
      ]);
      const p = (projectRes && projectRes.data) || {};
      const a = (assetsRes && assetsRes.data) || {};

      setText("#export-page-title", `导出交付 - ${p.title || "Untitled"}`);
      setText("#export-page-subtitle", `Episode ${p.current_episode || 1}/${p.episode_count || 0}`);
      setText("#export-total-scenes", String(a.total_scenes || 0));
      setText("#export-images", String(a.images_count || 0));
      setText("#export-videos", String(a.videos_count || 0));

      renderAssets(a.assets || []);
      setStatus("Loaded");
    } catch (e) {
      setStatus(e.message || "Load failed", true);
    }
  }

  function renderAssets(items) {
    const body = document.querySelector("#export-assets-body");
    if (!body) return;
    if (!items.length) {
      body.innerHTML = "<tr><td colspan='3'>暂无数据</td></tr>";
      return;
    }
    body.innerHTML = items.slice(0, 80).map((a) => `
      <tr>
        <td>#${a.scene_index || "-"}</td>
        <td>${a.image_url ? `<a href="${escapeHtml(a.image_url)}" target="_blank">Image</a>` : "-"}</td>
        <td>${a.video_url ? `<a href="${escapeHtml(a.video_url)}" target="_blank">Video</a>` : "-"}</td>
      </tr>
    `).join("");
  }

  async function buildPackage() {
    if (!projectId) return;
    try {
      const res = await api.post(`/api/export/export/project/${projectId}/package`);
      const data = (res && res.data) || {};
      setStatus(`Package created: ${data.download_url || "-"}`);
    } catch (e) {
      setStatus(e.message || "Build package failed", true);
    }
  }

  function setText(selector, text) {
    const node = document.querySelector(selector);
    if (node) node.textContent = text;
  }

  function setStatus(message, isError) {
    const node = document.querySelector("#export-status");
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

