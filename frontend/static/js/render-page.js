/**
 * AI 生成队列页（render.html）
 */
(function () {
  let projectId = null;
  let scenes = [];
  let tasks = [];

  function startRenderPage() {
    if (!window.CommonApp || !window.api) {
      renderBootError("脚本未就绪（缺少 api 或 CommonApp），请刷新页面");
      return;
    }
    CommonApp.ensureSession(true).then(function (ok) {
      if (!ok) return;
      return ensureProjectId();
    }).then(function (pid) {
      projectId = pid;
      return loadData();
    }).catch(function (e) {
      setStatus(e && e.message ? e.message : "初始化失败", true);
      renderEmpty("页面初始化失败，请刷新重试");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startRenderPage);
  } else {
    startRenderPage();
  }

  function renderBootError(msg) {
    setText("#render-page-subtitle", msg);
    renderEmpty(msg);
  }

  function isNumericProjectId(id) {
    if (id == null || id === "") return false;
    return /^\d+$/.test(String(id).trim());
  }

  async function ensureProjectId() {
    const fromQuery = new URLSearchParams(window.location.search).get("id");
    if (fromQuery && isNumericProjectId(fromQuery)) {
      localStorage.setItem("activeProjectId", fromQuery);
      return fromQuery;
    }
    if (fromQuery && !isNumericProjectId(fromQuery)) {
      localStorage.removeItem("activeProjectId");
    }

    const fromCache = localStorage.getItem("activeProjectId");
    if (fromCache && isNumericProjectId(fromCache)) {
      return fromCache;
    }
    if (fromCache) {
      localStorage.removeItem("activeProjectId");
    }

    const res = await api.get("/projects?size=1");
    const first = res && res.data && res.data.items ? res.data.items[0] : null;
    if (first && first.id) {
      localStorage.setItem("activeProjectId", String(first.id));
      window.history.replaceState({}, "", `render.html?id=${first.id}`);
      return String(first.id);
    }
    return null;
  }

  async function loadData() {
    if (!projectId) {
      setStatus("未找到项目，请从项目管理进入", true);
      renderEmpty("未找到项目");
      return;
    }
    try {
      const projectRes = await api.get(`/projects/${projectId}`);
      const p = normalizeProject(projectRes);

      scenes = normalizeSceneList(p.scenes);
      if (!scenes.length) {
        try {
          const scenesRes = await api.get("/api/scenes/", { project_id: projectId });
          scenes = normalizeSceneList(scenesRes && scenesRes.data);
        } catch (e2) {
          scenes = [];
        }
      }

      tasks = [];
      try {
        const tasksRes = await api.get("/api/tasks", { page: 1, size: 100 });
        const taskPayload = tasksRes && tasksRes.data;
        const allTaskItems = (taskPayload && taskPayload.items) || [];
        const sceneIds = new Set(scenes.map((s) => Number(s.id)));
        tasks = allTaskItems.filter((t) => sceneIds.has(Number(t.scene_id)));
      } catch (e3) {
        tasks = [];
      }

      const episode = pickEpisode(p, scenes);
      const sub = `${p.title || "未命名项目"} · 第${episode}集 · 共${scenes.length}个场景`;
      setText("#render-page-subtitle", sub);

      updateStats(scenes);
      renderCards(scenes);
      setStatus("已加载", false);
    } catch (e) {
      setStatus(e.message || "加载失败", true);
      renderEmpty("加载失败，请稍后重试（请确认已登录且后端已启动）");
    }
  }

  function normalizeProject(res) {
    const d = res && res.data;
    return d && typeof d === "object" ? d : {};
  }

  function normalizeSceneList(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    return [];
  }

  function pickEpisode(p, list) {
    const fromP = Number(p.current_episode);
    if (fromP > 0) return fromP;
    const first = list && list[0];
    const fromScene = first && Number(first.episode_number);
    if (fromScene > 0) return fromScene;
    return 6;
  }

  function getActiveTaskForScene(sceneId) {
    const sid = Number(sceneId);
    const list = tasks.filter(
      (t) => Number(t.scene_id) === sid && (t.status === "pending" || t.status === "processing")
    );
    if (!list.length) return null;
    return list.sort((a, b) => Number(b.id) - Number(a.id))[0];
  }

  function updateStats(list) {
    let nWait = 0;
    let nGen = 0;
    let nDone = 0;
    for (const s of list) {
      const t = getActiveTaskForScene(s.id);
      if (t) nGen++;
      else if (s.image_url) nDone++;
      else nWait++;
    }
    setText("#rq-stat-done", String(nDone));
    setText("#rq-stat-gen", String(nGen));
    setText("#rq-stat-wait", String(nWait));
  }

  function getCardKind(scene) {
    const t = getActiveTaskForScene(scene.id);
    if (t) return { kind: "generating", task: t };
    if (scene.video_url) return { kind: "video_done", task: null };
    if (scene.image_url) return { kind: "image_done", task: null };
    return { kind: "pending", task: null };
  }

  function renderEmpty(msg) {
    const grid = document.querySelector("#render-card-grid");
    if (!grid) return;
    grid.innerHTML = `<div class="rq-empty rq-grid__solo" id="rq-empty">${escapeHtml(msg)}</div>`;
  }

  function renderCards(list) {
    const grid = document.querySelector("#render-card-grid");
    if (!grid) return;
    if (!list.length) {
      renderEmpty("暂无分镜数据");
      return;
    }
    grid.innerHTML = list
      .map((s) => {
        const idx = pad2(s.scene_index);
        const name = `Scene ${idx}`;
        const desc = String(s.scene_description || s.prompt || "—");
        const { kind, task } = getCardKind(s);
        if (kind === "generating") return cardGenerating(s, name, desc, task);
        if (kind === "video_done") return cardVideoDone(s, name, desc);
        if (kind === "image_done") return cardImageDone(s, name, desc);
        return cardPending(s, name, desc);
      })
      .join("");

    bindCardActions();
  }

  function cardImageDone(s, name, desc) {
    const safeDesc = escapeHtml(desc);
    return `
    <article class="rq-card rq-card--imdone" data-scene-id="${s.id}">
      <div class="rq-card__media">
        <div class="rq-card__media--tint">
          <img src="${escapeAttr(s.image_url)}" alt="${escapeAttr(name)}" crossorigin="anonymous" />
        </div>
        <div class="rq-badge-rt">已完成</div>
      </div>
      <div class="rq-card__body">
        <div class="rq-row-top">
          <h2 class="rq-scene-name">${escapeHtml(name)}</h2>
          <span class="rq-st-badge rq-st-badge--done">已完成</span>
        </div>
        <p class="rq-desc">${safeDesc}</p>
      </div>
      <div class="rq-foot">
        <button type="button" class="rq-btn rq-btn--line-orange js-rq-regen-img">重新生图</button>
        <button type="button" class="rq-btn rq-btn--purple js-rq-img2v">图生视频</button>
      </div>
    </article>`;
  }

  function cardGenerating(s, name, desc, task) {
    const safeDesc = escapeHtml(desc);
    return `
    <article class="rq-card rq-card--gen" data-scene-id="${s.id}" data-task-id="${task ? task.id : ""}">
      <div class="rq-card__media">
        <div class="rq-gen-placeholder">
          <div class="rq-spin" aria-hidden="true"></div>
          <span>AI生成中…</span>
        </div>
      </div>
      <div class="rq-card__body">
        <div class="rq-row-top">
          <h2 class="rq-scene-name">${escapeHtml(name)}</h2>
          <span class="rq-st-badge rq-st-badge--gen">生成中</span>
        </div>
        <p class="rq-desc">${safeDesc}</p>
      </div>
      <div class="rq-foot">
        <button type="button" class="rq-btn rq-btn--full rq-btn--ghost js-rq-cancel">取消生成</button>
      </div>
    </article>`;
  }

  function cardPending(s, name, desc) {
    const safeDesc = escapeHtml(desc);
    return `
    <article class="rq-card rq-card--pend" data-scene-id="${s.id}">
      <div class="rq-card__media">
        <div class="rq-pend-placeholder">
          <div class="rq-pend-icon" aria-hidden="true"></div>
          <span>等待生成</span>
        </div>
      </div>
      <div class="rq-card__body">
        <div class="rq-row-top">
          <h2 class="rq-scene-name">${escapeHtml(name)}</h2>
          <span class="rq-st-badge rq-st-badge--pend">待生成</span>
        </div>
        <p class="rq-desc">${safeDesc}</p>
      </div>
      <div class="rq-foot">
        <button type="button" class="rq-btn rq-btn--yellow js-rq-gen-now">立即生图</button>
        <button type="button" class="rq-btn rq-btn--violet-muted" disabled>生成视频</button>
      </div>
    </article>`;
  }

  function cardVideoDone(s, name, desc) {
    const poster = s.image_url || s.video_url;
    const safeDesc = escapeHtml(desc);
    return `
    <article class="rq-card rq-card--vdone" data-scene-id="${s.id}">
      <div class="rq-card__media">
        <img src="${escapeAttr(poster)}" alt="${escapeAttr(name)}" crossorigin="anonymous" />
        <div class="rq-badge-lt">视频已完成</div>
      </div>
      <div class="rq-card__body">
        <div class="rq-row-top">
          <h2 class="rq-scene-name">${escapeHtml(name)}</h2>
          <span class="rq-st-badge rq-st-badge--video">视频完成</span>
        </div>
        <p class="rq-desc">${safeDesc}</p>
      </div>
      <div class="rq-foot">
        <button type="button" class="rq-btn rq-btn--line-gray js-rq-preview">预览视频</button>
        <button type="button" class="rq-btn rq-btn--line-orange js-rq-regen-all">重新生成</button>
      </div>
    </article>`;
  }

  function bindCardActions() {
    document.querySelectorAll(".js-rq-regen-img").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = getSceneId(btn);
        if (id) queueGenerateImage(id);
      });
    });
    document.querySelectorAll(".js-rq-img2v").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = getSceneId(btn);
        if (id) queueGenerateVideo(id);
      });
    });
    document.querySelectorAll(".js-rq-gen-now").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = getSceneId(btn);
        if (id) queueGenerateImage(id);
      });
    });
    document.querySelectorAll(".js-rq-preview").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = getSceneId(btn);
        const scene = scenes.find((s) => String(s.id) === String(id));
        if (scene && scene.video_url) {
          window.open(scene.video_url, "_blank", "noopener,noreferrer");
        } else {
          setStatus("暂无可预览的视频地址", true);
        }
      });
    });
    document.querySelectorAll(".js-rq-regen-all").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = getSceneId(btn);
        if (id) queueGenerateVideo(id);
      });
    });
    document.querySelectorAll(".js-rq-cancel").forEach((btn) => {
      btn.addEventListener("click", () => {
        const card = btn.closest(".rq-card");
        const taskId = card && card.getAttribute("data-task-id");
        if (!taskId) {
          setStatus("未找到任务", true);
          return;
        }
        cancelTask(taskId);
      });
    });
  }

  function getSceneId(el) {
    const card = el && el.closest(".rq-card");
    return card ? card.getAttribute("data-scene-id") : null;
  }

  async function queueGenerateImage(sceneId) {
    if (!sceneId) return;
    try {
      await api.post(`/api/scenes/${sceneId}/generate-image`);
      setStatus("文生图任务已提交");
      await loadData();
    } catch (e) {
      setStatus(e.message || "文生图失败", true);
    }
  }

  async function queueGenerateVideo(sceneId) {
    if (!sceneId) return;
    try {
      await api.post(`/api/scenes/${sceneId}/generate-video`);
      setStatus("图生视频任务已提交");
      await loadData();
    } catch (e) {
      setStatus(e.message || "图生视频失败", true);
    }
  }

  async function cancelTask(taskId) {
    try {
      await api.delete(`/api/tasks/${taskId}`);
      setStatus("已取消任务");
      await loadData();
    } catch (e) {
      setStatus(e.message || "无法取消：任务可能正在执行中", true);
    }
  }

  function setText(selector, text) {
    const node = document.querySelector(selector);
    if (node) node.textContent = text;
  }

  function setStatus(message, isError) {
    const node = document.querySelector("#render-status");
    if (!node) return;
    node.textContent = message;
    node.classList.toggle("error", !!isError);
    node.toggleAttribute("hidden", !isError);
  }

  function pad2(n) {
    return String(Number(n) || 0).padStart(2, "0");
  }

  function escapeHtml(text) {
    return String(text || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;")
      .replaceAll("'", "&#39;");
  }

  function escapeAttr(value) {
    return String(value || "").replaceAll("&", "&amp;").replaceAll("\"", "&quot;");
  }
})();
