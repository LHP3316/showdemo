/* ========================================
   登录页
   ======================================== */
(function () {
  let isRegisterMode = false;

  function render() {
    return `
      <div class="flex items-center justify-center h-full login-bg fade-in">
        <div class="w-full max-w-sm">
          <div class="text-center mb-8">
            <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg mb-4">
              <span class="text-3xl">🎬</span>
            </div>
            <h1 class="text-2xl font-bold text-gray-100 tracking-wide">AI短剧协作台</h1>
            <p class="text-gray-500 text-sm mt-2">多角色协作 · 分步流转 · 审核交付</p>
          </div>

          <div class="bg-dark-800 rounded-xl border border-dark-500 p-8 shadow-2xl shadow-black/30">
            <h2 class="text-lg font-semibold text-gray-100 mb-6">${isRegisterMode ? "创建账号" : "欢迎回来"}</h2>
            <div id="login-error" class="hidden mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"></div>
            <form id="login-form" class="space-y-4">
              <div>
                <label class="block text-sm text-gray-400 mb-1.5">用户名</label>
                <input id="input-username" type="text" class="input-dark" placeholder="请输入用户名" autocomplete="username" />
              </div>
              <div>
                <label class="block text-sm text-gray-400 mb-1.5">密码</label>
                <input id="input-password" type="password" class="input-dark" placeholder="请输入密码" autocomplete="current-password" />
              </div>
              <div id="register-fields" class="${isRegisterMode ? "" : "hidden"} space-y-4">
                <div>
                  <label class="block text-sm text-gray-400 mb-1.5">角色</label>
                  <select id="input-role" class="select-dark w-full">
                    <option value="director">导演</option>
                    <option value="staff">工作人员</option>
                  </select>
                </div>
              </div>

              <button id="btn-submit" type="submit" class="w-full py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 mt-2">
                <span id="btn-text">${isRegisterMode ? "注 册" : "登 录"}</span>
                <span id="btn-loading" class="hidden inline-flex items-center gap-2">处理中...</span>
              </button>
            </form>
            <div class="mt-5 text-center">
              <button id="btn-toggle-mode" class="text-sm text-gray-500 hover:text-blue-400 transition-colors">
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
