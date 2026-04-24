/* ========================================
   任务卡片
   ======================================== */
(function () {
  function render(task) {
    return `
      <article class="bg-dark-800 border border-dark-500 rounded-xl p-4 card-hover">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h3 class="text-gray-100 font-semibold truncate">${_escape(task.title)}</h3>
            <p class="text-xs text-gray-500 mt-1">${task.next_action || "继续处理"}</p>
          </div>
          <span class="badge bg-blue-500/15 text-blue-300 text-xs">${TaskStore.labelStep(TaskStore.buildStep({ status: task.status }, []))}</span>
        </div>
        <div class="mt-3">
          <a href="#/project/${task.project_id}" class="text-sm text-blue-300 hover:text-blue-200">进入项目</a>
        </div>
      </article>
    `;
  }

  function _escape(text) {
    return String(text || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  window.TaskCard = { render };
})();
