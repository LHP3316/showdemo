/* ========================================
   分镜工作台
   ======================================== */
(function () {
  let state = {
    projectId: null,
    project: null,
    scenes: [],
    activeSceneId: null,
  };

  function render() {
    return `
      <div class="grid grid-cols-1 xl:grid-cols-12 gap-4 h-full fade-in">
        <aside class="xl:col-span-3 bg-dark-800 border border-dark-500 rounded-xl p-4 overflow-auto">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-gray-100">分镜列表</h3>
            <button id="scene-add" class="px-2.5 py-1 rounded-lg text-xs bg-green-600 hover:bg-green-500 text-white">新建</button>
          </div>
          <div id="scene-list" class="space-y-2"></div>
        </aside>

        <section class="xl:col-span-5 bg-dark-800 border border-dark-500 rounded-xl p-4 flex flex-col">
          <div class="flex items-center justify-between mb-3">
            <h2 id="storyboard-title" class="text-base font-semibold text-gray-100">分镜预览</h2>
            <div class="flex items-center gap-2">
              <button id="scene-generate-image" class="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs text-white">生成图片</button>
              <button id="scene-generate-video" class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs text-white">生成视频</button>
            </div>
          </div>
          <div class="flex-1 bg-dark-700 border border-dark-500 rounded-lg overflow-hidden flex items-center justify-center">
            <div id="scene-preview" class="w-full h-full flex items-center justify-center text-sm text-gray-500">请选择分镜</div>
          </div>
        </section>

        <section class="xl:col-span-4 bg-dark-800 border border-dark-500 rounded-xl p-4 overflow-auto">
          <h3 class="text-sm font-semibold text-gray-100 mb-3">分镜编辑</h3>
          <form id="scene-form" class="space-y-3">
            <input id="scene-index" class="input-dark" type="number" min="1" placeholder="分镜序号" />
            <textarea id="scene-description" class="textarea-dark" placeholder="场景描述"></textarea>
            <textarea id="scene-dialogue" class="textarea-dark" placeholder="台词"></textarea>
            <input id="scene-camera-angle" class="input-dark" placeholder="镜头语言" />
            <input id="scene-emotion" class="input-dark" placeholder="情绪" />
            <textarea id="scene-prompt" class="textarea-dark min-h-[120px]" placeholder="Prompt"></textarea>
            <div class="flex items-center gap-2">
              <button class="flex-1 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-sm text-white font-medium">保存</button>
              <button type="button" id="scene-delete" class="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-sm text-white">删除</button>
            </div>
          </form>
        </section>
      </div>
    `;
  }

  function mount() {
    state.projectId = _resolveProjectId();
    if (!state.projectId) {
      App.showToast("请先在剧本页选择项目", "warning");
      window.location.hash = "#/scripts";
      return;
    }
    _loadAll();

    document.getElementById("scene-add").addEventListener("click", _createScene);
    document.getElementById("scene-form").addEventListener("submit", _saveScene);
    document.getElementById("scene-delete").addEventListener("click", _deleteScene);
    document.getElementById("scene-generate-image").addEventListener("click", _generateImage);
    document.getElementById("scene-generate-video").addEventListener("click", _generateVideo);
  }

  async function _loadAll() {
    try {
      state.project = await API.get(`/projects/${state.projectId}`);
      state.scenes = await API.get(`/api/scenes/?project_id=${state.projectId}`);
      if (state.scenes.length) {
        state.activeSceneId = state.scenes[0].id;
      }
      _renderSceneList();
      _renderActiveScene();
    } catch (err) {
      App.showToast(err.message, "error");
    }
  }

  function _renderSceneList() {
    const titleEl = document.getElementById("storyboard-title");
    if (titleEl && state.project) {
      titleEl.textContent = `分镜预览 · ${state.project.title}`;
    }
    const listEl = document.getElementById("scene-list");
    if (!listEl) return;
    if (!state.scenes.length) {
      listEl.innerHTML = `<div class="text-sm text-gray-500">暂无分镜，请先 AI 拆解或新建分镜</div>`;
      return;
    }
    listEl.innerHTML = state.scenes
      .map(
        (s) => `
      <button data-id="${s.id}" class="scene-item w-full text-left border rounded-lg p-3 transition ${
        s.id === state.activeSceneId
          ? "border-blue-500 bg-blue-500/10"
          : "border-dark-500 bg-dark-700 hover:border-dark-400"
      }">
        <div class="text-xs text-gray-500 mb-1">Scene ${s.scene_index}</div>
        <div class="text-sm text-gray-200 truncate">${_escape(s.scene_description || s.prompt || "未填写")}</div>
      </button>
    `
      )
      .join("");
    listEl.querySelectorAll(".scene-item").forEach((el) => {
      el.addEventListener("click", () => {
        state.activeSceneId = Number(el.getAttribute("data-id"));
        _renderSceneList();
        _renderActiveScene();
      });
    });
  }

  function _renderActiveScene() {
    const scene = _activeScene();
    const preview = document.getElementById("scene-preview");
    if (!scene || !preview) {
      if (preview) preview.textContent = "请选择分镜";
      return;
    }

    const media = scene.image_url
      ? `<img src="${scene.image_url}" alt="scene" class="max-w-full max-h-full object-contain" />`
      : `<div class="text-gray-500 text-sm">暂无图片，请点击“生成图片”</div>`;
    preview.innerHTML = media;

    _setValue("scene-index", scene.scene_index || 1);
    _setValue("scene-description", scene.scene_description || "");
    _setValue("scene-dialogue", scene.dialogue || "");
    _setValue("scene-camera-angle", scene.camera_angle || "");
    _setValue("scene-emotion", scene.emotion || "");
    _setValue("scene-prompt", scene.prompt || "");
  }

  async function _createScene() {
    try {
      const nextIndex = state.scenes.length ? Math.max(...state.scenes.map((s) => s.scene_index || 0)) + 1 : 1;
      await API.post("/api/scenes/", {
        project_id: Number(state.projectId),
        scene_index: nextIndex,
        prompt: "",
        scene_description: "新分镜",
      });
      App.showToast("分镜已创建", "success");
      await _loadAll();
    } catch (err) {
      App.showToast(err.message, "error");
    }
  }

  async function _saveScene(e) {
    e.preventDefault();
    const scene = _activeScene();
    if (!scene) return App.showToast("请先选择分镜", "warning");
    const payload = {
      scene_index: Number(_value("scene-index")) || 1,
      scene_description: _value("scene-description"),
      dialogue: _value("scene-dialogue"),
      camera_angle: _value("scene-camera-angle"),
      emotion: _value("scene-emotion"),
      prompt: _value("scene-prompt"),
    };
    try {
      await API.put(`/api/scenes/${scene.id}`, payload);
      App.showToast("分镜已保存", "success");
      await _loadAll();
    } catch (err) {
      App.showToast(err.message, "error");
    }
  }

  async function _deleteScene() {
    const scene = _activeScene();
    if (!scene) return App.showToast("请先选择分镜", "warning");
    Modal.show({
      title: "删除分镜",
      content: "删除后不可恢复，是否继续？",
      type: "danger",
      onConfirm: async () => {
        try {
          await API.delete(`/api/scenes/${scene.id}`);
          App.showToast("已删除分镜", "success");
          await _loadAll();
        } catch (err) {
          App.showToast(err.message, "error");
        }
      },
    });
  }

  async function _generateImage() {
    const scene = _activeScene();
    if (!scene) return App.showToast("请先选择分镜", "warning");
    try {
      await API.post(`/api/scenes/${scene.id}/generate-image`);
      App.showToast("图片生成完成", "success");
      await _loadAll();
    } catch (err) {
      App.showToast(err.message, "error");
    }
  }

  async function _generateVideo() {
    const scene = _activeScene();
    if (!scene) return App.showToast("请先选择分镜", "warning");
    try {
      const result = await API.post(`/api/scenes/${scene.id}/generate-video`);
      if (result && result.video_url) {
        window.open(result.video_url, "_blank");
      }
      App.showToast("视频生成完成", "success");
      await _loadAll();
    } catch (err) {
      App.showToast(err.message, "error");
    }
  }

  function _resolveProjectId() {
    const hash = window.location.hash || "";
    const query = hash.includes("?") ? hash.split("?")[1] : "";
    const idFromHash = new URLSearchParams(query).get("projectId");
    const fromStorage = localStorage.getItem("activeProjectId");
    return idFromHash || fromStorage || null;
  }

  function _activeScene() {
    return state.scenes.find((s) => s.id === state.activeSceneId) || null;
  }

  function _setValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
  }

  function _value(id) {
    const el = document.getElementById(id);
    return el ? el.value : "";
  }

  function _escape(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  window.StoryboardPage = { render, mount };
})();
