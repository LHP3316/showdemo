/**
 * Review workbench page runtime
 */
(function () {
  const BACKEND_MEDIA_BASE = "http://localhost:8001";
  let projectId = null;
  let scenes = [];
  let activeSceneId = null;
  let activeMediaTab = "image";
  const previewIndexByScene = {};
  let projectTitle = "未命名项目";
  let projectEpisode = 1;

  document.addEventListener("DOMContentLoaded", async function () {
    if (!window.CommonApp || !window.api) return;
    const ok = await CommonApp.ensureSession(true);
    if (!ok) return;

    projectId = ensureProjectId();
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
    bindClick("#tab-image", function () { switchMediaTab("image"); });
    bindClick("#tab-video", function () { switchMediaTab("video"); });
    bindClick("#btn-review-pass", function () { submitReview("approved"); });
    bindClick("#btn-review-reject", function () { submitReview("rejected"); });
  }

  function bindClick(selector, handler) {
    const node = document.querySelector(selector);
    if (node) node.addEventListener("click", handler);
  }

  function ensureProjectId() {
    const q = new URLSearchParams(window.location.search).get("id");
    if (q) {
      localStorage.setItem("activeProjectId", String(q));
      return String(q);
    }
    const c = localStorage.getItem("activeProjectId");
    return c ? String(c) : "";
  }

  async function loadData() {
    if (!projectId) {
      setStatus("未找到项目，请从项目监控或审核中心进入", true);
      return;
    }
    try {
      const [projectRes, scenesRes, reviewRes] = await Promise.all([
        api.get(`/projects/${projectId}`),
        api.get(`/api/scenes/?project_id=${projectId}`),
        api.get(`/api/reviews/?project_id=${projectId}&size=50`),
      ]);

      const project = (projectRes && projectRes.data) || {};
      scenes = Array.isArray(scenesRes && scenesRes.data) ? scenesRes.data : [];
      const history = (reviewRes && reviewRes.data && reviewRes.data.items) || [];

      projectTitle = project.title || "未命名项目";
      projectEpisode = Number(project.current_episode || 1);
      setText("#review-workbench-title", "审核工位");
      setText("#review-workbench-subtitle", `${projectTitle} · 第${projectEpisode}集`);

      renderSceneList();
      renderHistory(history);
      if (scenes.length) selectScene(String(scenes[0].id), { scrollIntoView: false });
      else {
        setText("#sb-active-tag", "Scene -- / 第--集");
        setText("#sb-active-desc", "当前项目暂无分镜");
        updatePreview("", "");
      }
      setStatus("已加载");
    } catch (e) {
      setStatus(e && e.message ? e.message : "加载失败", true);
    }
  }

  function renderSceneList() {
    const list = document.querySelector("#sb-scene-list");
    if (!list) return;
    setText("#sb-scene-count", `${scenes.length}场`);
    list.innerHTML = scenes.map((scene) => {
      const thumb = resolveMediaUrl(scene.image_url || "");
      const icon = thumb
        ? `<span class="sb-item__icon has-thumb"><img class="sb-item__icon-img" src="${escapeAttr(thumb)}" alt="Scene ${pad2(scene.scene_index)} 缩略图"></span>`
        : `<span class="sb-item__icon">□</span>`;
      return `
        <article class="sb-item" role="listitem" data-id="${escapeAttr(String(scene.id))}">
          ${icon}
          <div>
            <h3 class="sb-item__name">Scene ${pad2(scene.scene_index)}</h3>
            <p class="sb-item__subtitle">${escapeHtml(scene.scene_description || "暂无描述")}</p>
          </div>
        </article>
      `;
    }).join("");

    list.querySelectorAll(".sb-item").forEach((node) => {
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
      list.querySelectorAll(".sb-item").forEach((n) => n.classList.remove("is-active"));
      const activeNode = list.querySelector(`.sb-item[data-id="${cssEscape(activeSceneId)}"]`);
      if (activeNode) {
        activeNode.classList.add("is-active");
        if (opts.scrollIntoView !== false) activeNode.scrollIntoView({ block: "nearest" });
      }
    }

    const scene = scenes.find((s) => String(s.id) === activeSceneId);
    if (!scene) return;
    const ep = Number(scene.episode_number || projectEpisode || 1);
    setText("#sb-active-tag", `Scene ${pad2(scene.scene_index)} / 第${ep}集`);
    setText("#sb-active-desc", scene.scene_description || "暂无描述");
    refreshActivePreview(scene);
  }

  function stepScene(delta) {
    if (!scenes.length) return;
    const current = scenes.findIndex((s) => String(s.id) === String(activeSceneId));
    const base = current < 0 ? 0 : current;
    const next = Math.max(0, Math.min(scenes.length - 1, base + delta));
    selectScene(String(scenes[next].id));
  }

  function refreshActivePreview(scene) {
    if (!scene) {
      renderPreviewThumbnails(null);
      updatePreview("", "");
      return;
    }
    renderPreviewThumbnails(scene);
    updatePreview(scene.image_url, scene.video_url);
  }

  function updatePreview(imageUrl, videoUrl) {
    const previewWrap = document.querySelector(".sb-preview");
    const img = document.querySelector("#sb-preview-image");
    const video = document.querySelector("#sb-preview-video");
    if (!img || !video || !previewWrap) return;

    const scene = scenes.find((s) => String(s.id) === String(activeSceneId));
    const image = pickActiveImageUrl(scene, imageUrl);
    const vurl = resolveMediaUrl(videoUrl || "");
    if (activeMediaTab === "video") {
      if (vurl) {
        previewWrap.classList.remove("is-empty");
        img.classList.remove("is-empty");
        img.hidden = true;
        video.hidden = false;
        video.src = vurl;
        video.load();
        return;
      }
    } else if (image) {
      previewWrap.classList.remove("is-empty");
      img.classList.remove("is-empty");
      video.pause();
      video.removeAttribute("src");
      video.hidden = true;
      img.hidden = false;
      img.src = image;
      return;
    } else if (vurl) {
      img.hidden = true;
      video.hidden = false;
      video.src = vurl;
      video.load();
      return;
    }
    video.pause();
    video.removeAttribute("src");
    video.hidden = true;
    img.hidden = false;
    previewWrap.classList.add("is-empty");
    img.classList.add("is-empty");
    img.src = "tu.png";
  }

  function renderPreviewThumbnails(scene) {
    const wrap = document.querySelector("#sb-preview-thumbs");
    if (!wrap) return;
    if (!scene || activeMediaTab !== "image") {
      wrap.hidden = true;
      wrap.innerHTML = "";
      return;
    }
    const sid = String(scene.id || "");
    const list = normalizeImageList(scene.image_urls);
    const single = resolveMediaUrl(scene.image_url || "");
    if (!list.length && single) list.push(single);
    if (!list.length) {
      wrap.hidden = true;
      wrap.innerHTML = "";
      return;
    }
    wrap.hidden = false;
    const current = Math.max(0, Math.min(list.length - 1, previewIndexByScene[sid] || 0));
    previewIndexByScene[sid] = current;
    wrap.innerHTML = list.map((url, idx) => {
      const active = idx === current ? " is-active" : "";
      return `<img class="sb-preview-thumb${active}" data-idx="${idx}" src="${escapeAttr(url)}" alt="缩略图${idx + 1}">`;
    }).join("");
    wrap.querySelectorAll(".sb-preview-thumb").forEach((node) => {
      node.addEventListener("click", function () {
        const idx = Number(node.getAttribute("data-idx"));
        previewIndexByScene[sid] = Number.isFinite(idx) ? idx : 0;
        renderPreviewThumbnails(scene);
        updatePreview(scene.image_url, scene.video_url);
      });
    });
  }

  function pickActiveImageUrl(scene, fallbackImageUrl) {
    if (!scene) return resolveMediaUrl(fallbackImageUrl || "");
    const sid = String(scene.id || "");
    const list = normalizeImageList(scene.image_urls);
    const single = resolveMediaUrl(scene.image_url || fallbackImageUrl || "");
    if (!list.length && single) return single;
    if (!list.length) return "";
    const idx = Math.max(0, Math.min(list.length - 1, previewIndexByScene[sid] || 0));
    return list[idx] || "";
  }

  function normalizeImageList(value) {
    if (!Array.isArray(value)) return [];
    return value.map((v) => resolveMediaUrl(v || "")).filter(Boolean);
  }

  function switchMediaTab(tab) {
    activeMediaTab = tab === "video" ? "video" : "image";
    toggleTabState();
    const scene = scenes.find((s) => String(s.id) === String(activeSceneId));
    refreshActivePreview(scene);
  }

  function toggleTabState() {
    const isImage = activeMediaTab === "image";
    const tabImage = document.querySelector("#tab-image");
    const tabVideo = document.querySelector("#tab-video");
    if (tabImage) {
      tabImage.classList.toggle("is-active", isImage);
      tabImage.setAttribute("aria-selected", isImage ? "true" : "false");
    }
    if (tabVideo) {
      tabVideo.classList.toggle("is-active", !isImage);
      tabVideo.setAttribute("aria-selected", !isImage ? "true" : "false");
    }
  }

  function renderHistory(items) {
    const list = document.querySelector("#review-history-list");
    if (!list) return;
    if (!items.length) {
      list.classList.add("is-empty");
      list.innerHTML = `<li class="rw-history__empty">暂无历史审核记录</li>`;
      return;
    }
    list.classList.remove("is-empty");
    list.innerHTML = items.map((r) => {
      const status = r.status === "approved" ? "已通过" : "驳回";
      const statusClass = r.status === "approved" ? "rw-history__status--approved" : "rw-history__status--rejected";
      const iconClass = r.status === "approved" ? "rw-history__icon--approved" : "rw-history__icon--rejected";
      const iconText = r.status === "approved" ? "✓" : "×";
      const reviewer = String(r.reviewer_id || "导演");
      const time = String(r.created_at || "");
      const comment = (r.comment && String(r.comment).trim()) ? String(r.comment).trim() : "（无备注）";
      return `
        <li class="rw-history__item">
          <div class="rw-history__meta">
            <span class="rw-history__icon ${iconClass}" aria-hidden="true">${iconText}</span>
            <span class="rw-history__name">${escapeHtml(reviewer)}</span>
            <span class="rw-history__time">${escapeHtml(time)}</span>
            <span class="rw-history__status ${statusClass}">${escapeHtml(status)}</span>
          </div>
          <p class="rw-history__comment">${escapeHtml(comment)}</p>
        </li>
      `;
    }).join("");
  }

  async function submitReview(status) {
    if (!projectId) return;
    try {
      const comment = valueOf("#review-comment-text");
      await api.post("/api/reviews/", {
        project_id: Number(projectId),
        status,
        comment,
      });
      setStatus(status === "approved" ? "已提交：审核通过" : "已提交：驳回审核");
      await refreshHistoryOnly();
    } catch (e) {
      setStatus(e && e.message ? e.message : "提交失败", true);
    }
  }

  async function refreshHistoryOnly() {
    if (!projectId) return;
    const reviewRes = await api.get(`/api/reviews/?project_id=${projectId}&size=50`);
    const history = (reviewRes && reviewRes.data && reviewRes.data.items) || [];
    renderHistory(history);
  }

  function valueOf(selector) {
    const node = document.querySelector(selector);
    return node ? String(node.value || "").trim() : "";
  }

  function setText(selector, text) {
    const node = document.querySelector(selector);
    if (node) node.textContent = text;
  }

  function setStatus(message, isError) {
    const node = document.querySelector("#review-workbench-status");
    if (!node) return;
    node.textContent = message || "";
    node.style.color = isError ? "#fca5a5" : "#93c5fd";
  }

  function resolveMediaUrl(url) {
    const text = String(url || "").trim();
    if (!text) return "";
    if (text.startsWith("/uploads/")) return `${BACKEND_MEDIA_BASE}${text}`;
    return text;
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
