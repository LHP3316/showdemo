/* ========================================
   认证状态
   ======================================== */
(function () {
  function getToken() {
    return localStorage.getItem("token");
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  }

  function saveSession(token, user) {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }

  window.AuthStore = {
    getToken,
    getUser,
    saveSession,
    clearSession,
  };
})();
