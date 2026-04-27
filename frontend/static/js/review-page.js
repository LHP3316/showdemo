/**
 * Review center page
 *
 * 注意：review.html 已改版为「分镜审核会话」静态结构（2026）。
 * 接回动态数据前请对照 DOM：#review-page-title、#review-page-subtitle、
 * #review-comment-text、#btn-submit-review、#btn-review-pass、#btn-review-reject；
 * 历史列表不再使用 #review-history-body 表格，请改为请求后渲染 .rsa-history-list。
 */
(function () {
  const BACKEND_MEDIA_BASE = "http://localhost:8001";
  let projectId = null;
  let projectItems = [];
  let selectedStatus = "approved";

  document.addEventListener("DOMContentLoaded", async function () {
    if (!window.CommonApp || !window.api) return;
    const ok = await CommonApp.ensureSession(true);
    if (!ok) return;

    bindActions();
    await loadReviewProjects();
  });

  function bindActions() {
    const form = document.querySelector("#review-comment-form");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        submitReview();
      });
    }

    const passBtn = document.querySelector("#btn-review-pass");
    if (passBtn) {
      passBtn.addEventListener("click", function () {
        selectedStatus = "approved";
        submitReview();
      });
    }

    const rejectBtn = document.querySelector("#btn-review-reject");
    if (rejectBtn) {
      rejectBtn.addEventListener("click", function () {
        selectedStatus = "rejected";
        submitReview();
      });
    }

    const cancelBtn = document.querySelector("#btn-review-cancel");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", function () {
        const box = document.querySelector("#review-comment-text");
        if (box) box.value = "";
        setStatus("已清空审核意见");
      });
    }
  }

  async function loadReviewProjects() {
    try {
      const res = await api.get("/api/reviews/projects?size=100");
      const items = (res && res.data && Array.isArray(res.data.items)) ? res.data.items : [];
      projectItems = items;
      renderProjectList(items);

      const focusId = localStorage.getItem("review_focus_project_id");
      const hit = focusId ? items.find((p) => String(p.id) === String(focusId)) : null;
      if (focusId) localStorage.removeItem("review_focus_project_id");

      if (!items.length) {
        projectId = null;
        setText("#review-page-title", "项目审核中心");
        setText("#review-page-subtitle", "暂无待审核或已审核项目");
        renderHistory([]);
        setStatus("暂无可展示项目");
        return;
      }
      const target = hit || items[0];
      await selectProject(target.id);
      setStatus("已加载");
    } catch (e) {
      setStatus(e.message || "加载失败", true);
    }
  }

  async function selectProject(pid) {
    projectId = String(pid || "");
    if (!projectId) return;
    localStorage.setItem("activeProjectId", projectId);
    highlightActiveProject(projectId);
    const project = projectItems.find((p) => String(p.id) === String(projectId)) || {};
    setText("#review-page-title", "项目审核中心");
    setText(
      "#review-page-subtitle",
      `${project.title || "未命名项目"} · 当前状态：${mapProjectStatus(project.status)}`
    );

    const reviewRes = await api.get(`/api/reviews/?project_id=${projectId}&size=50`);
    const history = (reviewRes && reviewRes.data && reviewRes.data.items) || [];
    renderHistory(history);
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
      node.addEventListener("click", async function () {
        const pid = node.getAttribute("data-project-id");
        if (!pid) return;
        try {
          await selectProject(pid);
        } catch (e) {
          setStatus(e.message || "切换项目失败", true);
        }
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

  function highlightActiveProject(pid) {
    const list = document.querySelector("#review-project-list");
    if (!list) return;
    list.querySelectorAll(".rsa-project-card").forEach((card) => {
      card.classList.remove("is-active");
    });
    list.querySelectorAll(".js-review-project").forEach((node) => {
      if (node.getAttribute("data-project-id") === String(pid)) {
        const card = node.closest(".rsa-project-card");
        if (card) card.classList.add("is-active");
      }
    });
  }

  function renderHistory(items) {
    const list = document.querySelector("#review-history-list");
    if (!list) return;
    if (!items.length) {
      list.innerHTML = "<li class='rsa-history-item'><article><p class='rsa-history-item__body'>暂无历史审核记录</p></article></li>";
      return;
    }
    list.innerHTML = items.map((r) => {
      const name = String(r.reviewer_id || "导演");
      const time = String(r.created_at || "");
      const statusText = r.status === "approved" ? "已通过" : r.status === "rejected" ? "驳回" : (r.status || "-");
      const statusClass = r.status === "approved" ? "rsa-history-item__status--pass" : "rsa-history-item__status--reject";
      const avatar = String(name).trim().charAt(0) || "导";
      const comment = (r.comment && String(r.comment).trim()) ? String(r.comment).trim() : "（无备注）";
      return `
        <li class="rsa-history-item">
          <article aria-label="${escapeHtml(name)} 审核记录">
            <header class="rsa-history-item__head">
              <span class="rsa-avatar rsa-avatar--green" aria-hidden="true">${escapeHtml(avatar)}</span>
              <div class="rsa-history-item__meta">
                <div class="rsa-history-item__row">
                  <span class="rsa-history-item__name">${escapeHtml(name)}</span>
                  <time class="rsa-history-item__time">${escapeHtml(time)}</time>
                  <span class="rsa-history-item__status ${statusClass}">${escapeHtml(statusText)}</span>
                </div>
              </div>
            </header>
            <p class="rsa-history-item__body">${escapeHtml(comment)}</p>
          </article>
        </li>
      `;
    }).join("");
  }

  async function submitReview() {
    if (!projectId) return;
    const status = selectedStatus || "approved";
    const comment = val("#review-comment-text");
    try {
      await api.post("/api/reviews/", {
        project_id: Number(projectId),
        status,
        comment,
      });
      setStatus(status === "approved" ? "已提交：审核通过" : "已提交：驳回修改");
      await loadReviewProjects();
    } catch (e) {
      setStatus(e.message || "提交失败", true);
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
    const node = document.querySelector("#review-status");
    if (!node) return;
    node.textContent = message;
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
    if (text.startsWith("/uploads/")) return `${BACKEND_MEDIA_BASE}${text}`;
    return text;
  }
})();

