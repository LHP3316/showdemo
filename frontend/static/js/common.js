/**
 * Static common runtime (vanilla JS)
 */
(function () {
  const LOGIN_PAGE = "login.html";
  const HOME_PAGE = "workspace.html";
  const pageName = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();

  const ROUTES = {
    workspace: "workspace.html",
    project: "project.html",
    script: "script.html",
    storyboard: "storyboard.html",
    render: "render.html",
    review: "review.html",
    export: "export.html",
  };

  function isPublicPage() {
    return pageName === "login.html" || pageName === "register.html" || pageName === "index.html";
  }

  function getActiveProjectId() {
    const searchId = new URLSearchParams(window.location.search).get("id");
    if (searchId) {
      localStorage.setItem("activeProjectId", String(searchId));
      return String(searchId);
    }
    return localStorage.getItem("activeProjectId");
  }

  function withProjectId(url) {
    const projectId = getActiveProjectId();
    return projectId ? `${url}?id=${encodeURIComponent(projectId)}` : url;
  }

  function routeTo(routeName) {
    const base = ROUTES[routeName] || HOME_PAGE;
    const needsProjectId = ["project", "script", "storyboard", "render", "review", "export"].includes(routeName);
    window.location.href = needsProjectId ? withProjectId(base) : base;
  }

  function clearSession() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }

  function logout() {
    clearSession();
    window.location.href = LOGIN_PAGE;
  }

  async function ensureSession(redirectWhenInvalid = true) {
    const token = localStorage.getItem("token");
    if (!token) {
      if (redirectWhenInvalid) window.location.href = LOGIN_PAGE;
      return false;
    }

    try {
      const me = await api.get("/auth/me");
      localStorage.setItem("user", JSON.stringify(me));
      return true;
    } catch {
      clearSession();
      if (redirectWhenInvalid) window.location.href = LOGIN_PAGE;
      return false;
    }
  }

  function isDebugEnabled() {
    try {
      return localStorage.getItem("debug") === "1";
    } catch {
      return false;
    }
  }

  function debugLog(...args) {
    if (!isDebugEnabled()) return;
    // eslint-disable-next-line no-console
    console.log("[static]", ...args);
  }

  function safeGetNode(selector) {
    if (!selector) return null;
    // 兼容 Pixso 导出的 id（如 2_37）在 querySelector 里可能触发语法错误
    if (selector[0] === "#") {
      const id = selector.slice(1);
      const byId = document.getElementById(id);
      if (byId) return byId;
      // 若 DOM 中不存在该 id，则不要用未转义的 querySelector（会抛错并触发 DevTools 暂停）
      // 使用 CSS.escape（若存在）安全查询；否则仅在安全字符集时尝试查询
      try {
        const esc = (window.CSS && typeof window.CSS.escape === "function")
          ? window.CSS.escape(id)
          : id.replace(/[^a-zA-Z0-9_-]/g, "\\$&").replace(/^(\d)/, "\\3$1 ");
        return document.querySelector(`#${esc}`);
      } catch (e) {
        debugLog("safeGetNode: escaped querySelector failed", selector, e && e.message ? e.message : e);
        return null;
      }
    }
    try {
      return document.querySelector(selector);
    } catch (e) {
      debugLog("querySelector failed", selector, e && e.message ? e.message : e);
      return null;
    }
  }

  function bindClick(id, handler) {
    const node = safeGetNode(id);
    if (!node) return;
    node.style.cursor = "pointer";
    node.addEventListener("click", handler);
  }

  function bindKnownHeaderActions() {
    // New semantic layout ids
    bindClick("#nav-workspace", () => routeTo("workspace"));
    bindClick("#nav-project", () => routeTo("project"));
    bindClick("#nav-render", () => routeTo("render"));
    bindClick("#nav-review", () => routeTo("review"));
    bindClick("#btn-logout", () => logout());

    // Legacy pixso ids
    bindClick("#2_37", () => routeTo("workspace"));
    bindClick("#2_39", () => routeTo("project"));
    bindClick("#2_41", () => routeTo("render"));
    bindClick("#2_43", () => routeTo("review"));
    bindClick("#2_50", () => logout());
    bindClick("#2_180", () => routeTo("project"));
    bindClick("#2_189", () => routeTo("script"));
    bindClick("#2_195", () => routeTo("storyboard"));
    bindClick("#2_200", () => routeTo("render"));
    bindClick("#2_205", () => routeTo("review"));
    bindClick("#2_210", () => routeTo("export"));
  }

  function injectCommonHeaderStyles() {
    if (document.getElementById("static-common-header-style")) return;
    const link = document.createElement("link");
    link.id = "static-common-header-style";
    link.rel = "stylesheet";
    link.href = "css/common-header.css";
    document.head.appendChild(link);
  }

  function injectCommonHeader() {
    if (document.getElementById("static-common-header")) return;
    if (isPublicPage()) return;
    const header = document.createElement("header");
    header.id = "static-common-header";
    header.className = "static-common-header";
    header.innerHTML = `
      <div class="static-common-header__inner">
        <div class="static-common-brand">
          <span class="static-common-brand__badge">AI</span>
          <span class="static-common-brand__name">AI短剧协作台</span>
        </div>
        <nav class="static-common-nav" aria-label="主导航">
          <button id="nav-workspace" class="static-common-nav__btn" type="button">工作台</button>
          <button id="nav-project" class="static-common-nav__btn" type="button">项目管理</button>
          <button id="nav-render" class="static-common-nav__btn" type="button">生成队列</button>
          <button id="nav-review" class="static-common-nav__btn" type="button">审核中心</button>
        </nav>
        <div class="static-common-right">
          <span id="top-avatar" class="static-common-avatar">U</span>
          <span id="top-username" class="static-common-username">User</span>
          <button id="btn-logout" class="static-common-logout" type="button">退出</button>
        </div>
      </div>
    `;
    document.body.insertBefore(header, document.body.firstChild);
  }

  function getCurrentRouteName() {
    const current = pageName.replace(".html", "");
    const routeMap = {
      workspace: "workspace",
      project: "project",
      render: "render",
      review: "review",
      script: "project",
      storyboard: "project",
      export: "render",
    };
    return routeMap[current] || "workspace";
  }

  function setActiveNav() {
    const active = getCurrentRouteName();
    const mapping = {
      workspace: "#nav-workspace",
      project: "#nav-project",
      render: "#nav-render",
      review: "#nav-review",
    };
    Object.values(mapping).forEach((selector) => {
      document.querySelectorAll(selector).forEach((node) => {
        node.classList.remove("active");
        node.removeAttribute("aria-current");
      });
    });
    const activeSelector = mapping[active];
    if (!activeSelector) return;
    document.querySelectorAll(activeSelector).forEach((node) => {
      node.classList.add("active");
      node.setAttribute("aria-current", "page");
    });
  }

  function applyUserToUI() {
    try {
      const user = safeReadUser();
      if (!user) {
        debugLog("applyUserToUI: no user in storage yet");
        return;
      }
      const name = user.display_name || user.username || "User";
      debugLog("applyUserToUI:", { username: user.username, display_name: user.display_name, role: user.role });
      document.querySelectorAll("#username, #welcomeName, [data-bind='username']").forEach((el) => {
        el.textContent = name;
      });
      // 兼容工作台欢迎语（workspace.html）
      const workspaceWelcome = document.querySelector("#workspace-welcome");
      if (workspaceWelcome) workspaceWelcome.textContent = `欢迎回来，${name}`;
      const semanticTopUser = document.querySelector("#top-username");
      if (semanticTopUser) semanticTopUser.textContent = name;
      const topAvatar = document.querySelector("#top-avatar");
      if (topAvatar) topAvatar.textContent = String(name).trim().charAt(0) || "U";
      const topUser = safeGetNode("#2_49");
      if (topUser) topUser.textContent = name;

      applyRoleToNav(user);
    } catch {
      // no-op
    }
  }

  function safeReadUser() {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch {
        debugLog("safeReadUser: invalid JSON in localStorage.user, clearing");
        // 修复异常写入（例如误写成 [object Object] 或其它非JSON字符串）
        localStorage.removeItem("user");
        // 尝试立即拉一次 /auth/me 兜底（异步不阻塞 UI）
        try {
          api.get("/auth/me").then((me) => {
            localStorage.setItem("user", JSON.stringify(me));
            // 再刷一次 UI
            setTimeout(applyUserToUI, 0);
          }).catch(() => {});
        } catch {
          // ignore
        }
        return null;
      }
    }
    return null;
  }

  function applyRoleToNav(user) {
    const role = (user && user.role) ? String(user.role) : "";
    const isDirector = role === "director";

    const navReview = document.querySelector("#nav-review");
    if (navReview) {
      navReview.toggleAttribute("hidden", !isDirector);
    }

    const navProject = document.querySelector("#nav-project");
    if (navProject) {
      navProject.textContent = isDirector ? "项目监控" : "我的作品";
    }

    // 基础权限守卫：工作人员不允许进入审核中心页
    if (!isDirector && pageName === "review.html") {
      routeTo("workspace");
    }
  }

  function injectGlobalFooter() {
    if (document.getElementById("static-global-footer")) return;
    const footer = document.createElement("footer");
    footer.id = "static-global-footer";
    footer.className = "static-global-footer";
    footer.innerHTML = "<span>AI Studio Platform - v2.1</span>";
    document.body.appendChild(footer);
  }

  async function bootstrapProtectedPage() {
    injectCommonHeaderStyles();
    injectCommonHeader();
    setActiveNav();
    const ok = await ensureSession(true);
    if (!ok) return;
    bindKnownHeaderActions();
    setActiveNav();
    applyUserToUI();
  }

  let _assignModalNode = null;
  let _globalDialogNode = null;

  function showDialog(payload) {
    const title = (payload && payload.title) ? String(payload.title) : "提示";
    const message = (payload && payload.message) ? String(payload.message) : "";
    const tone = (payload && payload.tone) ? String(payload.tone) : "info";

    mountGlobalDialog();
    if (!_globalDialogNode) return;
    const titleNode = _globalDialogNode.querySelector("#global-dialog-title");
    const messageNode = _globalDialogNode.querySelector("#global-dialog-message");
    const panel = _globalDialogNode.querySelector(".global-dialog");
    if (titleNode) titleNode.textContent = title;
    if (messageNode) messageNode.textContent = message;
    if (panel) panel.setAttribute("data-tone", tone);
  }

  function showError(message, title = "操作失败") {
    showDialog({ title, message, tone: "error" });
  }

  function showInfo(message, title = "提示") {
    showDialog({ title, message, tone: "info" });
  }

  function mountGlobalDialog() {
    if (_globalDialogNode && document.body.contains(_globalDialogNode)) return;
    const overlay = document.createElement("div");
    overlay.className = "global-dialog-overlay";
    overlay.id = "global-dialog-overlay";
    overlay.innerHTML = `
      <section class="global-dialog" role="dialog" aria-modal="true" aria-labelledby="global-dialog-title" data-tone="info">
        <header class="global-dialog__head">
          <h2 class="global-dialog__title" id="global-dialog-title">提示</h2>
          <button type="button" class="global-dialog__close" id="global-dialog-close">关闭</button>
        </header>
        <div class="global-dialog__body">
          <p class="global-dialog__message" id="global-dialog-message"></p>
        </div>
        <footer class="global-dialog__foot">
          <button type="button" class="global-dialog__btn global-dialog__btn--primary" id="global-dialog-ok">我知道了</button>
        </footer>
      </section>
    `;
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeGlobalDialog();
    });
    document.addEventListener("keydown", onGlobalDialogKeydown);
    document.body.appendChild(overlay);
    _globalDialogNode = overlay;
    overlay.querySelector("#global-dialog-close")?.addEventListener("click", closeGlobalDialog);
    overlay.querySelector("#global-dialog-ok")?.addEventListener("click", closeGlobalDialog);
  }

  function onGlobalDialogKeydown(e) {
    if (!_globalDialogNode || !document.body.contains(_globalDialogNode)) return;
    if (e.key === "Escape") closeGlobalDialog();
  }

  function closeGlobalDialog() {
    if (!_globalDialogNode) return;
    if (_globalDialogNode.parentNode) _globalDialogNode.parentNode.removeChild(_globalDialogNode);
    _globalDialogNode = null;
    document.removeEventListener("keydown", onGlobalDialogKeydown);
  }

  async function openAssignModal(options) {
    const projectId = options && options.projectId ? String(options.projectId) : "";
    if (!projectId) return;

    const current = safeJson(localStorage.getItem("user"));
    if (!current || current.role !== "director") return;

    let users = [];
    try {
      users = await api.get("/auth/users");
    } catch (e) {
      showError((e && e.message) ? e.message : "无法获取工作人员列表");
      return;
    }

    const staffUsers = (Array.isArray(users) ? users : []).filter((u) => u && u.role === "staff");
    if (!staffUsers.length) {
      showInfo("暂无可分配的工作人员账号");
      return;
    }

    mountAssignModal();
    patchAssignModal({ projectId, staffUsers, onAssigned: options && options.onAssigned });
  }

  function mountAssignModal() {
    if (_assignModalNode && document.body.contains(_assignModalNode)) return;
    const overlay = document.createElement("div");
    overlay.className = "assign-modal-overlay";
    overlay.id = "assign-modal-overlay";
    overlay.innerHTML = `
      <section class="assign-modal" role="dialog" aria-modal="true" aria-labelledby="assign-modal-title">
        <header class="assign-modal__head">
          <div>
            <h2 class="assign-modal__title" id="assign-modal-title">分配给工作人员</h2>
            <p class="assign-modal__sub" id="assign-modal-sub">请选择项目的执行人员</p>
          </div>
          <button type="button" class="assign-modal__close" id="assign-modal-close">关闭</button>
        </header>
        <div class="assign-modal__body">
          <label class="assign-modal__label" for="assign-modal-select">工作人员</label>
          <select class="assign-modal__select" id="assign-modal-select"></select>
          <p class="assign-modal__hint" id="assign-modal-hint">分配后，该工作人员将能在“我的作品”中看到该项目。</p>
        </div>
        <footer class="assign-modal__foot">
          <button type="button" class="assign-modal__btn" id="assign-modal-cancel">取消</button>
          <button type="button" class="assign-modal__btn assign-modal__btn--primary" id="assign-modal-confirm">确认分配</button>
        </footer>
      </section>
    `;

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeAssignModal();
    });
    document.addEventListener("keydown", onAssignModalKeydown);

    document.body.appendChild(overlay);
    _assignModalNode = overlay;

    overlay.querySelector("#assign-modal-close")?.addEventListener("click", closeAssignModal);
    overlay.querySelector("#assign-modal-cancel")?.addEventListener("click", closeAssignModal);
  }

  function onAssignModalKeydown(e) {
    if (!_assignModalNode || !document.body.contains(_assignModalNode)) return;
    if (e.key === "Escape") closeAssignModal();
  }

  function closeAssignModal() {
    if (!_assignModalNode) return;
    if (_assignModalNode.parentNode) _assignModalNode.parentNode.removeChild(_assignModalNode);
    _assignModalNode = null;
    document.removeEventListener("keydown", onAssignModalKeydown);
  }

  function patchAssignModal(payload) {
    if (!_assignModalNode) return;
    const { projectId, staffUsers, onAssigned } = payload || {};
    const select = _assignModalNode.querySelector("#assign-modal-select");
    const confirmBtn = _assignModalNode.querySelector("#assign-modal-confirm");
    const sub = _assignModalNode.querySelector("#assign-modal-sub");
    if (sub) sub.textContent = `项目 ID：${projectId} · 请选择执行人员`;
    if (!select || !confirmBtn) return;

    select.innerHTML = staffUsers.map((u) => {
      const name = u.display_name || u.username || `staff#${u.id}`;
      return `<option value="${escapeAttr(String(u.id))}">${escapeHtml(name)}（ID ${escapeHtml(String(u.id))}）</option>`;
    }).join("");

    confirmBtn.disabled = false;
    confirmBtn.textContent = "确认分配";

    confirmBtn.onclick = async function () {
      const staffId = Number(select.value);
      if (!Number.isInteger(staffId) || staffId <= 0) return;
      confirmBtn.disabled = true;
      confirmBtn.textContent = "提交中…";
      try {
        await api.put(`/projects/${projectId}/assign?assigned_to=${staffId}`, {});
        closeAssignModal();
        if (typeof onAssigned === "function") onAssigned({ projectId, staffId });
      } catch (e) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = "确认分配";
        showError((e && e.message) ? e.message : "分配失败");
      }
    };

    // focus
    setTimeout(() => {
      try { select.focus(); } catch { /* no-op */ }
    }, 0);
  }

  function safeJson(raw) {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function escapeHtml(text) {
    return String(text || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function escapeAttr(text) {
    return escapeHtml(text).replaceAll("\"", "&quot;");
  }

  window.CommonApp = {
    ROUTES,
    getActiveProjectId,
    routeTo,
    logout,
    clearSession,
    ensureSession,
    bootstrapProtectedPage,
    openAssignModal,
    showError,
    showInfo,
  };

  window.logout = logout;

  document.addEventListener("DOMContentLoaded", function () {
    injectGlobalFooter();
    if (!isPublicPage()) {
      bootstrapProtectedPage();
    }
  });
})();
