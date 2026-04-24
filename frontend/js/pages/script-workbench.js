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
      <div class="page-content fade-in">
        <div class="max-w-4xl mx-auto">
          <div class="card">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-2xl font-bold text-white">${isNew ? "创建项目剧本" : "编辑项目剧本"}</h2>
              ${isNew ? "" : `<a class="text-sm text-gold-400 hover:text-gold-500 font-semibold" href="#/project/${params.id}">返回项目</a>`}
            </div>
            <form id="script-form" class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-2">项目标题</label>
                <input id="script-title" class="input-field" placeholder="例如：古镇迷案 第一集" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-2">剧本内容</label>
                <textarea id="script-content" class="textarea-field min-h-[320px]" placeholder="分段输入剧情内容"></textarea>
              </div>
              <div class="flex items-center gap-3 pt-2">
                <button class="btn-primary">保存剧本</button>
                <button type="button" id="script-submit-step" class="btn-secondary">提交到分镜阶段</button>
              </div>
            </form>
          </div>
        </div>
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
