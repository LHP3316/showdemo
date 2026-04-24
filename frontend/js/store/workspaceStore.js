/* ========================================
   工作区数据
   ======================================== */
(function () {
  async function loadMyProjects() {
    try {
      return await API.get("/projects/");
    } catch {
      return [];
    }
  }

  async function loadMyTasks() {
    const projects = await loadMyProjects();
    const tasks = [];
    for (const p of projects) {
      tasks.push({
        id: `project-${p.id}`,
        project_id: p.id,
        title: p.title,
        status: p.status,
        next_action: _nextAction(p.status),
        updated_at: p.created_at,
      });
    }
    return tasks;
  }

  function _nextAction(status) {
    const map = {
      draft: "完善剧本并提交",
      processing: "进入分镜与生成",
      review: "等待审核结论",
      approved: "进入导出",
      rejected: "根据意见修改",
    };
    return map[status] || "继续处理";
  }

  window.WorkspaceStore = {
    loadMyProjects,
    loadMyTasks,
  };
})();
