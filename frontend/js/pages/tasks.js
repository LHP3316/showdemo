/* ========================================
   任务管理页
   ======================================== */
(function () {
  let state = {
    projects: [],
    users: [],
  };

  function render() {
    return `
      <div class="bg-dark-800 border border-dark-500 rounded-xl p-5 fade-in">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-gray-100">任务管理</h2>
          <button id="tasks-refresh" class="px-3 py-1.5 rounded-lg bg-dark-600 hover:bg-dark-500 text-sm text-gray-200">刷新</button>
        </div>
        <div id="tasks-list" class="space-y-3"></div>
      </div>
    `;
  }

  function mount() {
    _init();
    const refreshBtn = document.getElementById("tasks-refresh");
    if (refreshBtn) refreshBtn.addEventListener("click", _init);
  }

  async function _init() {
    await Promise.all([_loadUsers(), _loadProjects()]);
    _renderList();
  }

  async function _loadUsers() {
    const user = App.getCurrentUser();
    if (!user || user.role !== "director") {
      state.users = [];
      return;
    }
    try {
      state.users = await API.get("/auth/users");
    } catch {
      state.users = [];
    }
  }

  async function _loadProjects() {
    try {
      state.projects = await API.get("/projects/");
    } catch (err) {
      App.showToast(err.message, "error");
      state.projects = [];
    }
  }

  function _renderList() {
    const el = document.getElementById("tasks-list");
    if (!el) return;
    if (!state.projects.length) {
      el.innerHTML = `<div class="text-sm text-gray-500">暂无任务</div>`;
      return;
    }

    const user = App.getCurrentUser();
    const isDirector = user && user.role === "director";

    el.innerHTML = state.projects
      .map((p) => {
        const assignee = state.users.find((u) => u.id === p.assigned_to);
        return `
        <article class="border border-dark-500 rounded-xl p-4 bg-dark-700">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h3 class="font-semibold text-gray-100">${p.title}</h3>
              <p class="text-xs text-gray-500 mt-1">状态：${p.status} · 项目ID：${p.id}</p>
            </div>
            <div class="flex items-center gap-2">
              ${
                isDirector
                  ? `
                <select data-project-id="${p.id}" class="assign-select select-dark text-sm min-w-[160px]">
                  <option value="">未分配</option>
                  ${state.users
                    .filter((u) => u.role === "staff")
                    .map(
                      (u) =>
                        `<option value="${u.id}" ${p.assigned_to === u.id ? "selected" : ""}>${u.username}</option>`
                    )
                    .join("")}
                </select>
                <button data-action="assign" data-id="${p.id}" class="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs text-white">分配</button>
              `
                  : `
                <span class="text-sm text-gray-300">执行人：${assignee ? assignee.username : "未分配"}</span>
              `
              }
            </div>
          </div>
        </article>
      `;
      })
      .join("");

    if (isDirector) {
      el.querySelectorAll("button[data-action='assign']").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const projectId = btn.getAttribute("data-id");
          const select = el.querySelector(`select[data-project-id='${projectId}']`);
          const assignedTo = select && select.value ? Number(select.value) : null;
          if (!assignedTo) return App.showToast("请选择工作人员", "warning");
          try {
            await API.put(`/projects/${projectId}/assign`, { assigned_to: assignedTo });
            App.showToast("任务分配成功", "success");
            await _loadProjects();
            _renderList();
          } catch (err) {
            App.showToast(err.message, "error");
          }
        });
      });
    }
  }

  window.TasksPage = { render, mount };
})();
