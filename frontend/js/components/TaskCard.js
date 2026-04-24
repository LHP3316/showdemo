/* ========================================
   任务卡片
   ======================================== */
(function () {
  function render(task) {
    return `
      <article class="card">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0 flex-1">
            <h3 class="text-white font-bold text-lg truncate">${_escape(task.title)}</h3>
            <p class="text-sm text-gray-400 mt-2">${task.next_action || "继续处理"}</p>
          </div>
          <span class="badge badge-blue">${TaskStore.labelStep(TaskStore.buildStep({ status: task.status }, []))}</span>
        </div>
        <div class="mt-4 pt-4 border-t border-white/10">
          <a href="#/project/${task.project_id}" class="text-sm text-gold-400 hover:text-gold-500 font-semibold transition-colors">进入项目 →</a>
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
