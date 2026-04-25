/**
 * Review center page
 *
 * 注意：review.html 已改版为「分镜审核会话」静态结构（2026）。
 * 接回动态数据前请对照 DOM：#review-page-title、#review-page-subtitle、
 * #review-comment-text、#btn-submit-review、#btn-review-pass、#btn-review-reject；
 * 历史列表不再使用 #review-history-body 表格，请改为请求后渲染 .rsa-history-list。
 */
(function () {
  let projectId = null;
  let selectedStatus = "approved";

  document.addEventListener("DOMContentLoaded", async function () {
    if (!window.CommonApp || !window.api) return;
    const ok = await CommonApp.ensureSession(true);
    if (!ok) return;

    projectId = await ensureProjectId();
    bindActions();
    await loadData();
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
      window.history.replaceState({}, "", `review.html?id=${first.id}`);
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
      const [projectRes, reviewRes] = await Promise.all([
        api.get(`/projects/${projectId}`),
        api.get(`/api/reviews/?project_id=${projectId}&size=50`),
      ]);
      const p = (projectRes && projectRes.data) || {};
      const history = (reviewRes && reviewRes.data && reviewRes.data.items) || [];

      setText("#review-page-title", "分镜审核会话");
      setText(
        "#review-page-subtitle",
        `${p.title || "未命名项目"} · 当前状态：${mapProjectStatus(p.status)}`
      );
      renderHistory(history);
      setStatus("已加载");
    } catch (e) {
      setStatus(e.message || "加载失败", true);
    }
  }

  function renderHistory(items) {
    const list = document.querySelector(".rsa-history-list");
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
      await loadData();
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
})();

