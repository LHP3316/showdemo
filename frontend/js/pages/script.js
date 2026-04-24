/* ========================================
   剧本创作页
   ======================================== */
(function () {
  let state = {
    projects: [],
    users: [],
  };

  function render() {
    const user = App.getCurrentUser();
    const isDirector = user && user.role === "director";

    return `
      <div class="grid grid-cols-1 xl:grid-cols-3 gap-6 fade-in">
        <section class="xl:col-span-1 bg-dark-800 border border-dark-500 rounded-xl p-5">
          <h2 class="text-lg font-semibold text-gray-100 mb-4">创建剧本项目</h2>
          <form id="project-form" class="space-y-4">
            <div>
              <label class="block text-sm text-gray-400 mb-1.5">项目标题</label>
              <input id="project-title" class="input-dark" placeholder="例如：古镇迷案 第一集" />
            </div>
            <div>
              <label class="block text-sm text-gray-400 mb-1.5">剧本内容</label>
              <textarea id="project-script" class="textarea-dark min-h-[180px]" placeholder="输入剧本文案"></textarea>
            </div>
            ${
              isDirector
                ? `
              <div>
                <label class="block text-sm text-gray-400 mb-1.5">分配给</label>
                <select id="project-assigned" class="select-dark w-full">
                  <option value="">暂不分配</option>
                  ${state.users
                    .filter((u) => u.role === "staff")
                    .map((u) => `<option value="${u.id}">${u.username}</option>`)
                    .join("")}
                </select>
              </div>
            `
                : ""
            }
            <button class="w-full py-2.5 rounded-lg bg-accent-green text-white text-sm font-semibold btn-primary">
              创建项目
            </button>
          </form>
        </section>

        <section class="xl:col-span-2 bg-dark-800 border border-dark-500 rounded-xl p-5">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold text-gray-100">项目列表</h2>
            <button id="refresh-projects" class="px-3 py-1.5 rounded-lg bg-dark-600 hover:bg-dark-500 text-sm text-gray-200">刷新</button>
          </div>
          <div id="project-list" class="space-y-3"></div>
        </section>
      </div>
    `;
  }

  function mount() {
    _loadUsers();
    _loadProjects();

    const form = document.getElementById("project-form");
    if (form) {
      form.addEventListener("submit", _createProject);
    }

    const refreshBtn = document.getElementById("refresh-projects");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", _loadProjects);
    }
  }

  async function _loadUsers() {
    const user = App.getCurrentUser();
    if (!user || user.role !== "director") return;
    try {
      state.users = await API.get("/auth/users");
      _renderAssigneeOptions();
    } catch {
      state.users = [];
    }
  }

  function _renderAssigneeOptions() {
    const select = document.getElementById("project-assigned");
    if (!select) return;
    select.innerHTML = `
      <option value="">暂不分配</option>
      ${state.users
        .filter((u) => u.role === "staff")
        .map((u) => `<option value="${u.id}">${u.username}</option>`)
        .join("")}
    `;
  }

  async function _loadProjects() {
    const listEl = document.getElementById("project-list");
    if (listEl) listEl.innerHTML = `<div class="text-sm text-gray-500">加载中...</div>`;
    try {
      state.projects = await API.get("/projects/");
      _renderProjectList();
    } catch (err) {
      if (listEl) listEl.innerHTML = `<div class="text-sm text-red-400">${err.message}</div>`;
    }
  }

  function _renderProjectList() {
    const listEl = document.getElementById("project-list");
    if (!listEl) return;
    if (!state.projects.length) {
      listEl.innerHTML = `<div class="text-sm text-gray-500">暂无项目</div>`;
      return;
    }

    listEl.innerHTML = state.projects
      .map(
        (p) => `
      <article class="border border-dark-500 rounded-xl p-4 bg-dark-700 card-hover">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h3 class="text-gray-100 font-semibold truncate">${p.title}</h3>
            <p class="text-xs text-gray-500 mt-1">状态：${p.status} · 项目ID：${p.id}</p>
          </div>
          <div class="flex items-center gap-2">
            <button data-action="decompose" data-id="${p.id}" class="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs text-white">AI拆解</button>
            <button data-action="open" data-id="${p.id}" class="px-3 py-1.5 rounded-lg bg-dark-600 hover:bg-dark-500 text-xs text-gray-200">进入分镜</button>
          </div>
        </div>
        <p class="text-sm text-gray-400 mt-3 line-clamp-2">${_escape(p.script || "暂无剧本内容")}</p>
      </article>
    `
      )
      .join("");

    listEl.querySelectorAll("button[data-action='decompose']").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        btn.disabled = true;
        try {
          await API.post(`/projects/${id}/decompose`);
          App.showToast("拆解完成", "success");
          await _loadProjects();
        } catch (err) {
          App.showToast(err.message, "error");
        } finally {
          btn.disabled = false;
        }
      });
    });

    listEl.querySelectorAll("button[data-action='open']").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        localStorage.setItem("activeProjectId", id);
        window.location.hash = `#/storyboard?projectId=${id}`;
      });
    });
  }

  async function _createProject(e) {
    e.preventDefault();
    const title = document.getElementById("project-title").value.trim();
    const script = document.getElementById("project-script").value.trim();
    const assignedSelect = document.getElementById("project-assigned");
    const assignedTo = assignedSelect && assignedSelect.value ? Number(assignedSelect.value) : null;

    if (!title) return App.showToast("请输入项目标题", "warning");

    try {
      await API.post("/projects/", {
        title,
        script,
        assigned_to: assignedTo,
      });
      App.showToast("项目已创建", "success");
      document.getElementById("project-form").reset();
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

  window.ScriptsPage = { render, mount };
})();
