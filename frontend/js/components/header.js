(function () {
  function render() {
    const user = AuthStore.getUser();
    if (!user) return "";
    const title = _resolveTitle(window.location.hash || "#/workspace");
    const roleCls = user.role === "director" ? "bg-purple-500/15 text-purple-300" : "bg-blue-500/15 text-blue-300";
    return `
      <div class="h-14 bg-dark-800 border-b border-dark-500 flex items-center justify-between px-6">
        <h1 class="text-base font-semibold text-gray-100">${title}</h1>
        <div class="flex items-center gap-3">
          <span class="badge ${roleCls}">${_roleLabel(user.role)}</span>
          <span class="text-sm text-gray-400">${user.username}</span>
        </div>
      </div>`;
  }

  function mount() {}

  function _resolveTitle(hash) {
    if (hash.startsWith("#/workspace")) return "我的工作区";
    if (hash.endsWith("/script")) return "剧本工位";
    if (hash.endsWith("/storyboard")) return "分镜工位";
    if (hash.endsWith("/render")) return "生成队列";
    if (hash.endsWith("/review")) return "审核会话";
    if (hash.endsWith("/export")) return "导出中心";
    if (hash.startsWith("#/project/")) return "项目驾驶舱";
    return "协作平台";
  }

  function _roleLabel(role) {
    const map = { director: "导演", staff: "工作人员", writer: "编剧", reviewer: "审核" };
    return map[role] || role || "成员";
  }

  window.Header = { render, mount };
})();
