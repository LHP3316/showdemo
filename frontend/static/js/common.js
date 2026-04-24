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
    return pageName === "login.html" || pageName === "index.html";
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

  function bindClick(id, handler) {
    const node = document.querySelector(id);
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

  function applyUserToUI() {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "null");
      if (!user) return;
      const name = user.display_name || user.username || "User";
      document.querySelectorAll("#username, #welcomeName, [data-bind='username']").forEach((el) => {
        el.textContent = name;
      });
      const semanticTopUser = document.querySelector("#top-username");
      if (semanticTopUser) semanticTopUser.textContent = name;
      const topUser = document.querySelector("#2_49");
      if (topUser) topUser.textContent = name;
    } catch {
      // no-op
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
    const ok = await ensureSession(true);
    if (!ok) return;
    bindKnownHeaderActions();
    applyUserToUI();
  }

  window.CommonApp = {
    ROUTES,
    getActiveProjectId,
    routeTo,
    logout,
    clearSession,
    ensureSession,
    bootstrapProtectedPage,
  };

  window.logout = logout;

  document.addEventListener("DOMContentLoaded", function () {
    injectGlobalFooter();
    if (!isPublicPage()) {
      bootstrapProtectedPage();
    }
  });
})();
