(function () {
  const routes = [
    { pattern: "#/login", page: () => window.LoginPage, auth: false },
    { pattern: "#/workspace", page: () => window.WorkspacePage, auth: true },
    { pattern: "#/project/:id", page: () => window.ProjectCockpitPage, auth: true },
    { pattern: "#/project/:id/script", page: () => window.ScriptWorkbenchPage, auth: true },
    { pattern: "#/project/:id/storyboard", page: () => window.StoryboardWorkbenchPage, auth: true },
    { pattern: "#/project/:id/render", page: () => window.RenderQueuePage, auth: true },
    { pattern: "#/project/:id/review", page: () => window.ReviewSessionPage, auth: true, roles: ["director", "reviewer"] },
    { pattern: "#/project/:id/export", page: () => window.ExportCenterPage, auth: true },
  ];

  function isLoggedIn() { return !!localStorage.getItem("token"); }

  function getCurrentUser() {
    try { return JSON.parse(localStorage.getItem("user") || "null"); } catch { return null; }
  }

  function _ensureToastContainer() {
    let c = document.getElementById("toast-container");
    if (!c) {
      c = document.createElement("div");
      c.id = "toast-container";
      c.className = "toast-container";
      document.body.appendChild(c);
    }
    return c;
  }

  function showToast(message, type = "info", duration = 3000) {
    const c = _ensureToastContainer();
    const t = document.createElement("div");
    t.className = `toast-item toast-${type}`;
    t.textContent = message;
    c.appendChild(t);
    setTimeout(() => {
      t.classList.add("toast-out");
      setTimeout(() => t.remove(), 250);
    }, duration);
  }

  function setActiveProjectId(projectId) {
    if (!projectId || projectId === "new") localStorage.removeItem("activeProjectId");
    else localStorage.setItem("activeProjectId", String(projectId));
  }

  function getActiveProjectId() { return localStorage.getItem("activeProjectId"); }

  function navigate(hash) { window.location.hash = hash; }

  function _segmentMatch(pattern, actual) {
    const p = pattern.replace(/^#/, "").split("/").filter(Boolean);
    const a = actual.replace(/^#/, "").split("?")[0].split("/").filter(Boolean);
    if (p.length !== a.length) return null;
    const params = {};
    for (let i = 0; i < p.length; i += 1) {
      if (p[i].startsWith(":")) params[p[i].slice(1)] = a[i];
      else if (p[i] !== a[i]) return null;
    }
    return params;
  }

  function _matchRoute(hash) {
    for (const route of routes) {
      const params = _segmentMatch(route.pattern, hash);
      if (params) return { route, params };
    }
    return null;
  }

  function _renderLayout() {
    const sidebar = document.getElementById("sidebar");
    const header = document.getElementById("header");
    if (!isLoggedIn()) {
      sidebar.innerHTML = "";
      header.innerHTML = "";
      return;
    }
    sidebar.innerHTML = Sidebar.render();
    Sidebar.mount();
    header.innerHTML = Header.render();
    Header.mount();
  }

  function _guardRoute(matched) {
    if (!matched) return true;
    const { route } = matched;
    if (route.auth && !isLoggedIn()) {
      navigate("#/login");
      return false;
    }
    if (!route.auth && isLoggedIn() && window.location.hash === "#/login") {
      navigate("#/workspace");
      return false;
    }
    if (route.roles && route.roles.length) {
      const user = getCurrentUser();
      if (!user || !route.roles.includes(user.role)) {
        showToast("当前账号无权限访问该页面", "warning");
        navigate("#/workspace");
        return false;
      }
    }
    return true;
  }

  function _renderNotFound(hash) {
    document.getElementById("main-content").innerHTML = `
      <div class="h-full flex items-center justify-center">
        <div class="text-center">
          <div class="text-5xl opacity-30 mb-2">404</div>
          <p class="text-gray-400">页面不存在：${hash}</p>
        </div>
      </div>`;
  }

  function _handleRoute() {
    let hash = window.location.hash || "";
    if (!hash || hash === "#/" || hash === "#") hash = isLoggedIn() ? "#/workspace" : "#/login";
    if (window.location.hash !== hash) {
      window.location.hash = hash;
      return;
    }
    const matched = _matchRoute(hash);
    if (!_guardRoute(matched)) return;
    _renderLayout();
    if (!matched) {
      _renderNotFound(hash);
      return;
    }
    const { route, params } = matched;
    if (params.id && params.id !== "new") setActiveProjectId(params.id);
    const page = route.page();
    const main = document.getElementById("main-content");
    if (!page || typeof page.render !== "function") {
      _renderNotFound(hash);
      return;
    }
    main.innerHTML = page.render(params || {});
    if (typeof page.mount === "function") page.mount(params || {});
  }

  function init() {
    window.addEventListener("hashchange", _handleRoute);
    _handleRoute();
  }

  window.App = {
    navigate,
    refresh: _handleRoute,
    isLoggedIn,
    getCurrentUser,
    showToast,
    setActiveProjectId,
    getActiveProjectId,
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
