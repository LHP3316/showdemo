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
      <div class="page-content fade-in">
        <section class="mb-8">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-xl font-semibold text-gray-900">欢迎回来，${_escape(user.username || '用户')}</h2>
              <p class="text-gray-500 mt-1">查看你的任务与项目进度</p>
            </div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="card">
              <div class="text-sm text-gray-500 mb-1">我的项目</div>
              <div id="workspace-project-count" class="text-3xl font-bold text-gray-900">0</div>
            </div>
            <div class="card">
              <div class="text-sm text-gray-500 mb-1">待我处理</div>
              <div id="workspace-task-count" class="text-3xl font-bold text-gray-900">0</div>
            </div>
          </div>
        </section>

        <section class="mb-8">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold text-gray-900">我的任务</h2>
            <button id="workspace-refresh" class="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm text-gray-700 transition-colors">刷新</button>
          </div>
          <div id="workspace-tasks" class="grid grid-cols-1 lg:grid-cols-2 gap-4"></div>
        </section>

        <section>
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold text-gray-900">我的项目</h2>
            <a href="#/project/new/script" class="text-sm text-brand-600 hover:text-brand-700 font-medium">创建新项目</a>
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
            <article class="card">
              <h3 class="font-semibold text-gray-900 truncate">${_escape(p.title)}</h3>
              <p class="text-xs text-gray-500 mt-1">状态：${_escape(p.status)}</p>
              <a class="inline-block mt-3 text-sm text-brand-600 hover:text-brand-700 font-medium" href="#/project/${p.id}">进入项目 →</a>
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
