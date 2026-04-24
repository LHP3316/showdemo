/* ========================================
   审核中心
   ======================================== */
(function () {
  let state = {
    projects: [],
    selectedProjectId: null,
    scenes: [],
    reviews: [],
  };

  function render() {
    return `
      <div class="grid grid-cols-1 xl:grid-cols-12 gap-4 fade-in">
        <section class="xl:col-span-4 bg-dark-800 border border-dark-500 rounded-xl p-4">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-base font-semibold text-gray-100">待审核项目</h2>
            <button id="review-refresh" class="px-3 py-1.5 rounded-lg bg-dark-600 hover:bg-dark-500 text-sm text-gray-200">刷新</button>
          </div>
          <div id="review-project-list" class="space-y-2"></div>
        </section>

        <section class="xl:col-span-8 bg-dark-800 border border-dark-500 rounded-xl p-4">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-base font-semibold text-gray-100">审核详情</h2>
            <div class="flex items-center gap-2">
              <button id="review-approve" class="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm">通过</button>
              <button id="review-reject" class="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm">驳回</button>
            </div>
          </div>
          <textarea id="review-comment" class="textarea-dark mb-3" placeholder="审核意见（可选）"></textarea>
          <div id="review-scenes" class="grid grid-cols-1 md:grid-cols-2 gap-3"></div>
          <div class="mt-4">
            <h3 class="text-sm text-gray-300 mb-2">历史审核记录</h3>
            <div id="review-history" class="space-y-2"></div>
          </div>
        </section>
      </div>
    `;
  }

  function mount() {
    _loadProjects();
    document.getElementById("review-refresh").addEventListener("click", _loadProjects);
    document.getElementById("review-approve").addEventListener("click", () => _submit("approved"));
    document.getElementById("review-reject").addEventListener("click", () => _submit("rejected"));
  }

  async function _loadProjects() {
    try {
      const all = await API.get("/projects/");
      state.projects = all.filter((p) => p.status === "review" || p.status === "processing");
      if (!state.selectedProjectId && state.projects.length) {
        state.selectedProjectId = state.projects[0].id;
      }
      _renderProjects();
      if (state.selectedProjectId) {
        await _loadDetail(state.selectedProjectId);
      }
    } catch (err) {
      App.showToast(err.message, "error");
    }
  }

  function _renderProjects() {
    const el = document.getElementById("review-project-list");
    if (!el) return;
    if (!state.projects.length) {
      el.innerHTML = `<div class="text-sm text-gray-500">暂无待审核项目</div>`;
      return;
    }
    el.innerHTML = state.projects
      .map(
        (p) => `
      <button data-id="${p.id}" class="w-full text-left border rounded-lg p-3 ${
        p.id === state.selectedProjectId
          ? "border-blue-500 bg-blue-500/10"
          : "border-dark-500 bg-dark-700 hover:border-dark-400"
      }">
        <div class="text-sm text-gray-100 font-medium">${p.title}</div>
        <div class="text-xs text-gray-500 mt-1">状态：${p.status}</div>
      </button>
    `
      )
      .join("");
    el.querySelectorAll("button[data-id]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        state.selectedProjectId = Number(btn.getAttribute("data-id"));
        _renderProjects();
        await _loadDetail(state.selectedProjectId);
      });
    });
  }

  async function _loadDetail(projectId) {
    try {
      state.scenes = await API.get(`/api/scenes/?project_id=${projectId}`);
      state.reviews = await API.get(`/api/reviews/?project_id=${projectId}`);
      _renderScenes();
      _renderReviews();
    } catch (err) {
      App.showToast(err.message, "error");
    }
  }

  function _renderScenes() {
    const el = document.getElementById("review-scenes");
    if (!el) return;
    if (!state.scenes.length) {
      el.innerHTML = `<div class="text-sm text-gray-500">该项目暂无分镜</div>`;
      return;
    }
    el.innerHTML = state.scenes
      .map(
        (s) => `
      <article class="border border-dark-500 rounded-lg p-3 bg-dark-700">
        <div class="text-xs text-gray-500 mb-2">Scene ${s.scene_index}</div>
        <div class="text-sm text-gray-300 mb-2">${_escape(s.scene_description || s.prompt || "")}</div>
        ${
          s.image_url
            ? `<img src="${s.image_url}" class="w-full h-36 object-cover rounded-md border border-dark-500" alt="scene" />`
            : `<div class="h-36 rounded-md border border-dashed border-dark-500 flex items-center justify-center text-xs text-gray-500">暂无图片</div>`
        }
      </article>
    `
      )
      .join("");
  }

  function _renderReviews() {
    const el = document.getElementById("review-history");
    if (!el) return;
    if (!state.reviews.length) {
      el.innerHTML = `<div class="text-sm text-gray-500">暂无审核记录</div>`;
      return;
    }
    el.innerHTML = state.reviews
      .map(
        (r) => `
      <div class="border border-dark-500 rounded-lg p-3 bg-dark-700">
        <div class="text-xs text-gray-500">状态：${r.status} · 审核人ID：${r.reviewer_id}</div>
        <div class="text-sm text-gray-300 mt-1">${_escape(r.comment || "无备注")}</div>
      </div>
    `
      )
      .join("");
  }

  async function _submit(status) {
    if (!state.selectedProjectId) return App.showToast("请先选择项目", "warning");
    const comment = document.getElementById("review-comment").value.trim();
    try {
      await API.post("/api/reviews/", {
        project_id: state.selectedProjectId,
        status,
        comment,
      });
      App.showToast("审核已提交", "success");
      document.getElementById("review-comment").value = "";
      await _loadDetail(state.selectedProjectId);
      await _loadProjects();
    } catch (err) {
      App.showToast(err.message, "error");
    }
  }

  function _escape(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  window.ReviewPage = { render, mount };
})();
