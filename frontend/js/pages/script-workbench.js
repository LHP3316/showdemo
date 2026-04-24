/* ========================================
   剧本工位
   ======================================== */
(function () {
  let state = {
    project: null,
  };

  function render(params) {
    const isNew = params.id === "new";
    return `
      <div class="grid grid-cols-1 xl:grid-cols-3 gap-5 fade-in">
        <section class="xl:col-span-2 bg-dark-800 border border-dark-500 rounded-xl p-5">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-lg font-semibold text-gray-100">${isNew ? "创建项目剧本" : "编辑项目剧本"}</h2>
            ${isNew ? "" : `<a class="text-sm text-blue-300" href="#/project/${params.id}">返回驾驶舱</a>`}
          </div>
          <form id="script-form" class="space-y-4">
            <div>
              <label class="block text-sm text-gray-400 mb-1.5">项目标题</label>
              <input id="script-title" class="input-dark" placeholder="例如：古镇迷案 第一集" />
            </div>
            <div>
              <label class="block text-sm text-gray-400 mb-1.5">剧本内容</label>
              <textarea id="script-content" class="textarea-dark min-h-[280px]" placeholder="分段输入剧情内容"></textarea>
            </div>
            <div class="flex items-center gap-2">
              <button class="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-sm text-white">保存剧本</button>
              <button type="button" id="script-submit-step" class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm text-white">提交到分镜阶段</button>
            </div>
          </form>
        </section>
        <aside class="bg-dark-800 border border-dark-500 rounded-xl p-5">
          <h3 class="text-sm text-gray-300 mb-2">操作说明</h3>
          <ul class="text-sm text-gray-400 space-y-1">
            <li>1. 先保存项目标题与剧本内容。</li>
            <li>2. 点击“提交到分镜阶段”后项目进入处理流程。</li>
            <li>3. 再进入分镜工位继续拆解与生成。</li>
          </ul>
        </aside>
      </div>
    `;
  }

  async function mount(params) {
    const projectId = params.id;
    if (projectId !== "new") {
      await _loadProject(projectId);
    }

    const form = document.getElementById("script-form");
    const submitStepBtn = document.getElementById("script-submit-step");
    if (form) form.addEventListener("submit", (e) => _save(e, projectId));
    if (submitStepBtn) submitStepBtn.addEventListener("click", () => _submitToStoryboard(projectId));
  }

  async function _loadProject(projectId) {
    try {
      state.project = await ProjectStore.getProject(projectId);
      document.getElementById("script-title").value = state.project.title || "";
      document.getElementById("script-content").value = state.project.script || "";
    } catch (err) {
      App.showToast(err.message, "error");
    }
  }

  async function _save(e, projectId) {
    e.preventDefault();
    const title = document.getElementById("script-title").value.trim();
    const script = document.getElementById("script-content").value.trim();
    if (!title) return App.showToast("请填写项目标题", "warning");

    try {
      if (projectId === "new") {
        const project = await API.post("/projects/", { title, script });
        App.setActiveProjectId(project.id);
        App.showToast("项目创建成功", "success");
        window.location.hash = `#/project/${project.id}/script`;
      } else {
        await ProjectStore.updateProject(projectId, { title, script });
        App.showToast("剧本已保存", "success");
      }
    } catch (err) {
      App.showToast(err.message, "error");
    }
  }

  async function _submitToStoryboard(projectId) {
    if (projectId === "new") {
      App.showToast("请先保存并创建项目", "warning");
      return;
    }
    try {
      await ProjectStore.transition(projectId, "script_ready");
      App.showToast("已提交到分镜阶段", "success");
      window.location.hash = `#/project/${projectId}/storyboard`;
    } catch (err) {
      App.showToast(err.message, "error");
    }
  }

  window.ScriptWorkbenchPage = { render, mount };
})();
