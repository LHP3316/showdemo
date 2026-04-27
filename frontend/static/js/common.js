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
    review: "review-workbench.html",
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
    const needsProjectId = ["project", "script", "storyboard", "render", "export"].includes(routeName);
    window.location.href = needsProjectId ? withProjectId(base) : base;
  }

  async function openProjectPickerForRoute(routeName) {
    const targetRoute = routeName === "render" ? "render" : "project";
    let items = [];
    try {
      // size 最大 100（后端校验 le=100）
      const res = await api.get("/projects?size=100");
      const payload = res && res.data ? res.data : {};
      items = Array.isArray(payload.items) ? payload.items : [];
    } catch (e) {
      showInfoDialog("无法加载项目列表，请稍后重试。");
      return;
    }

    if (!items.length) {
      showInfoDialog("暂无项目，请先创建项目后再进入。");
      return;
    }

    renderProjectPickerModal(items, targetRoute);
  }

  function showInfoDialog(message) {
    // 尽量复用 CommonApp 的提示；没有则 alert
    if (window.CommonApp && typeof CommonApp.showInfo === "function") {
      CommonApp.showInfo(String(message || ""), "提示");
      return;
    }
    window.alert(String(message || ""));
  }

  function renderProjectPickerModal(projects, routeName) {
    const targetRoute = routeName === "render" ? "render" : "project";
    const routeLabel = targetRoute === "render" ? "生成队列" : "项目监控";
    const overlay = document.createElement("div");
    overlay.className = "static-project-picker";
    overlay.innerHTML = `
      <div class="static-project-picker__mask" data-role="mask"></div>
      <section class="static-project-picker__panel" role="dialog" aria-modal="true" aria-label="选择项目">
        <header class="static-project-picker__head">
          <h2 class="static-project-picker__title">选择要进入的${routeLabel}项目</h2>
          <button type="button" class="static-project-picker__close" data-role="close" aria-label="关闭">×</button>
        </header>
        <div class="static-project-picker__search">
          <input class="static-project-picker__input" type="text" placeholder="搜索项目名称..." data-role="search" />
        </div>
        <div class="static-project-picker__list" data-role="list"></div>
      </section>
    `;
    document.body.appendChild(overlay);

    const close = () => {
      try { document.body.removeChild(overlay); } catch {}
      document.removeEventListener("keydown", onKeyDown, true);
    };
    const onKeyDown = (e) => {
      if (e && e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown, true);

    overlay.querySelector("[data-role='mask']")?.addEventListener("click", close);
    overlay.querySelector("[data-role='close']")?.addEventListener("click", close);

    const listNode = overlay.querySelector("[data-role='list']");
    const input = overlay.querySelector("[data-role='search']");

    const normalized = (projects || []).map((p) => {
      const id = p && p.id != null ? String(p.id) : "";
      const title = p && p.title ? String(p.title) : `项目#${id}`;
      const status = p && p.status ? String(p.status) : "";
      return { id, title, status };
    }).filter((p) => p.id);

    const renderList = (q) => {
      const kw = String(q || "").trim().toLowerCase();
      const shown = kw
        ? normalized.filter((p) => p.title.toLowerCase().includes(kw) || p.id.includes(kw))
        : normalized;

      if (!listNode) return;
      if (!shown.length) {
        listNode.innerHTML = `<div class="static-project-picker__empty">未找到匹配项目</div>`;
        return;
      }

      listNode.innerHTML = shown.map((p) => {
        const badge = `<span class="static-project-picker__badge">${escapeHtml(mapProjectStatus(p.status))}</span>`;
        const rowClass = p.status === "review" ? "is-highlight" : "";
        return `
          <button type="button" class="static-project-picker__item ${rowClass}" data-project-id="${escapeAttr(p.id)}">
            <span class="static-project-picker__name">${escapeHtml(p.title)}</span>
            ${badge}
          </button>
        `;
      }).join("");

      listNode.querySelectorAll("[data-project-id]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const pid = btn.getAttribute("data-project-id");
          if (!pid) return;
          try { localStorage.setItem("activeProjectId", String(pid)); } catch {}
          close();
          const base = ROUTES[targetRoute] || ROUTES.project;
          window.location.href = `${base}?id=${encodeURIComponent(String(pid))}`;
        });
      });
    };

    renderList("");
    input?.addEventListener("input", () => renderList(input.value));

    ensureProjectPickerStyles();
  }

  function ensureProjectPickerStyles() {
    if (document.getElementById("static-project-picker-style")) return;
    const style = document.createElement("style");
    style.id = "static-project-picker-style";
    style.textContent = `
      .static-project-picker { position: fixed; inset: 0; z-index: 9999; display: grid; place-items: center; }
      .static-project-picker__mask { position: absolute; inset: 0; background: rgba(0,0,0,.6); backdrop-filter: blur(6px); }
      .static-project-picker__panel { position: relative; width: min(560px, calc(100vw - 28px)); background: rgba(18, 18, 24, 0.96); border: 1px solid rgba(255,255,255,.08); border-radius: 14px; box-shadow: 0 18px 60px rgba(0,0,0,.55); overflow: hidden; }
      .static-project-picker__head { display:flex; align-items:center; justify-content:space-between; gap: 10px; padding: 14px 14px 10px; border-bottom: 1px solid rgba(255,255,255,.06); }
      .static-project-picker__title { margin:0; font-size: 14px; font-weight: 800; color: #fff; }
      .static-project-picker__close { width: 32px; height: 32px; border-radius: 10px; border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.06); color:#fff; font-size: 18px; cursor: pointer; }
      .static-project-picker__search { padding: 10px 14px; }
      .static-project-picker__input { width: 100%; height: 38px; border-radius: 10px; border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.06); color:#fff; padding: 0 12px; outline: none; }
      .static-project-picker__list { padding: 0 14px 14px; display: grid; gap: 8px; max-height: 300px; overflow: auto; }
      .static-project-picker__item { display:flex; align-items:center; justify-content:space-between; gap: 10px; padding: 10px 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,.08); background: rgba(255,255,255,.04); color:#fff; cursor:pointer; text-align:left; }
      .static-project-picker__item:hover { border-color: rgba(255,255,255,.18); background: rgba(255,255,255,.06); }
      .static-project-picker__item.is-highlight { border-color: rgba(251, 191, 36, .35); background: rgba(251, 191, 36, .08); }
      .static-project-picker__name { font-size: 13px; font-weight: 700; color:#fff; overflow:hidden; text-overflow: ellipsis; white-space: nowrap; }
      .static-project-picker__badge { flex: 0 0 auto; font-size: 12px; font-weight: 800; padding: 3px 8px; border-radius: 999px; border: 1px solid rgba(148,163,184,.25); color: rgba(226,232,240,.95); background: rgba(15,23,42,.35); }
      .static-project-picker__badge.is-review { border-color: rgba(34,197,94,.35); color: rgba(134,239,172,.95); background: rgba(20,83,45,.28); }
      .static-project-picker__empty { padding: 18px 10px; color: rgba(148,163,184,.9); font-size: 13px; text-align:center; }
    `;
    document.head.appendChild(style);
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
    bindClick("#nav-project", () => openProjectPickerForRoute("project"));
    bindClick("#nav-render", () => openProjectPickerForRoute("render"));
    bindClick("#nav-review", () => routeTo("review"));
    bindClick("#btn-logout", () => logout());

    // Legacy pixso ids
    bindClick("#2_37", () => routeTo("workspace"));
    bindClick("#2_39", () => openProjectPickerForRoute("project"));
    bindClick("#2_41", () => openProjectPickerForRoute("render"));
    bindClick("#2_43", () => routeTo("review"));
    bindClick("#2_50", () => logout());
    bindClick("#2_180", () => routeTo("project"));
    bindClick("#2_189", () => routeTo("script"));
    bindClick("#2_195", () => routeTo("storyboard"));
    bindClick("#2_200", () => openProjectPickerForRoute("render"));
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
    if (!isDirector && (pageName === "review.html" || pageName === "review-workbench.html")) {
      routeTo("workspace");
    }
  }

  function mapProjectStatus(status) {
    const map = {
      draft: "草稿",
      processing: "制作中",
      review: "待审核",
      approved: "已通过",
      rejected: "已驳回",
    };
    return map[status] || (status || "-");
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
