/**
 * Storyboard page runtime
 */
(function () {
  const EMPTY_PREVIEW_CANDIDATES = ["tu.png", "/static/tu.png"];
  const FIXED_IMAGE_MODEL = "gpt-image-2";
  const FIXED_VIDEO_MODEL = "wan2.6-t2v";
  let emptyPreviewImageUrl = "tu.png";
  let previewRequestId = 0;
  let activeMediaTab = "image";
  let projectId = null;
  let scenes = [];
  let activeSceneId = null;
  let projectEpisode = 1;
  const previewIndexByScene = {};
  let isGenerating = false;
  let loadingTicker = null;
  let loadingStartedAt = 0;
  let loadingPercent = 0;
  let loadingKind = "image";
  let toastTimer = null;

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
    bindConfigFieldEvents();

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
    // 从其它页面跳转过来时，优先定位到指定分镜 + 指定 tab
    const targetSceneId = localStorage.getItem("storyboard_target_scene_id");
    const targetTab = localStorage.getItem("storyboard_target_tab");
    if (targetTab) {
      switchMediaTab(targetTab === "video" ? "video" : "image");
      localStorage.removeItem("storyboard_target_tab");
    }
    if (targetSceneId) {
      const hit = scenes.find((s) => String(s.id) === String(targetSceneId));
      if (hit) selectScene(hit.id, { scrollIntoView: true });
      else if (scenes[0]) selectScene(scenes[0].id, { scrollIntoView: false });
      localStorage.removeItem("storyboard_target_scene_id");
      return;
    }
    // 默认选中第一个分镜（符合操作习惯）
    const initial = scenes[0];
    if (initial) selectScene(initial.id, { scrollIntoView: false });
  }

  function normalizeScene(scene) {
    const legacyPrompt = String(scene.prompt || "");
    const imageUrls = normalizeImageList(scene.image_urls);
    const imageUrl = scene.image_url ? String(scene.image_url) : "";
    if (!imageUrls.length && imageUrl) imageUrls.push(imageUrl);
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
      image_config: normalizeImageConfig(scene.image_config),
      video_config: normalizeVideoConfig(scene.video_config),
      image_urls: imageUrls,
      status: String(scene.status || "待开始"),
      // 真实数据：无内容就不显示预览（不强行塞占位图）
      image_url: imageUrl,
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
        image_config: { model: FIXED_IMAGE_MODEL, size: "1280x720", n: 1 },
        video_config: { model: FIXED_VIDEO_MODEL, seconds: 5, size: "720P", aspect_ratio: "16:9" },
        image_urls: ["assets/image/preview.png"],
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
      const thumbUrl = getSceneListThumbUrl(scene);
      const iconClass = `sb-item__icon ${done ? "is-done" : ""}${thumbUrl ? " has-thumb" : ""}`;
      const iconContent = thumbUrl
        ? `<span class="sb-item__icon-fallback">${icon}</span><img class="sb-item__icon-img" src="${escapeAttr(thumbUrl)}" alt="Scene ${pad2(scene.scene_index)} 缩略图">`
        : icon;
      return `
        <article class="sb-item" role="listitem" data-id="${escapeAttr(scene.id)}">
          <span class="${iconClass}">${iconContent}</span>
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
    bindSceneListThumbFallback(list);
  }

  function getSceneListThumbUrl(scene) {
    if (!scene) return "";
    if (scene.image_url) return resolveMediaUrl(scene.image_url);
    // 侧边列表允许回退到 image_urls[0]（例如视频首帧）
    const list = normalizeImageList(scene.image_urls);
    if (list.length) return resolveMediaUrl(list[0]);
    return "";
  }

  function bindSceneListThumbFallback(listRoot) {
    if (!listRoot) return;
    listRoot.querySelectorAll(".sb-item__icon-img").forEach(function (img) {
      img.addEventListener("error", function () {
        const icon = img.closest(".sb-item__icon");
        if (icon) icon.classList.remove("has-thumb");
        img.remove();
      }, { once: true });
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

    // 切换分镜时，立刻清空/置空态，避免短暂显示上一个分镜的图（串图闪烁）
    beginSceneSwitchPreview(scene);

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
    setConfigValues(scene.image_config, scene.video_config);
    // 镜头语言已移除：不再切换 chip

    refreshActiveScenePreview();
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
    const startedSceneId = String(activeSceneId);
    const scene = scenes.find((s) => String(s.id) === startedSceneId);
    if (!scene) return;
    scene.characters = valueOf("#scene-characters");
    scene.scene_description = valueOf("#scene-description");
    scene.dialogue = valueOf("#scene-dialogue");
    scene.emotion = valueOf("#scene-emotion");
    scene.image_prompt = valueOf("#scene-image-prompt");
    scene.video_prompt = valueOf("#scene-video-prompt");
    scene.image_config = collectImageConfig();
    scene.video_config = collectVideoConfig();
    // 兼容旧字段：继续写入 prompt（默认使用图片提示词）
    scene.prompt = scene.image_prompt;
    await persistScene(scene);
    renderSceneList();
    // 如果用户在保存期间切换了分镜，不要强行跳回旧分镜（会导致预览短暂串图）
    if (String(activeSceneId) === startedSceneId) {
      selectScene(scene.id, { scrollIntoView: false });
    }
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
        image_config: scene.image_config,
        video_config: scene.video_config,
        image_urls: scene.image_urls,
      });
      setText("#storyboard-status", "已保存");
      showToast("已保存", "success");
    } catch (e) {
      const msg = (e && e.message) ? e.message : "保存失败";
      setText("#storyboard-status", msg);
      showToast(msg, "error");
    }
  }

  async function submitProjectForReview() {
    if (!projectId) return;
    await syncActiveEdits();
    try {
      await api.post(`/projects/${projectId}/submit-review`);
      setText("#storyboard-status", "已提交审核");
      showToast("已提交审核", "success");
      if (window.CommonApp) window.CommonApp.routeTo("project");
    } catch (e) {
      const msg = (e && e.message) ? e.message : "提交失败";
      setText("#storyboard-status", msg);
      showToast(msg, "error");
    }
  }

  async function generateImage(sceneId) {
    if (!sceneId || !projectId) return;
    if (isGenerating) return;
    try {
      isGenerating = true;
      beginTaskLoading("image", "已提交生图请求，准备处理中…");
      await syncActiveEdits();
      updateTaskProgress("请求已发送，AI 正在生成图片…");
      const res = await api.post(`/api/scenes/${sceneId}/generate-image`);
      updateTaskProgress("图片已生成，正在加载预览…");
      const payload = (res && res.data) || {};
      const scene = scenes.find((s) => String(s.id) === String(sceneId));
      if (scene) {
        scene.image_url = String(payload.image_url || scene.image_url || "");
        scene.image_urls = normalizeImageList(payload.image_urls);
        if (!scene.image_urls.length && scene.image_url) scene.image_urls = [scene.image_url];
        previewIndexByScene[String(scene.id)] = 0;
        refreshActiveScenePreview();
      }
      finishTaskLoading(true, "图片生成完成");
      showToast("图片生成完成", "success");
    } catch (e) {
      const msg = (e && e.message) ? e.message : "图片生成失败";
      finishTaskLoading(false, msg);
      showToast(msg, "error");
    } finally {
      isGenerating = false;
    }
  }

  async function generateVideo(sceneId) {
    if (!sceneId || !projectId) return;
    if (isGenerating) return;
    try {
      isGenerating = true;
      beginTaskLoading("video", "已提交生视频请求，准备处理中…");
      await syncActiveEdits();
      updateTaskProgress("视频任务运行中…（通常需要几十秒到几分钟）");
      const res = await api.post(`/api/scenes/${sceneId}/generate-video`);
      updateTaskProgress("视频已生成，正在加载预览…");
      const payload = (res && res.data) || {};
      const scene = scenes.find((s) => String(s.id) === String(sceneId));
      if (scene && payload.video_url) {
        scene.video_url = String(payload.video_url);
      }
      refreshActiveScenePreview();
      finishTaskLoading(true, "视频生成完成");
      showToast("视频生成完成", "success");
    } catch (e) {
      const msg = (e && e.message) ? e.message : "视频生成失败";
      finishTaskLoading(false, msg);
      showToast(msg, "error");
    } finally {
      isGenerating = false;
    }
  }

  function valueOf(selector) {
    const n = document.querySelector(selector);
    return n ? String(n.value || "").trim() : "";
  }

  function intOf(selector, fallback) {
    const n = Number(valueOf(selector));
    if (!Number.isFinite(n) || n <= 0) return fallback;
    return Math.floor(n);
  }

  function clampInt(raw, min, max, fallback) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.floor(n)));
  }

  function setValue(selector, value) {
    const n = document.querySelector(selector);
    if (n) n.value = value;
  }

  function setText(selector, text) {
    const n = document.querySelector(selector);
    if (n) n.textContent = text;
  }

  function setLoading(loading, message) {
    const status = document.querySelector("#storyboard-status");
    if (status) {
      status.classList.toggle("is-loading", !!loading);
      status.textContent = message || "";
    }
    const disable = !!loading;
    [
      "#btn-gen-image",
      "#btn-gen-video",
      "#btn-save-draft",
      "#btn-submit-review",
      "#tab-image",
      "#tab-video",
    ].forEach(function (sel) {
      const n = document.querySelector(sel);
      if (!n) return;
      n.toggleAttribute("disabled", disable);
    });
  }

  function beginTaskLoading(kind, message) {
    loadingKind = kind === "video" ? "video" : "image";
    loadingStartedAt = Date.now();
    loadingPercent = 2;
    setLoading(true, message || "处理中…");
    setProgressVisualState("is-loading");
    setProgressVisible(true);
    renderTaskProgress(message || "处理中…");
    if (loadingTicker) window.clearInterval(loadingTicker);
    loadingTicker = window.setInterval(function () {
      const elapsed = Math.floor((Date.now() - loadingStartedAt) / 1000);
      loadingPercent = estimateProgressPercent(loadingKind, elapsed);
      renderTaskProgress();
    }, 1000);
  }

  function finishTaskLoading(success, message) {
    if (loadingTicker) {
      window.clearInterval(loadingTicker);
      loadingTicker = null;
    }
    loadingPercent = success ? 100 : Math.max(loadingPercent, 96);
    setLoading(false, message || (success ? "处理完成" : "处理失败"));
    setProgressVisualState(success ? "is-success" : "is-error");
    renderTaskProgress(message || "");
    window.setTimeout(function () {
      setProgressVisible(false);
    }, 1200);
  }

  function updateTaskProgress(message) {
    renderTaskProgress(message || "");
  }

  function renderTaskProgress(phaseText) {
    const wrap = document.querySelector("#sb-progress-wrap");
    const fill = document.querySelector("#sb-progress-fill");
    const text = document.querySelector("#sb-progress-text");
    const time = document.querySelector("#sb-progress-time");
    const track = wrap ? wrap.querySelector(".sb-progress__track") : null;
    if (!wrap || !fill || !text || !time || !track) return;

    const elapsed = Math.max(0, Math.floor((Date.now() - loadingStartedAt) / 1000));
    const fallbackText = loadingKind === "video" ? "视频生成中…" : "图片生成中…";
    text.textContent = phaseText || text.textContent || fallbackText;
    time.textContent = `${elapsed}s`;
    fill.style.width = `${Math.max(0, Math.min(100, loadingPercent)).toFixed(0)}%`;
    track.setAttribute("aria-valuenow", String(Math.max(0, Math.min(100, Math.round(loadingPercent)))));
  }

  function estimateProgressPercent(kind, elapsedSec) {
    // 没有后端进度接口时，使用“可感知进度曲线”，避免长期 0% 卡住的观感。
    const t = Math.max(0, Number(elapsedSec) || 0);
    if (kind === "video") {
      if (t <= 8) return Math.min(28, 4 + t * 3);
      if (t <= 30) return Math.min(62, 28 + (t - 8) * 1.55);
      if (t <= 90) return Math.min(88, 62 + (t - 30) * 0.43);
      return Math.min(95, 88 + (t - 90) * 0.08);
    }
    // image
    if (t <= 6) return Math.min(34, 4 + t * 5);
    if (t <= 20) return Math.min(72, 34 + (t - 6) * 2.7);
    if (t <= 60) return Math.min(90, 72 + (t - 20) * 0.45);
    return Math.min(95, 90 + (t - 60) * 0.08);
  }

  function setProgressVisible(visible) {
    const wrap = document.querySelector("#sb-progress-wrap");
    if (!wrap) return;
    wrap.hidden = !visible;
    if (!visible) {
      wrap.classList.remove("is-loading", "is-success", "is-error");
      const fill = document.querySelector("#sb-progress-fill");
      const text = document.querySelector("#sb-progress-text");
      const time = document.querySelector("#sb-progress-time");
      const track = wrap.querySelector(".sb-progress__track");
      if (fill) fill.style.width = "0%";
      if (text) text.textContent = "正在处理…";
      if (time) time.textContent = "0s";
      if (track) track.setAttribute("aria-valuenow", "0");
    }
  }

  function setProgressVisualState(stateClass) {
    const wrap = document.querySelector("#sb-progress-wrap");
    if (!wrap) return;
    wrap.classList.remove("is-loading", "is-success", "is-error");
    if (stateClass) wrap.classList.add(stateClass);
  }

  function showToast(message, type) {
    const node = document.querySelector("#sb-toast");
    const text = document.querySelector("#sb-toast-text");
    if (!node || !text) return;
    if (toastTimer) {
      window.clearTimeout(toastTimer);
      toastTimer = null;
    }
    text.textContent = String(message || "");
    node.hidden = false;
    node.classList.remove("is-success", "is-error");
    if (type === "error") node.classList.add("is-error");
    else node.classList.add("is-success");
    window.requestAnimationFrame(function () {
      node.classList.add("is-show");
    });
    toastTimer = window.setTimeout(function () {
      node.classList.remove("is-show");
      window.setTimeout(function () {
        node.hidden = true;
      }, 220);
    }, 2200);
  }

  function bindConfigFieldEvents() {
    const selectors = [
      "#img-size",
      "#img-count",
      "#vid-seconds",
      "#vid-size",
      "#vid-aspect",
    ];
    selectors.forEach(function (selector) {
      const node = document.querySelector(selector);
      if (!node) return;
      node.addEventListener("blur", syncActiveEdits);
      node.addEventListener("change", syncActiveEdits);
    });
  }

  function collectImageConfig() {
    return {
      model: FIXED_IMAGE_MODEL,
      size: valueOf("#img-size") || "1280x720",
      n: intOf("#img-count", 1),
    };
  }

  function collectVideoConfig() {
    return {
      model: FIXED_VIDEO_MODEL,
      seconds: clampInt(valueOf("#vid-seconds"), 4, 15, 5),
      size: normalizeVideoSize(valueOf("#vid-size") || "720P"),
      aspect_ratio: valueOf("#vid-aspect") || "16:9",
    };
  }

  function setConfigValues(imageConfig, videoConfig) {
    const img = normalizeImageConfig(imageConfig);
    const vid = normalizeVideoConfig(videoConfig);
    setValue("#img-size", img.size);
    setValue("#img-count", String(img.n));
    setValue("#vid-seconds", String(vid.seconds));
    setValue("#vid-size", vid.size);
    setValue("#vid-aspect", vid.aspect_ratio);
  }

  function normalizeImageConfig(config) {
    const cfg = (config && typeof config === "object") ? config : {};
    return {
      model: FIXED_IMAGE_MODEL,
      size: String(cfg.size || "1280x720"),
      n: Number(cfg.n || 1),
    };
  }

  function normalizeVideoConfig(config) {
    const cfg = (config && typeof config === "object") ? config : {};
    return {
      model: FIXED_VIDEO_MODEL,
      seconds: clampInt(cfg.seconds, 4, 15, 5),
      size: normalizeVideoSize(cfg.size || "720P"),
      aspect_ratio: String(cfg.aspect_ratio || "16:9"),
    };
  }

  function normalizeVideoSize(value) {
    const text = String(value || "").trim().toUpperCase();
    if (text === "1920X1080" || text === "1080P" || text === "1080") return "1080P";
    return "720P";
  }

  function normalizeImageList(value) {
    if (!Array.isArray(value)) return [];
    return value.map(function (v) { return String(v || "").trim(); }).filter(Boolean);
  }

  function getActivePreviewUrl(scene) {
    // 红框主预览仅看 image_url；为空则展示空态
    return resolveMediaUrl(String((scene && scene.image_url) || ""));
  }

  function renderPreviewThumbnails(scene) {
    const wrap = document.querySelector("#sb-preview-thumbs");
    if (!wrap || !scene || activeMediaTab !== "image") {
      if (wrap) {
        wrap.hidden = true;
        wrap.innerHTML = "";
      }
      return;
    }
    if (!String(scene.image_url || "").trim()) {
      wrap.hidden = true;
      wrap.innerHTML = "";
      return;
    }
    const sid = String(scene.id || "");
    const list = normalizeImageList(scene.image_urls);
    // 只有 >=2 张图时才展示缩略图条；0/1 张都隐藏（避免“没图也冒出一个缩略图”）
    if (list.length <= 1) {
      wrap.hidden = true;
      wrap.innerHTML = "";
      return;
    }
    wrap.hidden = false;
    const current = Math.max(0, Math.min(list.length - 1, previewIndexByScene[sid] || 0));
    previewIndexByScene[sid] = current;
    wrap.innerHTML = list.map(function (url, idx) {
      const active = idx === current ? " is-active" : "";
      return `<img class="sb-preview-thumb${active}" data-idx="${idx}" src="${escapeAttr(resolveMediaUrl(url))}" alt="缩略图${idx + 1}">`;
    }).join("");
    wrap.querySelectorAll(".sb-preview-thumb").forEach(function (node) {
      node.addEventListener("click", function () {
        const idx = Number(node.getAttribute("data-idx"));
        previewIndexByScene[sid] = Number.isFinite(idx) ? idx : 0;
        renderPreviewThumbnails(scene);
        updatePreviewImage(getActivePreviewUrl(scene));
      });
    });
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
    refreshActiveScenePreview();
  }

  function refreshActiveScenePreview() {
    const scene = scenes.find((s) => String(s.id) === String(activeSceneId));
    if (!scene) return;
    if (activeMediaTab === "video") {
      renderPreviewThumbnails(null);
      updatePreviewVideo(scene.video_url);
      return;
    }
    renderPreviewThumbnails(scene);
    const activePreviewUrl = getActivePreviewUrl(scene);
    updatePreviewImage(activePreviewUrl);
  }

  function beginSceneSwitchPreview(scene) {
    const previewWrap = document.querySelector(".sb-preview");
    const img = document.querySelector("#sb-preview-image");
    const video = document.querySelector("#sb-preview-video");
    if (!previewWrap || !img) return;

    // 取消所有尚未完成的预加载回调，避免旧分镜的 onload 覆盖新分镜
    previewRequestId += 1;

    // 先停止视频，统一回到空态（不展示上一个分镜的内容）
    if (video) {
      try { video.pause(); } catch {}
      video.removeAttribute("src");
      video.hidden = true;
      try { video.load(); } catch {}
    }
    img.hidden = false;
    applyEmptyPreview(previewWrap, img);
    // 缩略图条也先隐藏，避免短暂残留
    const thumbs = document.querySelector("#sb-preview-thumbs");
    if (thumbs) {
      thumbs.hidden = true;
      thumbs.innerHTML = "";
    }
  }

  function updatePreviewImage(imageUrl) {
    const previewWrap = document.querySelector(".sb-preview");
    const img = document.querySelector("#sb-preview-image");
    const video = document.querySelector("#sb-preview-video");
    if (!previewWrap || !img) return;
    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.hidden = true;
      video.load();
    }
    img.hidden = false;
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

  function updatePreviewVideo(videoUrl) {
    const previewWrap = document.querySelector(".sb-preview");
    const img = document.querySelector("#sb-preview-image");
    const video = document.querySelector("#sb-preview-video");
    if (!previewWrap || !img || !video) return;
    const url = resolveMediaUrl(videoUrl);
    if (!url) {
      video.pause();
      video.removeAttribute("src");
      video.hidden = true;
      video.load();
      img.hidden = false;
      applyEmptyPreview(previewWrap, img);
      return;
    }
    previewWrap.removeAttribute("hidden");
    previewWrap.classList.remove("is-empty");
    img.hidden = true;
    video.hidden = false;
    video.src = url;
    video.load();
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

  function resolveMediaUrl(url) {
    const text = String(url || "").trim();
    if (!text) return "";
    // 历史占位图 URL：不应再请求，避免侧栏出现破图 + 多余网络请求
    if (
      text.includes("via.placeholder.com") ||
      text.includes("placehold.co") ||
      text.includes("dummyimage.com")
    ) {
      return "";
    }
    return text.replaceAll("\\", "/");
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
