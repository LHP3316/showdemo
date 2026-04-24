(function () {
  function render() {
    const hash = window.location.hash || "#/workspace";
    const title = _resolveTitle(hash);
    const subtitle = _resolveSubtitle(hash);
    
    if (!title) return "";
    
    return `
      <div class="page-header">
        <h1 class="page-title">${title}</h1>
        ${subtitle ? `<p class="page-subtitle">${subtitle}</p>` : ""}
      </div>
    `;
  }

  function mount() {}

  function _resolveTitle(hash) {
    if (hash.startsWith("#/workspace")) return "工作台";
    if (hash.endsWith("/script")) return "剧本工位";
    if (hash.endsWith("/storyboard")) return "分镜工位";
    if (hash.endsWith("/render")) return "生成队列";
    if (hash.endsWith("/review")) return "审核会话";
    if (hash.endsWith("/export")) return "导出中心";
    if (hash.startsWith("#/project/")) return "项目详情";
    return "";
  }

  function _resolveSubtitle(hash) {
    if (hash.startsWith("#/workspace")) return "查看你的任务与项目进度";
    if (hash.endsWith("/script")) return "编辑剧本内容并提交到分镜阶段";
    if (hash.endsWith("/storyboard")) return "编辑分镜、生成图片与视频";
    if (hash.endsWith("/render")) return "查看生成任务状态";
    if (hash.endsWith("/review")) return "审核项目内容并通过或驳回";
    if (hash.endsWith("/export")) return "导出最终成片与资产";
    if (hash.startsWith("#/project/")) return "查看项目进度与资产";
    return "";
  }

  window.Header = { render, mount };
})();
