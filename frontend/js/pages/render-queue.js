/* ========================================
   生成队列
   ======================================== */
(function () {
  let state = { scenes: [], project: null };

  function render(params) {
    if (params.id === "new") {
      return `<div class="text-gray-400">请先创建项目。</div>`;
    }
    return `
      <div class="space-y-4 fade-in">
        <div class="flex items-center justify-between">
          <h2 id="rq-title" class="text-lg font-semibold text-gray-100">生成队列</h2>
          <button id="rq-refresh" class="px-3 py-1.5 rounded-lg bg-dark-600 hover:bg-dark-500 text-sm text-gray-200">刷新状态</button>
        </div>
        <div id="rq-list" class="grid grid-cols-1 lg:grid-cols-2 gap-4"></div>
      </div>
    `;
  }

  async function mount(params) {
    if (params.id === "new") return;
    await _load(params.id);
    const refresh = document.getElementById("rq-refresh");
    if (refresh) refresh.addEventListener("click", () => _load(params.id));
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
    const title = document.getElementById("rq-title");
    if (title) title.textContent = `生成队列 · ${state.project.title}`;
    const list = document.getElementById("rq-list");
    if (!list) return;
    if (!state.scenes.length) {
      list.innerHTML = `<div class="text-sm text-gray-500">暂无分镜任务</div>`;
      return;
    }
    list.innerHTML = state.scenes.map((s) => `
      <article class="bg-dark-800 border border-dark-500 rounded-xl p-4">
        <div class="flex items-center justify-between">
          <div class="text-sm text-gray-100 font-semibold">Scene ${s.scene_index}</div>
          <span class="badge ${s.video_url ? "bg-green-500/15 text-green-300" : "bg-amber-500/15 text-amber-300"}">
            ${s.video_url ? "video_ready" : (s.image_url ? "image_ready" : "todo")}
          </span>
        </div>
        <p class="text-xs text-gray-500 mt-1">${_escape(s.scene_description || s.prompt || "")}</p>
        <div class="mt-3 flex items-center gap-2">
          <button data-action="image" data-id="${s.id}" class="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-xs text-white">生成图片</button>
          <button data-action="video" data-id="${s.id}" class="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-xs text-white">生成视频</button>
          <a class="text-xs text-blue-300" href="#/project/${projectId}/storyboard">进入工位</a>
        </div>
      </article>
    `).join("");

    list.querySelectorAll("button[data-action='image']").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await ProjectStore.generateImage(btn.getAttribute("data-id"));
        App.showToast("图片任务已提交", "success");
        await _load(projectId);
      });
    });
    list.querySelectorAll("button[data-action='video']").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await ProjectStore.generateVideo(btn.getAttribute("data-id"));
        App.showToast("视频任务已提交", "success");
        await _load(projectId);
      });
    });
  }

  function _escape(text) {
    return String(text || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  window.RenderQueuePage = { render, mount };
})();
