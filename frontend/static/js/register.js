/**
 * 工作人员注册（角色固定为 staff，由隐藏字段提交）
 */
(function () {
  const form = document.getElementById("registerForm");
  const usernameInput = document.getElementById("reg-username");
  const displayNameInput = document.getElementById("reg-display-name");
  const passwordInput = document.getElementById("reg-password");
  const password2Input = document.getElementById("reg-password2");
  const errorMessage = document.getElementById("errorMessage");
  const registerBtn = document.getElementById("registerBtn");
  const defaultBtnText = (registerBtn && registerBtn.textContent ? registerBtn.textContent.trim() : "") || "完成注册";

  if (!form || !usernameInput || !displayNameInput || !passwordInput || !password2Input || !registerBtn) {
    return;
  }

  form.addEventListener("submit", onSubmit);

  async function onSubmit(event) {
    event.preventDefault();

    const username = usernameInput.value.trim();
    const displayName = displayNameInput.value.trim();
    const password = passwordInput.value;
    const password2 = password2Input.value;

    if (!username || !displayName || !password || !password2) {
      showError("请填写账号、用户名与密码");
      return;
    }
    if (password !== password2) {
      showError("两次输入的密码不一致");
      return;
    }
    if (password.length < 6) {
      showError("密码至少 6 位");
      return;
    }

    hideError();
    setLoading(true);

    try {
      await api.post("/auth/register", {
        username,
        password,
        display_name: displayName,
        role: "staff",
      });
      window.location.href = "login.html?registered=1";
    } catch (err) {
      showError(err.message || "注册失败");
    } finally {
      setLoading(false);
    }
  }

  function setLoading(loading) {
    registerBtn.disabled = loading;
    registerBtn.textContent = loading ? "提交中…" : defaultBtnText;
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
