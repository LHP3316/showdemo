/**
 * Login page auth (vanilla JS)
 */
(function () {
  const form = document.getElementById("loginForm");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const errorMessage = document.getElementById("errorMessage");
  const loginBtn = document.getElementById("loginBtn");
  const defaultBtnText = (loginBtn && loginBtn.textContent ? loginBtn.textContent.trim() : "") || "Login";

  if (!form || !usernameInput || !passwordInput || !loginBtn) {
    return;
  }

  showRegisteredNotice();
  checkAuth();
  form.addEventListener("submit", onSubmit);

  function showRegisteredNotice() {
    const notice = document.getElementById("loginNotice");
    if (!notice) return;
    const q = new URLSearchParams(window.location.search).get("registered");
    if (q === "1") {
      notice.textContent = "注册成功，请使用新账号登录";
      notice.classList.add("show");
      notice.removeAttribute("hidden");
      try {
        window.history.replaceState({}, "", "login.html");
      } catch {
        // no-op
      }
    }
  }

  async function checkAuth() {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const me = await api.get("/auth/me");
      localStorage.setItem("user", JSON.stringify(me));
      window.location.href = "workspace.html";
    } catch {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
  }

  async function onSubmit(event) {
    event.preventDefault();

    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    if (!username || !password) {
      showError("请输入账号与密码");
      return;
    }

    hideError();
    setLoading(true);

    try {
      const data = await api.post("/auth/login", { username, password });
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));
      window.location.href = "workspace.html";
    } catch (err) {
      showError(err.message || "登录失败");
    } finally {
      setLoading(false);
    }
  }

  function setLoading(loading) {
    loginBtn.disabled = loading;
    loginBtn.textContent = loading ? "登录中..." : defaultBtnText;
  }

  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.add("show");
  }

  function hideError() {
    errorMessage.textContent = "";
    errorMessage.classList.remove("show");
  }
})();
