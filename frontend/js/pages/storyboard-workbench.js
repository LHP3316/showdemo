/* ========================================
   分镜工位
   ======================================== */
(function () {
  let state = {
    project: null,
    scenes: [],
    activeSceneId: null,
  };

  function render(params) {
    if (params.id === "new") {
      return `
        <div class="h-full flex items-center justify-center">
          <div class="text-center">
            <p class="text-gray-300 mb-3">请先创建项目并填写剧本。</p>
            <a class="text-blue-300" href="#/project/new/script">前往剧本工位</a>
          </div>
        </div>
      `;
    }
    return `
      <div class="grid grid-cols-1 xl:grid-cols-12 gap-4 h-full fade-in">
        <aside class="xl:col-span-3 bg-dark-800 border border-dark-500 rounded-xl p-4 overflow-auto">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-gray-100">分镜卡片流</h3>
            <button id="swb-add" class="px-2.5 py-1 rounded-lg text-xs bg-green-600 hover:bg-green-500 text-white">新建</button>
          </div>
          <div id="swb-list" class="space-y-2"></div>
        </aside>
        <section class="xl:col-span-5 bg-dark-800 border border-dark-500 rounded-xl p-4 flex flex-col">
          <div class="flex items-center justify-between mb-3">
            <h2 id="swb-title" class="text-base font-semibold text-gray-100">分镜预览</h2>
            <div class="flex items-center gap-2">
              <button id="swb-generate-image" class="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs text-white">文生图</button>
              <button id="swb-generate-video" class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs text-white">图生视频</button>
            </div>
          </div>
          <div id="swb-preview" class="flex-1 border border-dark-500 rounded-lg bg-dark-700 flex items-center justify-center text-gray-500 text-sm">请选择分镜</div>
        </section>
        <section class="xl:col-span-4 bg-dark-800 border border-dark-500 rounded-xl p-4 overflow-auto">
          <h3 class="text-sm font-semibold text-gray-100 mb-3">编辑面板</h3>
          <form id="swb-form" class="space-y-3">
            <input id="swb-index" class="input-dark" type="number" min="1" placeholder="分镜序号" />
            <input id="swb-characters" class="input-dark" placeholder="角色（逗号分隔）" />
            <textarea id="swb-scene-description" class="textarea-dark" placeholder="场景描述"></textarea>
            <textarea id="swb-dialogue" class="textarea-dark" placeholder="台词"></textarea>
            <input id="swb-camera-angle" class="input-dark" placeholder="镜头语言" />
            <input id="swb-emotion" class="input-dark" placeholder="情绪" />
            <textarea id="swb-prompt" class="textarea-dark min-h-[120px]" placeholder="Prompt"></textarea>
            <div class="flex items-center gap-2">
              <button class="flex-1 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-sm text-white font-medium">保存分镜</button>
              <button type="button" id="swb-submit-review" class="px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-sm text-white">提交审核</button>
            </div>
          </form>
        </section>
      </div>
    `;
  }

  async function mount(params) {
    const projectId = params.id;
    if (projectId === "new") return;
    await _load(projectId);

    document.getElementById("swb-add").addEventListener("click", () => _createScene(projectId));
    document.getElementById("swb-form").addEventListener("submit", (e) => _saveScene(e, projectId));
    document.getElementById("swb-generate-image").addEventListener("click", _generateImage);
    document.getElementById("swb-generate-video").addEventListener("click", _generateVideo);
    document.getElementById("swb-submit-review").addEventListener("click", () => _submitReview(projectId));
  }

  async function _load(projectId) {
    const [project, scenes] = await Promise.all([
      ProjectStore.getProject(projectId),
      ProjectStore.listScenes(projectId),
    ]);
    state.project = project;
    state.scenes = scenes;
    state.activeSceneId = scenes.length ? scenes[0].id : null;
    _renderList();
    _renderActive();
  }

  function _renderList() {
    const listEl = document.getElementById("swb-list");
    if (!listEl) return;
    listEl.innerHTML = state.scenes.length
      ? state.scenes.map((s) => SceneCard.render(s, s.id === state.activeSceneId)).join("")
      : `<div class="text-sm text-gray-500">暂无分镜，点击新建</div>`;

    const title = document.getElementById("swb-title");
    if (title && state.project) title.textContent = `分镜工位 · ${state.project.title}`;

    listEl.querySelectorAll(".scene-card").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.activeSceneId = Number(btn.getAttribute("data-scene-id"));
        _renderList();
        _renderActive();
      });
    });
  }

  function _renderActive() {
    const scene = _activeScene();
    const preview = document.getElementById("swb-preview");
    if (!scene || !preview) {
      if (preview) preview.textContent = "请选择分镜";
      return;
    }
    preview.innerHTML = scene.image_url
      ? `<img src="${scene.image_url}" alt="scene" class="max-w-full max-h-full object-contain" />`
      : `<div class="text-gray-500 text-sm">暂无图片，点击文生图</div>`;

    _set("swb-index", scene.scene_index || 1);
    _set("swb-characters", Array.isArray(scene.characters) ? scene.characters.join(",") : "");
    _set("swb-scene-description", scene.scene_description || "");
    _set("swb-dialogue", scene.dialogue || "");
    _set("swb-camera-angle", scene.camera_angle || "");
    _set("swb-emotion", scene.emotion || "");
    _set("swb-prompt", scene.prompt || "");
  }

  async function _createScene(projectId) {
    const nextIndex = state.scenes.length ? Math.max(...state.scenes.map((s) => s.scene_index || 0)) + 1 : 1;
    await ProjectStore.createScene({
      project_id: Number(projectId),
      scene_index: nextIndex,
      scene_description: `新分镜 ${nextIndex}`,
      prompt: "",
    });
    App.showToast("分镜已创建", "success");
    await _load(projectId);
  }

  async function _saveScene(e, projectId) {
    e.preventDefault();
    const scene = _activeScene();
    if (!scene) return;
    const payload = {
      scene_index: Number(_val("swb-index")) || 1,
      scene_description: _val("swb-scene-description"),
      dialogue: _val("swb-dialogue"),
      camera_angle: _val("swb-camera-angle"),
      emotion: _val("swb-emotion"),
      prompt: _val("swb-prompt"),
      characters: _val("swb-characters").split(",").map((v) => v.trim()).filter(Boolean),
    };
    await ProjectStore.updateScene(scene.id, payload);
    App.showToast("分镜已保存", "success");
    await _load(projectId);
  }

  async function _generateImage() {
    const scene = _activeScene();
    if (!scene) return;
    await ProjectStore.generateImage(scene.id);
    App.showToast("图片生成完成", "success");
    await _load(state.project.id);
  }

  async function _generateVideo() {
    const scene = _activeScene();
    if (!scene) return;
    await ProjectStore.generateVideo(scene.id);
    App.showToast("视频生成完成", "success");
    await _load(state.project.id);
  }

  async function _submitReview(projectId) {
    await ProjectStore.transition(projectId, "in_review");
    App.showToast("已提交审核", "success");
    window.location.hash = `#/project/${projectId}/review`;
  }

  function _activeScene() {
    return state.scenes.find((s) => s.id === state.activeSceneId) || null;
  }

  function _set(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
  }

  function _val(id) {
    const el = document.getElementById(id);
    return el ? el.value : "";
  }

  window.StoryboardWorkbenchPage = { render, mount };
})();
