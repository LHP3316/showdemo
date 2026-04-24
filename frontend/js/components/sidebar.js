(function () {
  function render() {
    const user = AuthStore.getUser();
    if (!user) return "";
    const current = window.location.hash || "#/workspace";
    const activeProjectId = App.getActiveProjectId();
    const canReview = ["director", "reviewer"].includes(user.role);

    const navItems = [
      { label: "工作台", hash: "#/workspace" },
    ];
    if (activeProjectId) {
      navItems.push({ label: "项目", hash: `#/project/${activeProjectId}` });
      navItems.push({ label: "剧本", hash: `#/project/${activeProjectId}/script` });
      navItems.push({ label: "分镜", hash: `#/project/${activeProjectId}/storyboard` });
      navItems.push({ label: "生成", hash: `#/project/${activeProjectId}/render` });
      if (canReview) navItems.push({ label: "审核", hash: `#/project/${activeProjectId}/review` });
      navItems.push({ label: "导出", hash: `#/project/${activeProjectId}/export` });
    }

    return `
      <div class="topnav">
        <div class="topnav-brand" onclick="window.location.hash='#/workspace'">
          <div class="topnav-logo">AI</div>
          <span>短剧协作台</span>
        </div>
        <div class="topnav-links">
          ${navItems.map(item => {
            const active = current === item.hash;
            return `<a href="${item.hash}" class="topnav-link ${active ? 'active' : ''}">${item.label}</a>`;
          }).join('')}
        </div>
        <div class="topnav-right">
          <div class="topnav-user" id="topnav-user-btn">
            <div class="topnav-avatar">${(user.username || 'U').charAt(0).toUpperCase()}</div>
            <div>
              <div class="topnav-username">${_escape(user.username)}</div>
              <div class="topnav-role">${_roleLabel(user.role)}</div>
            </div>
          </div>
          <button id="btn-logout" class="text-gray-400 hover:text-red-500 transition-colors" title="退出">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </div>
    `;
  }

  function mount() {
    const btn = document.getElementById("btn-logout");
    if (!btn) return;
    btn.addEventListener("click", () => {
      Modal.show({
        title: "退出登录",
        content: "确认退出当前账号？",
        type: "warning",
        onConfirm: () => {
          AuthStore.clearSession();
          window.location.hash = "#/login";
        },
      });
    });
  }

  function _roleLabel(role) {
    const map = { director: "导演", staff: "工作人员", writer: "编剧", reviewer: "审核" };
    return map[role] || role || "成员";
  }

  function _escape(text) {
    return String(text || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  }

  window.Sidebar = { render, mount };
})();
