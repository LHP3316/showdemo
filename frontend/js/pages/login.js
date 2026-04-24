/* ========================================
   登录页
   ======================================== */
(function () {
  let isRegisterMode = false;

  function render() {
    return `
      <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-cinema-900 via-cinema-800 to-cinema-900 fade-in" style="position: relative; overflow: hidden;">
        <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: radial-gradient(circle at 20% 50%, rgba(255,215,0,0.08) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255,140,0,0.06) 0%, transparent 50%);"></div>
        <div class="w-full max-w-md px-6 relative z-10">
          <div class="text-center mb-8">
            <div class="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-gold-400 to-gold-600 shadow-2xl mb-6 glow-pulse">
              <span class="text-cinema-900 text-3xl font-black">AI</span>
            </div>
            <h1 class="text-4xl font-black text-white tracking-wide">短剧协作台</h1>
            <p class="text-gray-400 mt-3 text-sm">AI驱动的电影级创作协作平台</p>
          </div>

          <div class="card">
            <h2 class="text-2xl font-bold text-white mb-6">${isRegisterMode ? "创建账号" : "欢迎回来"}</h2>
            <div id="login-error" class="hidden mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm"></div>
            <form id="login-form" class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-2">用户名</label>
                <input id="input-username" type="text" class="input-field" placeholder="请输入用户名" autocomplete="username" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-2">密码</label>
                <input id="input-password" type="password" class="input-field" placeholder="请输入密码" autocomplete="current-password" />
              </div>
              <div id="register-fields" class="${isRegisterMode ? "" : "hidden"} space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-300 mb-2">角色</label>
                  <select id="input-role" class="select-field w-full">
                    <option value="director">导演</option>
                    <option value="staff">工作人员</option>
                  </select>
                </div>
              </div>

              <button id="btn-submit" type="submit" class="w-full py-3 rounded-lg text-sm font-bold text-cinema-900 bg-gradient-to-r from-gold-400 to-gold-600 hover:from-gold-500 hover:to-gold-700 mt-2 transition-all shadow-lg hover:shadow-xl">
                <span id="btn-text">${isRegisterMode ? "注 册" : "登 录"}</span>
                <span id="btn-loading" class="hidden inline-flex items-center gap-2">处理中...</span>
              </button>
            </form>
            <div class="mt-6 text-center">
              <button id="btn-toggle-mode" class="text-sm text-gray-400 hover:text-gold-400 transition-colors">
                ${isRegisterMode ? "已有账号？返回登录" : "没有账号？立即注册"}
              </button>
            </div>
          </div>
        </div>
      </div>`;
  }

  function mount() {
    const form = document.getElementById("login-form");
    const toggleBtn = document.getElementById("btn-toggle-mode");
    if (form) form.addEventListener("submit", async (e) => { e.preventDefault(); await _handleSubmit(); });
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        isRegisterMode = !isRegisterMode;
        const main = document.getElementById("main-content");
        if (main) {
          main.innerHTML = render();
          mount();
        }
      });
    }
    const input = document.getElementById("input-username");
    if (input) input.focus();
  }

  async function _handleSubmit() {
    const username = document.getElementById("input-username").value.trim();
    const password = document.getElementById("input-password").value.trim();
    const errorEl = document.getElementById("login-error");
    const btnText = document.getElementById("btn-text");
    const btnLoading = document.getElementById("btn-loading");
    const submitBtn = document.getElementById("btn-submit");

    errorEl.classList.add("hidden");
    if (!username) return _showError("请输入用户名");
    if (!password) return _showError("请输入密码");
    if (password.length < 4) return _showError("密码至少4位");

    btnText.classList.add("hidden");
    btnLoading.classList.remove("hidden");
    submitBtn.disabled = true;

    try {
      if (isRegisterMode) {
        const role = document.getElementById("input-role").value;
        await API.post("/auth/register", { username, password, role });
        App.showToast("注册成功，正在登录...", "success");
      }
      const data = await API.post("/auth/login", { username, password });
      AuthStore.saveSession(data.access_token, data.user || { username, role: "staff" });
      App.showToast("登录成功", "success");
      setTimeout(() => { window.location.hash = "#/workspace"; }, 200);
    } catch (err) {
      _showError(err.message || "登录失败");
    } finally {
      btnText.classList.remove("hidden");
      btnLoading.classList.add("hidden");
      submitBtn.disabled = false;
    }
  }

  function _showError(msg) {
    const errorEl = document.getElementById("login-error");
    if (!errorEl) return;
    errorEl.textContent = msg;
    errorEl.classList.remove("hidden");
  }

  window.LoginPage = { render, mount };
})();
