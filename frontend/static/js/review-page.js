/**
 * Review center page
 *
 * 注意：review.html 已改版为「分镜审核会话」静态结构（2026）。
 * 接回动态数据前请对照 DOM：#review-page-title、#review-page-subtitle、
 * #review-comment-text、#btn-submit-review、#btn-review-pass、#btn-review-reject；
 * 历史列表不再使用 #review-history-body 表格，请改为请求后渲染 .rsa-history-list。
 */
(function () {
  let projectItems = [];
  let page = 1;
  let size = 12;
  let total = 0;

  document.addEventListener("DOMContentLoaded", async function () {
    if (!window.CommonApp || !window.api) return;
    const ok = await CommonApp.ensureSession(true);
    if (!ok) return;

    bindActions();
    await loadReviewProjects();
  });

  function bindActions() {
    const prevBtn = document.querySelector("#review-page-prev");
    const nextBtn = document.querySelector("#review-page-next");
    if (prevBtn) {
      prevBtn.addEventListener("click", async function () {
        if (page <= 1) return;
        page -= 1;
        await loadReviewProjects();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", async function () {
        const totalPages = Math.max(1, Math.ceil(total / size));
        if (page >= totalPages) return;
        page += 1;
        await loadReviewProjects();
      });
    }
  }

  async function loadReviewProjects() {
    try {
      const res = await api.get(`/api/reviews/projects?page=${page}&size=${size}`);
      const payload = (res && res.data) || {};
      const items = Array.isArray(payload.items) ? payload.items : [];
      total = Number(payload.total || 0);
      projectItems = items;
      renderProjectList(items);
      if (!items.length) {
        const totalPages = Math.max(1, Math.ceil(total / size));
        if (page > totalPages) {
          page = totalPages;
          await loadReviewProjects();
          return;
        }
        setText("#review-page-subtitle", "暂无待审核或已审核项目");
        setStatus("");
        updatePagination();
        return;
      }
      setText("#review-page-subtitle", `共 ${total} 个审核项目`);
      updatePagination();
      setStatus("");
    } catch (e) {
      setStatus(e.message || "加载失败", true);
    }
  }

  function renderProjectList(items) {
    const list = document.querySelector("#review-project-list");
    if (!list) return;
    if (!items.length) {
      list.innerHTML = "<li class='rsa-project-card'><article class='rsa-project-card__inner'><div class='rsa-project-card__body'><p class='rsa-project-card__meta'>暂无项目</p></div></article></li>";
      return;
    }
    list.innerHTML = items.map((p) => {
      const statusText = mapProjectStatus(p.status);
      const badgeClass = p.status === "approved"
        ? "rsa-project-card__badge--approved"
        : (p.status === "rejected" ? "rsa-project-card__badge--rejected" : "rsa-project-card__badge--pending");
      const reviewer = p.latest_reviewer || "—";
      const time = p.latest_review_at || p.updated_at || "";
      const imageUrl = resolveMediaUrl(p.preview_image_url);
      const videoUrl = resolveMediaUrl(p.preview_video_url);
      const thumbNode = imageUrl
        ? `<img class="rsa-project-thumb__img" src="${escapeAttr(imageUrl)}" alt="${escapeAttr(p.title || `项目#${p.id}`)} 预览图" loading="lazy" />`
        : (videoUrl
          ? `<video class="rsa-project-thumb__video" src="${escapeAttr(videoUrl)}" preload="metadata" muted playsinline></video>`
          : `<img class="rsa-project-thumb__img" src="tu.png" alt="默认预览图" loading="lazy" />`);
      return `
        <li class="rsa-project-card">
          <article class="rsa-project-card__inner js-review-project" data-project-id="${escapeHtml(String(p.id))}">
            <div class="rsa-project-card__media">
              <span class="rsa-project-thumb" aria-hidden="true">${thumbNode}</span>
              <span class="rsa-project-card__badge ${badgeClass}">${escapeHtml(statusText)}</span>
            </div>
            <div class="rsa-project-card__body">
              <h3 class="rsa-project-card__title">${escapeHtml(p.title || `项目#${p.id}`)}</h3>
              <p class="rsa-project-card__meta">最近审核人：${escapeHtml(String(reviewer))}</p>
              <p class="rsa-project-card__meta">${escapeHtml(String(time))}</p>
            </div>
          </article>
        </li>
      `;
    }).join("");

    list.querySelectorAll(".js-review-project").forEach((node) => {
      node.addEventListener("click", function () {
        const pid = node.getAttribute("data-project-id");
        if (!pid) return;
        localStorage.setItem("activeProjectId", String(pid));
        window.location.href = `review-workbench.html?id=${encodeURIComponent(String(pid))}`;
      });
    });

    // 视频缩略图显示首帧（无需用户播放）
    list.querySelectorAll(".rsa-project-thumb__video").forEach((video) => {
      video.addEventListener("loadedmetadata", function () {
        try {
          video.currentTime = 0.01;
          video.pause();
        } catch {}
      }, { once: true });
    });
  }

  function updatePagination() {
    const totalPages = Math.max(1, Math.ceil(total / size));
    const info = document.querySelector("#review-page-info");
    const prevBtn = document.querySelector("#review-page-prev");
    const nextBtn = document.querySelector("#review-page-next");
    const pager = document.querySelector(".rsa-pagination");
    if (pager) pager.hidden = totalPages <= 1;
    if (info) info.textContent = `第 ${page} / ${totalPages} 页`;
    if (prevBtn) prevBtn.disabled = page <= 1;
    if (nextBtn) nextBtn.disabled = page >= totalPages;
  }

  function setText(selector, text) {
    const node = document.querySelector(selector);
    if (node) node.textContent = text;
  }

  function setStatus(message, isError) {
    const node = document.querySelector("#review-status");
    if (!node) return;
    const text = String(message || "").trim();
    node.textContent = text;
    node.hidden = !text;
    node.style.color = isError ? "#fca5a5" : "#93c5fd";
  }

  function mapProjectStatus(status) {
    const map = {
      draft: "草稿",
      processing: "制作中",
      review: "待审核",
      approved: "已通过",
      rejected: "已驳回",
    };
    return map[status] || (status || "-");
  }

  function escapeHtml(text) {
    return String(text || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function escapeAttr(text) {
    return escapeHtml(String(text || "")).replaceAll("\"", "&quot;");
  }

  function resolveMediaUrl(url) {
    const text = String(url || "").trim();
    if (!text) return "";
    return text.replaceAll("\\", "/");
  }
})();

