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

  document.addEventListener("DOMContentLoaded", async function () {
    if (!window.CommonApp || !window.api) return;
    const ok = await CommonApp.ensureSession(true);
    if (!ok) return;

    projectId = await ensureProjectId();
    bindActions();
    await loadData();
  });

  function bindActions() {
    const btn = document.querySelector("#btn-submit-review");
    if (btn) btn.addEventListener("click", submitReview);
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

      setText("#review-page-title", `审核中心 - ${p.title || "Untitled"}`);
      setText("#review-page-subtitle", `Current status: ${p.status || "-"}`);
      renderHistory(history);
      setStatus("Loaded");
    } catch (e) {
      setStatus(e.message || "Load failed", true);
    }
  }

  function renderHistory(items) {
    const body = document.querySelector("#review-history-body");
    if (!body) return;
    if (!items.length) {
      body.innerHTML = "<tr><td colspan='3'>暂无历史</td></tr>";
      return;
    }
    body.innerHTML = items.map((r) => `
      <tr>
        <td><span class="badge">${escapeHtml(r.status || "-")}</span></td>
        <td>${escapeHtml(r.comment || "-")}</td>
        <td>${escapeHtml(r.created_at || "-")}</td>
      </tr>
    `).join("");
  }

  async function submitReview() {
    if (!projectId) return;
    const status = val("#review-result") || "approved";
    const comment = val("#review-comment");
    try {
      await api.post("/api/reviews/", {
        project_id: Number(projectId),
        status,
        comment,
      });
      setStatus("Review submitted");
      await loadData();
    } catch (e) {
      setStatus(e.message || "Submit failed", true);
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
    node.classList.toggle("error", !!isError);
  }

  function escapeHtml(text) {
    return String(text || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }
})();

