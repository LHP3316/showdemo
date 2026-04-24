/**
 * Login page auth (vanilla JS)
 */
(function () {
  const form = document.getElementById("loginForm");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const errorMessage = document.getElementById("errorMessage");
  const loginBtn = document.getElementById("loginBtn");

  if (!form || !usernameInput || !passwordInput || !loginBtn) {
    return;
  }

  checkAuth();
  form.addEventListener("submit", onSubmit);

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
      showError("Please enter username and password");
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
      showError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  function setLoading(loading) {
    loginBtn.disabled = loading;
    loginBtn.textContent = loading ? "Signing in..." : "Login";
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

