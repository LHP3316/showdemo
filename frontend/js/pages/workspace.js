/* ========================================
   我的工作区
   ======================================== */
(function () {
  let state = {
    tasks: [],
    projects: [],
  };

  function render() {
    const user = AuthStore.getUser() || {};
    return `
      <div class="space-y-6 fade-in">
        <section class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-dark-800 border border-dark-500 rounded-xl p-4">
            <div class="text-xs text-gray-500">当前身份</div>
            <div class="text-xl font-semibold text-gray-100 mt-1">${_escape(user.username || "-")}</div>
            <div class="text-sm text-blue-300 mt-2">${_escape(user.role || "member")}</div>
          </div>
          <div class="bg-dark-800 border border-dark-500 rounded-xl p-4">
            <div class="text-xs text-gray-500">我的项目</div>
            <div id="workspace-project-count" class="text-2xl font-semibold text-gray-100 mt-2">0</div>
          </div>
          <div class="bg-dark-800 border border-dark-500 rounded-xl p-4">
            <div class="text-xs text-gray-500">待我处理</div>
            <div id="workspace-task-count" class="text-2xl font-semibold text-gray-100 mt-2">0</div>
          </div>
        </section>

        <section>
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-lg font-semibold text-gray-100">任务看板</h2>
            <button id="workspace-refresh" class="px-3 py-1.5 rounded-lg bg-dark-600 hover:bg-dark-500 text-sm text-gray-200">刷新</button>
          </div>
          <div id="workspace-tasks" class="grid grid-cols-1 lg:grid-cols-2 gap-4"></div>
        </section>

        <section>
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-lg font-semibold text-gray-100">快速进入项目</h2>
            <a href="#/project/new/script" id="workspace-create-tip" class="text-sm text-blue-300">去剧本工位创建项目</a>
          </div>
          <div id="workspace-projects" class="grid grid-cols-1 lg:grid-cols-3 gap-4"></div>
        </section>
      </div>
    `;
  }

  async function mount() {
    await _load();
    const refreshBtn = document.getElementById("workspace-refresh");
    if (refreshBtn) refreshBtn.addEventListener("click", _load);
  }

  async function _load() {
    state.projects = await WorkspaceStore.loadMyProjects();
    state.tasks = await WorkspaceStore.loadMyTasks();

    const projectCount = document.getElementById("workspace-project-count");
    const taskCount = document.getElementById("workspace-task-count");
    if (projectCount) projectCount.textContent = String(state.projects.length);
    if (taskCount) taskCount.textContent = String(state.tasks.length);

    const taskEl = document.getElementById("workspace-tasks");
    if (taskEl) {
      taskEl.innerHTML = state.tasks.length
        ? state.tasks.map((t) => TaskCard.render(t)).join("")
        : `<div class="text-sm text-gray-500">暂无任务</div>`;
    }

    const projectEl = document.getElementById("workspace-projects");
    if (projectEl) {
      projectEl.innerHTML = state.projects.length
        ? state.projects.map((p) => `
            <article class="bg-dark-800 border border-dark-500 rounded-xl p-4 card-hover">
              <h3 class="font-semibold text-gray-100 truncate">${_escape(p.title)}</h3>
              <p class="text-xs text-gray-500 mt-1">状态：${_escape(p.status)}</p>
              <a class="inline-block mt-3 text-sm text-blue-300" href="#/project/${p.id}">进入项目</a>
            </article>
          `).join("")
        : `<div class="text-sm text-gray-500">暂无项目</div>`;
    }
  }

  function _escape(text) {
    return String(text || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  window.WorkspacePage = { render, mount };
})();
