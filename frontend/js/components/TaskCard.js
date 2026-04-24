/* ========================================
   任务卡片
   ======================================== */
(function () {
  function render(task) {
    return `
      <article class="card">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0 flex-1">
            <h3 class="text-gray-900 font-semibold text-base truncate">${_escape(task.title)}</h3>
            <p class="text-sm text-gray-500 mt-1">${task.next_action || "继续处理"}</p>
          </div>
          <span class="badge badge-blue">${TaskStore.labelStep(TaskStore.buildStep({ status: task.status }, []))}</span>
        </div>
        <div class="mt-4 pt-4 border-t border-gray-100">
          <a href="#/project/${task.project_id}" class="text-sm text-brand-600 hover:text-brand-700 font-medium">进入项目 →</a>
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
