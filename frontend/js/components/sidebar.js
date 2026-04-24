(function () {
  function render() {
    const user = AuthStore.getUser();
    if (!user) return "";
    const current = window.location.hash || "#/workspace";
    const activeProjectId = App.getActiveProjectId();
    const canReview = ["director", "reviewer"].includes(user.role);

    const baseItems = [{ label: "我的工作区", icon: "🏠", hash: "#/workspace" }];
    const projectItems = activeProjectId
      ? [
          { label: "项目驾驶舱", icon: "🧭", hash: `#/project/${activeProjectId}` },
          { label: "剧本工位", icon: "📝", hash: `#/project/${activeProjectId}/script` },
          { label: "分镜工位", icon: "🎬", hash: `#/project/${activeProjectId}/storyboard` },
          { label: "生成队列", icon: "⚙️", hash: `#/project/${activeProjectId}/render` },
          ...(canReview ? [{ label: "审核会话", icon: "✅", hash: `#/project/${activeProjectId}/review` }] : []),
          { label: "导出中心", icon: "📦", hash: `#/project/${activeProjectId}/export` },
        ]
      : [];
    const items = [...baseItems, ...projectItems];

    return `
      <div class="w-60 h-full bg-dark-700 border-r border-dark-500 flex flex-col">
        <div class="px-5 py-5 border-b border-dark-500">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">AI</div>
            <div>
              <div class="text-gray-100 font-bold text-sm">短剧协作台</div>
              <div class="text-gray-500 text-xs">Workflow Studio</div>
            </div>
          </div>
        </div>
        <nav class="flex-1 p-2 space-y-1 overflow-auto">
          ${items
            .map((item) => {
              const active = current === item.hash;
              return `
                <a href="${item.hash}" class="nav-item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
                  active ? "active text-blue-300" : "text-gray-400 hover:text-gray-200"
                }">
                  <span>${item.icon}</span>
                  <span>${item.label}</span>
                </a>
              `;
            })
            .join("")}
        </nav>
        <div class="border-t border-dark-500 px-4 py-3">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white text-xs flex items-center justify-center font-bold">
              ${(user.username || "U").charAt(0).toUpperCase()}
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm text-gray-200 truncate">${user.username}</div>
              <div class="text-xs text-gray-500">${_roleLabel(user.role)}</div>
            </div>
            <button id="btn-logout" class="text-gray-500 hover:text-red-400 p-1" title="退出">⎋</button>
          </div>
        </div>
      </div>`;
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

  window.Sidebar = { render, mount };
})();
