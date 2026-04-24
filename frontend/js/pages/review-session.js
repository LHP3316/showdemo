/* ========================================
   审核会话
   ======================================== */
(function () {
  let state = { project: null, scenes: [], reviews: [] };

  function render(params) {
    if (params.id === "new") return `<div class="text-gray-400">请先创建项目。</div>`;
    return `
      <div class="page-content fade-in">
        <div class="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <section class="xl:col-span-8 card">
            <div class="flex items-center justify-between mb-4">
              <h2 id="rs-title" class="text-xl font-bold text-gray-900">审核会话</h2>
              <div class="flex items-center gap-2">
                <button id="rs-approve" class="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors">通过</button>
                <button id="rs-reject" class="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors">驳回</button>
              </div>
            </div>
            <div id="rs-scenes" class="grid grid-cols-1 md:grid-cols-2 gap-3"></div>
          </section>
          <aside class="xl:col-span-4 card">
            <h3 class="text-sm font-semibold text-gray-900 mb-3">历史审核</h3>
            <div id="rs-history" class="space-y-2"></div>
          </aside>
        </div>
      </div>
    `;
  }

  async function mount(params) {
    if (params.id === "new") return;
    await _load(params.id);
    document.getElementById("rs-approve").addEventListener("click", () => _review(params.id, "approved"));
    document.getElementById("rs-reject").addEventListener("click", () => _review(params.id, "rejected"));
  }

  async function _load(projectId) {
    const [project, scenes, reviews] = await Promise.all([
      ProjectStore.getProject(projectId),
      ProjectStore.listScenes(projectId),
      ProjectStore.listReviews(projectId).catch(() => []),
    ]);
    state.project = project;
    state.scenes = scenes;
    state.reviews = reviews;
    _render(projectId);
  }

  function _render(projectId) {
    const title = document.getElementById("rs-title");
    if (title) title.textContent = `审核会话 · ${state.project.title}`;
    const scenesEl = document.getElementById("rs-scenes");
    if (scenesEl) {
      scenesEl.innerHTML = state.scenes.length
        ? state.scenes.map((s) => `
          <article class="border border-gray-200 bg-gray-50 rounded-lg p-3">
            <div class="text-xs text-gray-500 mb-2">Scene ${s.scene_index}</div>
            <div class="text-sm text-gray-700 mb-2">${_escape(s.scene_description || s.prompt || "")}</div>
            ${s.image_url
              ? `<img src="${s.image_url}" class="w-full h-36 object-cover rounded border border-gray-200" alt="scene" />`
              : `<div class="w-full h-36 rounded border-2 border-dashed border-gray-200 flex items-center justify-center text-xs text-gray-400">暂无图片</div>`
            }
          </article>
        `).join("")
        : `<div class="text-sm text-gray-500">暂无分镜可审核</div>`;
    }
    const historyEl = document.getElementById("rs-history");
    if (historyEl) {
      historyEl.innerHTML = state.reviews.length
        ? state.reviews.map((r) => `
          <div class="border border-gray-200 bg-gray-50 rounded-lg p-3">
            <div class="text-xs text-gray-500">${r.created_at || ""}</div>
            <div class="text-sm ${r.status === "approved" ? "text-green-600" : "text-red-600"} mt-1 font-medium">${r.status === "approved" ? "通过" : "驳回"}</div>
            <div class="text-sm text-gray-600 mt-1">${_escape(r.comment || "无备注")}</div>
          </div>
        `).join("")
        : `<div class="text-sm text-gray-500">暂无审核记录</div>`;
    }
  }

  function _review(projectId, status) {
    ReviewDialog.open({
      title: status === "approved" ? "通过审核" : "驳回审核",
      confirmText: "提交结果",
      type: status === "approved" ? "info" : "danger",
      onSubmit: async (comment) => {
        if (status === "rejected" && !comment) {
          App.showToast("驳回时请填写意见", "warning");
          return;
        }
        await ProjectStore.submitReview(projectId, status, comment);
        await ProjectStore.transition(projectId, status);
        App.showToast("审核结果已提交", "success");
        await _load(projectId);
      },
    });
  }

  function _escape(text) {
    return String(text || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  window.ReviewSessionPage = { render, mount };
})();
