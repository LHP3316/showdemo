/**
 * Export center page
 */
(function () {
  let projectId = null;
  let page = 1;
  let size = 10;
  let total = 0;

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

    const prev = document.querySelector("#export-page-prev");
    const next = document.querySelector("#export-page-next");
    if (prev) {
      prev.addEventListener("click", async function () {
        if (page <= 1) return;
        page -= 1;
        await loadData();
      });
    }
    if (next) {
      next.addEventListener("click", async function () {
        const totalPages = Math.max(1, Math.ceil(total / size));
        if (page >= totalPages) return;
        page += 1;
        await loadData();
      });
    }
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
      const res = await api.get("/projects/", { size: 1 });
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
      updatePagination();
      return;
    }

    try {
      const [projectRes, assetsRes] = await Promise.all([
        api.get(`/projects/${projectId}`),
        api.get(`/api/export/export/project/${projectId}/assets?page=${page}&size=${size}`),
      ]);
      const p = (projectRes && projectRes.data) || {};
      const a = (assetsRes && assetsRes.data) || {};

      setText("#export-page-title", "导出中心");
      setText(
        "#export-page-subtitle",
        `${p.title || "寻龙少年"} · 全${p.episode_count || 12}集 · 审核已通过 · 可导出`
      );
      setText("#export-total-scenes", String(a.total_scenes || 0));
      const imagesCount = Number(a.images_count || 0);
      const videosCount = Number(a.videos_count || 0);
      setText("#export-images", `${imagesCount} 张`);
      setText("#export-videos", `${videosCount} 个`);
      setText("#export-total-assets", `${imagesCount + videosCount} 个文件`);

      total = Number(a.total || 0);
      renderAssets(a.items || a.assets || []);
      updatePagination();
      setStatus("加载完成");
    } catch (e) {
      setStatus(e && e.message ? e.message : "加载失败，使用演示数据", true);
      renderAssets([]);
      updatePagination();
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

    body.innerHTML = items.map((a) => {
      const sceneIdx = String(a.scene_index || 1).padStart(2, "0");
      const name = a.file_name || `第${sceneIdx}场_导出资产`;
      const imageUrl = String(a.image_url || "").trim();
      const videoUrl = String(a.video_url || "").trim();
      const hasImage = !!imageUrl;
      const hasVideo = !!videoUrl;
      const type = hasImage && hasVideo ? "图片+视频" : (hasVideo ? "视频" : (hasImage ? "图片" : "—"));
      const fileSize = a.file_size || (a.video_url ? "—" : "—");
      const done = hasImage || hasVideo;
      const pillClass = done ? "state-pill--done" : "state-pill--pending";
      const pillText = done ? "可下载" : "生成中";

      const actionNode = done
        ? `<div class="download-group">
            <button class="download-btn" data-scene-id="${escapeHtml(String(a.scene_id || ""))}" type="button">下载</button>
          </div>`
        : `<div class="download-group">
            <button class="download-btn download-btn--disabled" type="button" disabled>等待中</button>
          </div>`;
      return `
        <div class="asset-row" role="row">
          <div class="asset-name" role="cell">${escapeHtml(name)}</div>
          <div role="cell">${type}</div>
          <div role="cell">${escapeHtml(fileSize)}</div>
          <div role="cell"><span class="state-pill ${pillClass}">${pillText}</span></div>
          <div role="cell">${actionNode}</div>
        </div>
      `;
    }).join("");

    body.querySelectorAll(".download-btn").forEach((btn) => {
      if (btn.classList.contains("download-btn--disabled")) return;
      btn.addEventListener("click", async function () {
        const sceneId = String(btn.getAttribute("data-scene-id") || "").trim();
        if (!sceneId || !projectId) return;
        try {
          btn.disabled = true;
          btn.textContent = "打包中…";
          const res = await api.post(`/api/export/export/project/${projectId}/scene/${sceneId}/package`);
          const data = (res && res.data) || {};
          const url = String(data.download_url || "").trim();
          if (url) {
            const jump = url.startsWith("http") ? url : url.startsWith("/") ? url : "";
            if (jump) window.open(jump, "_blank", "noopener,noreferrer");
          }
        } catch (e) {
          setStatus(e && e.message ? e.message : "打包失败", true);
        } finally {
          btn.disabled = false;
          btn.textContent = "下载";
        }
      });
    });
  }

  function updatePagination() {
    const totalPages = Math.max(1, Math.ceil(total / size));
    const pager = document.querySelector(".export-pagination");
    const info = document.querySelector("#export-page-info");
    const prev = document.querySelector("#export-page-prev");
    const next = document.querySelector("#export-page-next");
    if (pager) pager.hidden = totalPages <= 1;
    if (info) info.textContent = `第 ${page} / ${totalPages} 页`;
    if (prev) prev.disabled = page <= 1;
    if (next) next.disabled = page >= totalPages;
  }

  async function buildPackage() {
    if (!projectId) {
      setStatus("演示模式：已触发打包");
      return;
    }
    try {
      const res = await api.post(`/api/export/export/project/${projectId}/package`);
      const data = (res && res.data) || {};
      const url = String(data.download_url || "").trim();
      setStatus(`打包完成：${url || "-"}`);
      if (url) {
        const jump = url.startsWith("http") ? url : url.startsWith("/") ? url : "";
        if (jump) window.open(jump, "_blank", "noopener,noreferrer");
      }
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
