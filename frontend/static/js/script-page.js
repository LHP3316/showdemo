/**
 * Script workbench page
 */
(function () {
  let projectId = null;
  let currentUser = null;
  let importSubmitting = false;

  document.addEventListener("DOMContentLoaded", async function () {
    if (!window.CommonApp || !window.api) return;
    const ok = await CommonApp.ensureSession(true);
    if (!ok) return;

    projectId = await ensureProjectId();
    currentUser = safeJson(localStorage.getItem("user"));
    if (!currentUser) {
      try {
        const me = await api.get("/auth/me");
        currentUser = me;
        localStorage.setItem("user", JSON.stringify(me));
      } catch {
        // ignore
      }
    }
    bindActions();
    applyRoleUI();
    await loadData();
  });

  function bindActions() {
    bindAction("save", saveScript);
    bindAction("decompose", decomposeScript);
    bindAction("submit", submitReview);
    bindAction("import", importScriptFile);
  }

  function bindClick(selector, handler) {
    const node = document.querySelector(selector);
    if (!node) return;
    if (node.dataset.boundClick === "1") return;
    node.dataset.boundClick = "1";
    node.addEventListener("click", handler);
  }

  function bindAction(actionName, handler) {
    document.querySelectorAll(`[data-action='${actionName}']`).forEach((node) => {
      if (node.dataset.boundClick === "1") return;
      node.dataset.boundClick = "1";
      node.addEventListener("click", handler);
    });
  }

  async function ensureProjectId() {
    const fromQuery = new URLSearchParams(window.location.search).get("id");
    if (fromQuery) {
      localStorage.setItem("activeProjectId", fromQuery);
      return fromQuery;
    }
    const fromCache = localStorage.getItem("activeProjectId");
    if (fromCache) return fromCache;

    const res = await api.get("/projects?size=1");
    const first = res && res.data && res.data.items ? res.data.items[0] : null;
    if (first && first.id) {
      localStorage.setItem("activeProjectId", String(first.id));
      window.history.replaceState({}, "", `script.html?id=${first.id}`);
      return String(first.id);
    }
    return null;
  }

  async function loadData() {
    if (!projectId) {
      setStatus("No project available", true);
      return;
    }
    try {
      const res = await api.get(`/projects/${projectId}`);
      const p = (res && res.data) || {};
      const episode = p.current_episode || 1;
      const title = p.title || "未命名项目";

      setText("#script-page-title", "剧本工位");
      setText("#script-page-subtitle", `${title} · 第${episode}集`);
      setText("#script-project-name", title);
      setText("#script-project-episode", `第${episode}集`);
      const writer =
        (p.writer_name && String(p.writer_name).trim())
        || (p.creator && (p.creator.display_name || p.creator.username))
        || "未指定";
      setText("#script-project-writer", writer);
      setText("#script-project-stage", p.status_label || "草稿编辑中");

      const projectIntroNode = document.querySelector("#script-project-intro-input");
      if (projectIntroNode) {
        projectIntroNode.value = p.description || "";
      }

      const episodeTitleNode = document.querySelector("#script-title-input");
      if (episodeTitleNode) {
        episodeTitleNode.value = p.episode_title || "";
      }

      const episodeSummaryNode = document.querySelector("#script-episode-summary-input");
      if (episodeSummaryNode) {
        episodeSummaryNode.value = p.episode_summary || "";
      }

      const editor = document.querySelector("#script-editor");
      if (editor) editor.value = p.script || "";

      renderScenes(p.scenes || []);
      setStatus("Loaded");
    } catch (e) {
      setStatus(e.message || "Load failed", true);
    }
  }

  function renderScenes(scenes) {
    const list = document.querySelector("#script-scenes-list");
    if (!list) return;
    if (!scenes.length) {
      list.innerHTML = `
        <li class="script-version-item is-active">
          <span class="script-version-dot"></span>
          <span class="script-version-main">当前版本 v0.1</span>
          <span class="script-version-time">刚刚</span>
        </li>
      `;
      return;
    }
    list.innerHTML = scenes
      .slice(0, 8)
      .map(
        (s, index) => `
      <li class="script-version-item ${index === 0 ? "is-active" : ""}">
        <span class="script-version-dot"></span>
        <span class="script-version-main">Scene ${escapeHtml(String(s.scene_index || index + 1))} 版本</span>
        <span class="script-version-time">${index === 0 ? "刚刚" : `${index + 1}小时前`}</span>
      </li>
    `,
      )
      .join("");
  }

  async function saveScript() {
    if (!projectId) return;
    const editor = document.querySelector("#script-editor");
    const projectIntroNode = document.querySelector("#script-project-intro-input");
    const episodeTitleNode = document.querySelector("#script-title-input");
    const episodeSummaryNode = document.querySelector("#script-episode-summary-input");
    if (!editor) return;
    try {
      await api.put(`/projects/${projectId}`, {
        script: editor.value,
        description: projectIntroNode ? String(projectIntroNode.value || "").trim() : undefined,
        episode_title: episodeTitleNode ? String(episodeTitleNode.value || "").trim() : undefined,
        episode_summary: episodeSummaryNode ? String(episodeSummaryNode.value || "").trim() : undefined,
      });
      setStatus("Script saved");
      if (window.CommonApp && typeof CommonApp.showInfo === "function") {
        CommonApp.showInfo("草稿已保存");
      }
    } catch (e) {
      const msg = e.message || "Save failed";
      setStatus(msg, true);
      if (window.CommonApp && typeof CommonApp.showError === "function") CommonApp.showError(msg);
    }
  }

  async function decomposeScript() {
    if (!projectId) return;
    try {
      await api.post(`/projects/${projectId}/decompose`);
      setStatus("AI decompose completed");
      await loadData();
    } catch (e) {
      const msg = e.message || "Decompose failed";
      setStatus(msg, true);
      if (window.CommonApp && typeof CommonApp.showError === "function") CommonApp.showError(msg);
    }
  }

  async function submitReview() {
    if (!projectId) return;
    try {
      if (!(currentUser && currentUser.role === "staff")) {
        const msg = "提交审核需要由工作人员执行（请先分配工作人员，并用工作人员账号提交）。";
        setStatus(msg, true);
        if (window.CommonApp && typeof CommonApp.showInfo === "function") CommonApp.showInfo(msg, "提示");
        return;
      }
      await api.post(`/projects/${projectId}/submit-review`);
      setStatus("Submitted for review");
      await loadData();
    } catch (e) {
      const msg = e.message || "Submit failed";
      setStatus(msg, true);
      if (window.CommonApp && typeof CommonApp.showError === "function") CommonApp.showError(msg);
    }
  }

  function applyRoleUI() {
    const role = currentUser && currentUser.role ? currentUser.role : "";
    const canEditScript = role === "director" || role === "writer";
    const isStaff = role === "staff";

    // 编辑权限（导演/编剧可编辑；工作人员只读）
    ["#script-project-intro-input", "#script-title-input", "#script-episode-summary-input", "#script-editor"].forEach((sel) => {
      const node = document.querySelector(sel);
      if (!node) return;
      node.toggleAttribute("readonly", !canEditScript);
      node.toggleAttribute("disabled", !canEditScript);
    });
    document.querySelectorAll("[data-action='save'],[data-action='decompose'],[data-action='import']").forEach((btn) => {
      btn.toggleAttribute("hidden", !canEditScript);
      btn.disabled = !canEditScript;
      if (!canEditScript) btn.setAttribute("title", "仅导演/编剧可编辑剧本");
    });

    document.querySelectorAll("[data-action='submit']").forEach((btn) => {
      btn.toggleAttribute("hidden", !isStaff);
      btn.disabled = !isStaff;
      if (!isStaff) btn.setAttribute("title", "仅工作人员可提交审核");
    });
  }

  async function importScriptFile() {
    if (importSubmitting) return;
    const fileInput = document.getElementById("script-file-input");
    const editor = document.querySelector("#script-editor");
    if (!fileInput || !editor) return;

    importSubmitting = true;
    try {
      fileInput.value = "";
      fileInput.onchange = async function () {
        try {
          const file = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
          if (!file) return;
          const text = await file.text();
          editor.value = text || "";
          setStatus(`已导入：${file.name}`);
        } catch (e) {
          const msg = (e && e.message) ? `导入失败：${e.message}` : "导入失败";
          setStatus(msg, true);
          if (window.CommonApp && typeof CommonApp.showError === "function") CommonApp.showError(msg);
        }
      };
      fileInput.click();
    } finally {
      // 允许再次点击导入（真正读取在 onchange 里）
      importSubmitting = false;
    }
  }

  function setText(selector, text) {
    const node = document.querySelector(selector);
    if (node) node.textContent = text;
  }

  function setStatus(message, isError) {
    const node = document.querySelector("#script-status");
    if (!node) return;
    node.textContent = message;
    node.classList.toggle("error", !!isError);
  }

  function escapeHtml(text) {
    return String(text || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function safeJson(raw) {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
})();
