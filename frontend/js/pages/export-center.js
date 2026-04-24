/* ========================================
   导出中心
   ======================================== */
(function () {
  let state = { project: null, scenes: [] };

  function render(params) {
    if (params.id === "new") return `<div class="text-gray-400">请先创建项目。</div>`;
    return `
      <div class="page-content fade-in">
        <section class="card mb-4">
          <h2 id="ec-title" class="text-2xl font-bold text-white">导出中心</h2>
          <p id="ec-status" class="text-sm text-gray-400 mt-2">加载中...</p>
          <div class="mt-3 flex items-center gap-2">
            <button id="ec-mark-exported" class="px-4 py-2 rounded-lg btn-primary">标记已导出</button>
            <a id="ec-back" class="px-4 py-2 rounded-lg btn-secondary" href="#">返回项目</a>
          </div>
        </section>
        <section class="card">
          <h3 class="text-sm font-bold text-white mb-3">可导出资产清单</h3>
          <div id="ec-assets" class="space-y-2"></div>
        </section>
      </div>
    `;
  }

  async function mount(params) {
    if (params.id === "new") return;
    await _load(params.id);
    document.getElementById("ec-mark-exported").addEventListener("click", () => _markExported(params.id));
  }

  async function _load(projectId) {
    const [project, scenes] = await Promise.all([
      ProjectStore.getProject(projectId),
      ProjectStore.listScenes(projectId),
    ]);
    state.project = project;
    state.scenes = scenes;
    _render(projectId);
  }

  function _render(projectId) {
    const title = document.getElementById("ec-title");
    const status = document.getElementById("ec-status");
    const assets = document.getElementById("ec-assets");
    const back = document.getElementById("ec-back");
    if (title) title.textContent = `导出中心 · ${state.project.title}`;
    if (status) {
      const exported = localStorage.getItem(`project:${projectId}:exported`) === "1";
      status.textContent = `项目状态：${state.project.status} · 导出标记：${exported ? "已导出" : "未导出"}`;
    }
    if (back) back.href = `#/project/${projectId}`;
    if (!assets) return;
    const lines = [];
    for (const s of state.scenes) {
      if (s.image_url) lines.push(`Scene ${s.scene_index} 图片：<a class="text-blue-300" target="_blank" href="${s.image_url}">${s.image_url}</a>`);
      if (s.video_url) lines.push(`Scene ${s.scene_index} 视频：<a class="text-blue-300" target="_blank" href="${s.video_url}">${s.video_url}</a>`);
    }
    assets.innerHTML = lines.length
      ? lines.map((line) => `<div class="text-sm text-gray-300 break-all">${line}</div>`).join("")
      : `<div class="text-sm text-gray-500">暂无可导出资产</div>`;
  }

  function _markExported(projectId) {
    localStorage.setItem(`project:${projectId}:exported`, "1");
    App.showToast("已标记导出完成", "success");
    _render(projectId);
  }

  window.ExportCenterPage = { render, mount };
})();
