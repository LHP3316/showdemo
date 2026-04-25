/**
 * Storyboard page runtime
 */
(function () {
  const EMPTY_PREVIEW_CANDIDATES = ["tu.png", "/static/tu.png"];
  let emptyPreviewImageUrl = "tu.png";
  let previewRequestId = 0;
  let activeMediaTab = "image";
  let projectId = null;
  let scenes = [];
  let activeSceneId = null;
  let projectEpisode = 1;

  document.addEventListener("DOMContentLoaded", async function () {
    await resolveEmptyPreviewImageUrl();
    const previewWrap = document.querySelector(".sb-preview");
    const previewImage = document.querySelector("#sb-preview-image");
    if (previewWrap && previewImage) applyEmptyPreview(previewWrap, previewImage);

    if (!window.CommonApp || !window.api) return;
    const ok = await CommonApp.ensureSession(true);
    if (!ok) return;

    projectId = await ensureProjectId();
    bindActions();
    await loadData();
  });

  function bindActions() {
    bindClick("#sb-back", function () {
      if (window.CommonApp) window.CommonApp.routeTo("project");
      else window.history.back();
    });
    bindClick("#sb-prev", function () { stepScene(-1); });
    bindClick("#sb-next", function () { stepScene(1); });
    bindClick("#btn-batch-image", batchGenerateImages);
    bindClick("#btn-save-draft", syncActiveEdits);
    bindClick("#btn-submit-review", submitProjectForReview);
    bindClick("#btn-gen-image", function () { generateImage(activeSceneId); });
    bindClick("#btn-gen-video", function () { generateVideo(activeSceneId); });
    bindClick("#tab-image", function () { switchMediaTab("image"); });
    bindClick("#tab-video", function () { switchMediaTab("video"); });

    const characters = document.querySelector("#scene-characters");
    if (characters) characters.addEventListener("blur", syncActiveEdits);

    const desc = document.querySelector("#scene-description");
    if (desc) desc.addEventListener("blur", syncActiveEdits);

    const dialogue = document.querySelector("#scene-dialogue");
    if (dialogue) dialogue.addEventListener("blur", syncActiveEdits);

    const emotion = document.querySelector("#scene-emotion");
    if (emotion) emotion.addEventListener("blur", syncActiveEdits);

    const imagePrompt = document.querySelector("#scene-image-prompt");
    if (imagePrompt) imagePrompt.addEventListener("blur", syncActiveEdits);
    const videoPrompt = document.querySelector("#scene-video-prompt");
    if (videoPrompt) videoPrompt.addEventListener("blur", syncActiveEdits);

    const previewImage = document.querySelector("#sb-preview-image");
    if (previewImage) {
      previewImage.addEventListener("error", function () {
        if (String(previewImage.src || "").includes(emptyPreviewImageUrl)) return;
        // 远端图地址失效时，回退到本地空态图，避免出现黑框/破图
        updatePreviewImage("");
      });
    }

    // 镜头语言已从 UI 移除（不再绑定 chip 事件）
    switchMediaTab("image");
  }

  function bindClick(selector, handler) {
    const node = document.querySelector(selector);
    if (node) node.addEventListener("click", handler);
  }

  async function ensureProjectId() {
    const q = new URLSearchParams(window.location.search).get("id");
    if (q) {
      localStorage.setItem("activeProjectId", String(q));
      return String(q);
    }
    const c = localStorage.getItem("activeProjectId");
    if (c) return String(c);
    return null;
  }

  async function loadData() {
    let project = null;
    let remoteScenes = [];
    if (projectId) {
      try {
        const [projectRes, scenesRes] = await Promise.all([
          api.get(`/projects/${projectId}`),
          api.get(`/api/scenes/?project_id=${projectId}`),
        ]);
        project = (projectRes && projectRes.data) || null;
        remoteScenes = (scenesRes && scenesRes.data) || [];
      } catch {
        // fallback below
      }
    }

    const title = project && project.title ? project.title : "未命名项目";
    projectEpisode = Number(project && project.current_episode ? project.current_episode : 1);
    setText("#storyboard-page-title", "分镜工位");
    setText("#storyboard-page-subtitle", `${title} · 第${projectEpisode}集`);

    scenes = remoteScenes.length ? remoteScenes.map(normalizeScene) : buildFallbackScenes();
    renderSceneList();
    // 默认选中第一个分镜（符合操作习惯）
    const initial = scenes[0];
    if (initial) selectScene(initial.id, { scrollIntoView: false });
  }

  function normalizeScene(scene) {
    const legacyPrompt = String(scene.prompt || "");
    return {
      id: String(scene.id),
      episode_number: Number(scene.episode_number || 1),
      scene_index: Number(scene.scene_index || 0),
      characters: String(scene.characters || ""),
      scene_description: String(scene.scene_description || ""),
      dialogue: String(scene.dialogue || ""),
      camera_angle: String(scene.camera_angle || ""),
      emotion: String(scene.emotion || ""),
      prompt: legacyPrompt,
      image_prompt: String(scene.image_prompt || legacyPrompt || ""),
      video_prompt: String(scene.video_prompt || legacyPrompt || ""),
      status: String(scene.status || "待开始"),
      // 真实数据：无内容就不显示预览（不强行塞占位图）
      image_url: scene.image_url ? String(scene.image_url) : "",
      video_url: scene.video_url ? String(scene.video_url) : "",
    };
  }

  function buildFallbackScenes() {
    const seed = [
      { idx: 1, desc: "摄像机从高处俯拍，主角骑马奔跑", status: "已完成" },
      { idx: 2, desc: "近景特写，主角转身发现龙骨遗迹", status: "已完成" },
      { idx: 3, desc: "中景，主角缓缓走向神秘石碑前", status: "进行中" },
      { idx: 4, desc: "广角全景，远山云雾缭绕背景", status: "待开始" },
      { idx: 5, desc: "主角取出宝剑，发出金色光芒", status: "待开始" },
    ];
    const out = [];
    for (let i = 1; i <= 24; i += 1) {
      const t = seed[(i - 1) % seed.length];
      out.push({
        id: `demo-${i}`,
        episode_number: 1,
        scene_index: i,
        characters: "主角",
        scene_description: t.desc,
        dialogue: "",
        camera_angle: i % 3 === 0 ? "中景" : i % 2 === 0 ? "特写" : "全景",
        emotion: "自然",
        prompt: "medium shot, Chinese ancient warrior walking toward mysterious stone stele, tall ancient trees, golden light through leaves, cinematic atmosphere, 8k quality",
        image_prompt: "medium shot, Chinese ancient warrior walking toward mysterious stone stele, tall ancient trees, golden light through leaves, cinematic atmosphere, 8k quality",
        video_prompt: "cinematic movement, slow dolly in, subtle wind, film grain",
        status: i <= 2 ? "已完成" : i === 3 ? "进行中" : "待开始",
        image_url: "assets/image/preview.png",
        video_url: "",
      });
    }
    return out;
  }

  function renderSceneList() {
    const list = document.querySelector("#sb-scene-list");
    if (!list) return;
    setText("#sb-scene-count", `${scenes.length}场`);
    list.innerHTML = scenes.map(function (scene) {
      const done = scene.status.includes("完成");
      const pending = scene.status.includes("待");
      const icon = done ? "✓" : pending ? "◷" : "□";
      return `
        <article class="sb-item" role="listitem" data-id="${escapeAttr(scene.id)}">
          <span class="sb-item__icon ${done ? "is-done" : ""}">${icon}</span>
          <div>
            <h3 class="sb-item__name">Scene ${pad2(scene.scene_index)}</h3>
            <p class="sb-item__subtitle">${escapeHtml(scene.scene_description)}</p>
          </div>
        </article>
      `;
    }).join("");

    list.querySelectorAll(".sb-item").forEach(function (node) {
      node.addEventListener("click", function () {
        selectScene(node.getAttribute("data-id"));
      });
    });
  }

  function selectScene(sceneId, options) {
    if (!sceneId) return;
    activeSceneId = String(sceneId);
    const opts = options || {};

    const list = document.querySelector("#sb-scene-list");
    if (list) {
      list.querySelectorAll(".sb-item").forEach(function (n) {
        n.classList.remove("is-active");
      });
      const activeNode = list.querySelector(`.sb-item[data-id="${cssEscape(activeSceneId)}"]`);
      if (activeNode) {
        activeNode.classList.add("is-active");
        if (opts.scrollIntoView !== false) activeNode.scrollIntoView({ block: "nearest" });
      }
    }

    const scene = scenes.find((s) => String(s.id) === activeSceneId);
    if (!scene) return;

    const ep = Number(scene.episode_number || projectEpisode || 1);
    setText("#sb-editor-title", `Scene ${pad2(scene.scene_index)} · 第${ep}集`);
    setText("#sb-active-tag", `Scene ${pad2(scene.scene_index)} / 第${ep}集`);
    setText("#sb-active-desc", scene.scene_description);
    setValue("#scene-characters", scene.characters);
    setValue("#scene-description", scene.scene_description);
    setValue("#scene-dialogue", scene.dialogue);
    setValue("#scene-emotion", scene.emotion);
    setValue("#scene-image-prompt", scene.image_prompt || scene.prompt);
    setValue("#scene-video-prompt", scene.video_prompt || scene.prompt);
    // 镜头语言已移除：不再切换 chip

    // 中间预览：优先显示生成图；加载失败或无图时回退 tu.png
    updatePreviewImage(scene.image_url);
  }

  function stepScene(delta) {
    if (!scenes.length) return;
    const current = scenes.findIndex((s) => String(s.id) === String(activeSceneId));
    const base = current < 0 ? 0 : current;
    const next = Math.max(0, Math.min(scenes.length - 1, base + delta));
    selectScene(scenes[next].id);
  }

  async function syncActiveEdits() {
    if (!activeSceneId) return;
    const scene = scenes.find((s) => String(s.id) === String(activeSceneId));
    if (!scene) return;
    scene.characters = valueOf("#scene-characters");
    scene.scene_description = valueOf("#scene-description");
    scene.dialogue = valueOf("#scene-dialogue");
    scene.emotion = valueOf("#scene-emotion");
    scene.image_prompt = valueOf("#scene-image-prompt");
    scene.video_prompt = valueOf("#scene-video-prompt");
    // 兼容旧字段：继续写入 prompt（默认使用图片提示词）
    scene.prompt = scene.image_prompt;
    await persistScene(scene);
    renderSceneList();
    selectScene(scene.id, { scrollIntoView: false });
  }

  async function persistScene(scene) {
    if (!scene || !projectId) return;
    if (!/^\d+$/.test(String(projectId))) return;
    if (!/^\d+$/.test(String(scene.id))) return; // demo 场景不落库
    try {
      await api.put(`/api/scenes/${scene.id}`, {
        characters: scene.characters,
        scene_description: scene.scene_description,
        dialogue: scene.dialogue,
        camera_angle: scene.camera_angle,
        emotion: scene.emotion,
        prompt: scene.prompt,
        image_prompt: scene.image_prompt,
        video_prompt: scene.video_prompt,
      });
      setText("#storyboard-status", "已保存");
    } catch (e) {
      setText("#storyboard-status", (e && e.message) ? e.message : "保存失败");
    }
  }

  async function submitProjectForReview() {
    if (!projectId) return;
    await syncActiveEdits();
    try {
      await api.post(`/projects/${projectId}/submit-review`);
      setText("#storyboard-status", "已提交审核");
      if (window.CommonApp) window.CommonApp.routeTo("project");
    } catch (e) {
      setText("#storyboard-status", (e && e.message) ? e.message : "提交失败");
    }
  }

  async function batchGenerateImages() {
    if (!projectId) return;
    try {
      await api.post(`/api/scenes/batch/generate-images?project_id=${encodeURIComponent(projectId)}`);
    } catch {
      // no-op
    }
  }

  async function generateImage(sceneId) {
    if (!sceneId || !projectId) return;
    try {
      await api.post(`/api/scenes/${sceneId}/generate-image`);
    } catch {
      // no-op
    }
  }

  async function generateVideo(sceneId) {
    if (!sceneId || !projectId) return;
    try {
      await api.post(`/api/scenes/${sceneId}/generate-video`);
    } catch {
      // no-op
    }
  }

  function valueOf(selector) {
    const n = document.querySelector(selector);
    return n ? String(n.value || "").trim() : "";
  }

  function setValue(selector, value) {
    const n = document.querySelector(selector);
    if (n) n.value = value;
  }

  function setText(selector, text) {
    const n = document.querySelector(selector);
    if (n) n.textContent = text;
  }

  function switchMediaTab(tab) {
    activeMediaTab = tab === "video" ? "video" : "image";
    const isImage = activeMediaTab === "image";

    toggleClass("#tab-image", "is-active", isImage);
    toggleClass("#tab-video", "is-active", !isImage);
    setAriaSelected("#tab-image", isImage);
    setAriaSelected("#tab-video", !isImage);

    const imageField = document.querySelector("#field-image-prompt");
    const videoField = document.querySelector("#field-video-prompt");
    if (imageField) imageField.hidden = !isImage;
    if (videoField) videoField.hidden = isImage;

    const imageBtn = document.querySelector("#btn-gen-image");
    const videoBtn = document.querySelector("#btn-gen-video");
    if (imageBtn) imageBtn.hidden = !isImage;
    if (videoBtn) videoBtn.hidden = isImage;
  }

  function updatePreviewImage(imageUrl) {
    const previewWrap = document.querySelector(".sb-preview");
    const img = document.querySelector("#sb-preview-image");
    if (!previewWrap || !img) return;
    const url = String(imageUrl || "").trim();
    const reqId = ++previewRequestId;
    if (!url) {
      applyEmptyPreview(previewWrap, img);
      return;
    }

    // 仅在远端图预加载成功后再切换，避免先显示错误大图再回退空态
    const probe = new Image();
    probe.onload = function () {
      if (reqId !== previewRequestId) return;
      applyRealPreview(previewWrap, img, url);
    };
    probe.onerror = function () {
      if (reqId !== previewRequestId) return;
      applyEmptyPreview(previewWrap, img);
    };
    probe.src = url;
  }

  function applyEmptyPreview(previewWrap, img) {
    previewWrap.removeAttribute("hidden");
    previewWrap.classList.add("is-empty");
    img.classList.add("is-empty");
    img.src = emptyPreviewImageUrl;
  }

  function applyRealPreview(previewWrap, img, url) {
    previewWrap.removeAttribute("hidden");
    previewWrap.classList.remove("is-empty");
    img.classList.remove("is-empty");
    img.src = url;
  }

  async function resolveEmptyPreviewImageUrl() {
    for (const candidate of EMPTY_PREVIEW_CANDIDATES) {
      const ok = await canLoadImage(candidate);
      if (ok) {
        emptyPreviewImageUrl = candidate;
        return;
      }
    }
    emptyPreviewImageUrl = EMPTY_PREVIEW_CANDIDATES[0];
  }

  function canLoadImage(url) {
    return new Promise(function (resolve) {
      const probe = new Image();
      probe.onload = function () { resolve(true); };
      probe.onerror = function () { resolve(false); };
      probe.src = url;
    });
  }

  function toggleClass(selector, className, enabled) {
    const n = document.querySelector(selector);
    if (!n) return;
    if (enabled) n.classList.add(className);
    else n.classList.remove(className);
  }

  function setAriaSelected(selector, selected) {
    const n = document.querySelector(selector);
    if (n) n.setAttribute("aria-selected", selected ? "true" : "false");
  }

  function pad2(n) {
    return String(Number(n || 0)).padStart(2, "0");
  }

  function cssEscape(value) {
    return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function escapeAttr(text) {
    return escapeHtml(String(text || "")).replace(/"/g, "&quot;");
  }
})();
