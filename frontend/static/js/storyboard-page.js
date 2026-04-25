/**
 * Storyboard page runtime
 */
(function () {
  let projectId = null;
  let scenes = [];
  let activeSceneId = null;

  document.addEventListener("DOMContentLoaded", async function () {
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

    const characters = document.querySelector("#scene-characters");
    if (characters) characters.addEventListener("blur", syncActiveEdits);

    const desc = document.querySelector("#scene-description");
    if (desc) desc.addEventListener("blur", syncActiveEdits);

    const dialogue = document.querySelector("#scene-dialogue");
    if (dialogue) dialogue.addEventListener("blur", syncActiveEdits);

    const emotion = document.querySelector("#scene-emotion");
    if (emotion) emotion.addEventListener("blur", syncActiveEdits);

    const prompt = document.querySelector("#scene-prompt");
    if (prompt) prompt.addEventListener("blur", syncActiveEdits);

    const cameraAngle = document.querySelector("#scene-camera-angle");
    if (cameraAngle) cameraAngle.addEventListener("change", syncActiveEdits);

    document.querySelectorAll(".sb-chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        document.querySelectorAll(".sb-chip").forEach(function (n) {
          n.classList.remove("is-active");
        });
        chip.classList.add("is-active");
        syncActiveEdits();
      });
    });
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

    const title = project && project.title ? project.title : "寻龙少年";
    const episode = Number(project && project.episode_number ? project.episode_number : 6);
    setText("#storyboard-page-title", "分镜工位");
    setText("#storyboard-page-subtitle", `${title} · 第${episode}集`);

    scenes = remoteScenes.length ? remoteScenes.map(normalizeScene) : buildFallbackScenes();
    renderSceneList();
    // 默认选中第一个分镜（符合操作习惯）
    const initial = scenes[0];
    if (initial) selectScene(initial.id, { scrollIntoView: false });
  }

  function normalizeScene(scene) {
    return {
      id: String(scene.id),
      scene_index: Number(scene.scene_index || 0),
      characters: String(scene.characters || ""),
      scene_description: String(scene.scene_description || ""),
      dialogue: String(scene.dialogue || ""),
      camera_angle: String(scene.camera_angle || ""),
      emotion: String(scene.emotion || ""),
      prompt: String(scene.prompt || ""),
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
        scene_index: i,
        characters: "主角",
        scene_description: t.desc,
        dialogue: "",
        camera_angle: i % 3 === 0 ? "中景" : i % 2 === 0 ? "特写" : "全景",
        emotion: "自然",
        prompt: "medium shot, Chinese ancient warrior walking toward mysterious stone stele, tall ancient trees, golden light through leaves, cinematic atmosphere, 8k quality",
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

    setText("#sb-editor-title", `Scene ${pad2(scene.scene_index)} · 第6集`);
    setText("#sb-active-tag", `Scene ${pad2(scene.scene_index)} / 第6集`);
    setText("#sb-active-desc", scene.scene_description);
    setValue("#scene-characters", scene.characters);
    setValue("#scene-description", scene.scene_description);
    setValue("#scene-dialogue", scene.dialogue);
    setValue("#scene-emotion", scene.emotion);
    setValue("#scene-prompt", scene.prompt);
    setValue("#scene-camera-angle", pickCameraAddon(scene.camera_angle));
    activateShotChip(pickCameraChip(scene.camera_angle));

    // 中间预览：没有内容则隐藏（避免显示空/脏画面）
    const previewWrap = document.querySelector(".sb-preview");
    const img = document.querySelector("#sb-preview-image");
    const hasImage = !!(scene.image_url && String(scene.image_url).trim());
    const hasVideo = !!(scene.video_url && String(scene.video_url).trim());
    const shouldShow = hasImage || hasVideo;
    if (previewWrap) previewWrap.toggleAttribute("hidden", !shouldShow);
    if (img) {
      if (hasImage) img.src = scene.image_url;
      else img.removeAttribute("src");
    }
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
    scene.prompt = valueOf("#scene-prompt");
    scene.camera_angle = mergeCameraAngle(activeShotType(), valueOf("#scene-camera-angle"));

    await persistScene(scene);
    renderSceneList();
    selectScene(scene.id, { scrollIntoView: false });
  }

  function activateShotChip(shot) {
    document.querySelectorAll(".sb-chip").forEach(function (chip) {
      chip.classList.toggle("is-active", chip.getAttribute("data-shot") === shot);
    });
  }

  function activeShotType() {
    const active = document.querySelector(".sb-chip.is-active");
    return active ? String(active.getAttribute("data-shot")) : "中景";
  }

  function mergeCameraAngle(base, addon) {
    const a = String(addon || "").trim();
    const b = String(base || "").trim();
    if (!a) return b;
    if (!b) return a;
    if (a === b) return b;
    return `${b},${a}`;
  }

  function pickCameraChip(cameraAngle) {
    const text = String(cameraAngle || "");
    if (text.includes("特写")) return "特写";
    if (text.includes("全景")) return "全景";
    if (text.includes("中景")) return "中景";
    return "中景";
  }

  function pickCameraAddon(cameraAngle) {
    const text = String(cameraAngle || "");
    const options = ["远景", "近景", "俯拍", "仰拍", "跟拍"];
    for (const o of options) {
      if (text.includes(o)) return o;
    }
    return "";
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
