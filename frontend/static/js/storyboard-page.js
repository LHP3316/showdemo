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
    bindClick("#btn-submit-review", syncActiveEdits);
    bindClick("#btn-gen-image", function () { generateImage(activeSceneId); });
    bindClick("#btn-gen-video", function () { generateVideo(activeSceneId); });

    const desc = document.querySelector("#scene-description");
    if (desc) desc.addEventListener("blur", syncActiveEdits);

    const prompt = document.querySelector("#scene-prompt");
    if (prompt) prompt.addEventListener("blur", syncActiveEdits);

    const camera = document.querySelector("#scene-camera");
    if (camera) camera.addEventListener("change", syncActiveEdits);

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
    const initial = scenes.find((s) => s.scene_index === 3) || scenes[0];
    if (initial) selectScene(initial.id, { scrollIntoView: false });
  }

  function normalizeScene(scene) {
    return {
      id: String(scene.id),
      scene_index: Number(scene.scene_index || 0),
      scene_description: String(scene.scene_description || ""),
      prompt: String(scene.prompt || ""),
      shot_type: String(scene.shot_type || "中景"),
      camera_move: String(scene.camera_move || "Follow Dolly"),
      status: String(scene.status || "待开始"),
      image_url: scene.image_url ? String(scene.image_url) : "assets/image/preview.png",
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
        scene_description: t.desc,
        prompt: "medium shot, Chinese ancient warrior walking toward mysterious stone stele, tall ancient trees, golden light through leaves, cinematic atmosphere, 8k quality",
        shot_type: i % 3 === 0 ? "中景" : i % 2 === 0 ? "特写" : "全景",
        camera_move: "Follow Dolly",
        status: i <= 2 ? "已完成" : i === 3 ? "进行中" : "待开始",
        image_url: "assets/image/preview.png",
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
    setValue("#scene-description", scene.scene_description);
    setValue("#scene-prompt", scene.prompt);
    setValue("#scene-camera", scene.camera_move);
    activateShotChip(scene.shot_type);

    const img = document.querySelector("#sb-preview-image");
    if (img) img.src = scene.image_url || "assets/image/preview.png";
  }

  function stepScene(delta) {
    if (!scenes.length) return;
    const current = scenes.findIndex((s) => String(s.id) === String(activeSceneId));
    const base = current < 0 ? 0 : current;
    const next = Math.max(0, Math.min(scenes.length - 1, base + delta));
    selectScene(scenes[next].id);
  }

  function syncActiveEdits() {
    if (!activeSceneId) return;
    const scene = scenes.find((s) => String(s.id) === String(activeSceneId));
    if (!scene) return;
    scene.scene_description = valueOf("#scene-description");
    scene.prompt = valueOf("#scene-prompt");
    scene.camera_move = valueOf("#scene-camera") || "Follow Dolly";
    scene.shot_type = activeShotType();
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
