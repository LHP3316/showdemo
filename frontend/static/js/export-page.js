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
    const exportBtn = document.querySelector("#btn-export-package");
    if (exportBtn) exportBtn.addEventListener("click", buildPackage);
  }

  async function ensureProjectId() {
    const fromQuery = new URLSearchParams(window.location.search).get("id");
    if (fromQuery) {
      localStorage.setItem("activeProjectId", fromQuery);
      return fromQuery;
    }

    const fromCache = localStorage.getItem("activeProjectId");
    if (fromCache) return fromCache;

    try {
      const res = await api.get("/projects?size=1");
      const first = res && res.data && res.data.items ? res.data.items[0] : null;
      if (first && first.id) {
        const id = String(first.id);
        localStorage.setItem("activeProjectId", id);
        window.history.replaceState({}, "", `export.html?id=${id}`);
        return id;
      }
    } catch {
      // fallback to demo display
    }
    return null;
  }

  async function loadData() {
    if (!projectId) {
      setStatus("使用演示数据");
      renderAssets([]);
      return;
    }

    try {
      const [projectRes, assetsRes] = await Promise.all([
        api.get(`/projects/${projectId}`),
        api.get(`/api/export/export/project/${projectId}/assets`),
      ]);
      const p = (projectRes && projectRes.data) || {};
      const a = (assetsRes && assetsRes.data) || {};

      setText("#export-page-title", "导出中心");
      setText(
        "#export-page-subtitle",
        `${p.title || "寻龙少年"} · 全${p.episode_count || 12}集 · 审核已通过 · 可导出`
      );
      setText("#export-total-scenes", String(a.total_scenes || 0));
      setText("#export-images", `${a.images_count || 0} 张`);
      setText("#export-videos", `${a.videos_count || 0} 个`);

      renderAssets(a.assets || []);
      setStatus("加载完成");
    } catch (e) {
      setStatus(e && e.message ? e.message : "加载失败，使用演示数据", true);
      renderAssets([]);
    }
  }

  function renderAssets(items) {
    const body = document.querySelector("#export-assets-body");
    if (!body) return;

    if (!items.length) {
      body.innerHTML = `
        <div class="asset-row" role="row">
          <div class="asset-name" role="cell">寻龙少年_第01集_分镜图集.zip</div>
          <div role="cell">图片集</div>
          <div role="cell">128 MB</div>
          <div role="cell"><span class="state-pill state-pill--done">已完成</span></div>
          <div role="cell"><button class="download-btn" type="button">下载</button></div>
        </div>
        <div class="asset-row" role="row">
          <div class="asset-name" role="cell">寻龙少年_第01集_视频合集.mp4</div>
          <div role="cell">视频</div>
          <div role="cell">2.4 GB</div>
          <div role="cell"><span class="state-pill state-pill--done">已完成</span></div>
          <div role="cell"><button class="download-btn" type="button">下载</button></div>
        </div>
        <div class="asset-row" role="row">
          <div class="asset-name" role="cell">寻龙少年_第03集_分镜图集.zip</div>
          <div role="cell">图片集</div>
          <div role="cell">119 MB</div>
          <div role="cell"><span class="state-pill state-pill--pending">生成中</span></div>
          <div role="cell"><button class="download-btn download-btn--disabled" type="button">等待中</button></div>
        </div>
      `;
      return;
    }

    body.innerHTML = items.slice(0, 80).map((a) => {
      const name = a.file_name || `寻龙少年_第${String(a.scene_index || 1).padStart(2, "0")}集_导出资产`;
      const type = a.video_url ? "视频" : "图片集";
      const size = a.file_size || (a.video_url ? "2.4 GB" : "128 MB");
      const done = Boolean(a.video_url || a.image_url);
      return `
        <div class="asset-row" role="row">
          <div class="asset-name" role="cell">${escapeHtml(name)}</div>
          <div role="cell">${type}</div>
          <div role="cell">${escapeHtml(size)}</div>
          <div role="cell"><span class="state-pill ${done ? "state-pill--done" : "state-pill--pending"}">${done ? "已完成" : "生成中"}</span></div>
          <div role="cell"><button class="download-btn ${done ? "" : "download-btn--disabled"}" type="button">${done ? "下载" : "等待中"}</button></div>
        </div>
      `;
    }).join("");
  }

  async function buildPackage() {
    if (!projectId) {
      setStatus("演示模式：已触发打包");
      return;
    }
    try {
      const res = await api.post(`/api/export/export/project/${projectId}/package`);
      const data = (res && res.data) || {};
      setStatus(`打包完成：${data.download_url || "-"}`);
    } catch (e) {
      setStatus(e && e.message ? e.message : "打包失败", true);
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
    node.style.color = isError ? "#fca5a5" : "#93c5fd";
  }

  function escapeHtml(text) {
    return String(text || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }
})();
