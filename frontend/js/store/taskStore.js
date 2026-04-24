/* ========================================
   任务视图辅助
   ======================================== */
(function () {
  function buildStep(project, scenes) {
    if (!project) return "draft";
    if (project.status === "approved") return "approved";
    if (project.status === "review") return "in_review";
    if (project.status === "rejected") return "rejected";
    if (project.status === "processing") {
      const hasVideo = (scenes || []).some((s) => !!s.video_url);
      return hasVideo ? "render_in_progress" : "storyboard_in_progress";
    }
    return "draft";
  }

  function labelStep(step) {
    const map = {
      draft: "剧本阶段",
      storyboard_in_progress: "分镜阶段",
      render_in_progress: "生成阶段",
      in_review: "审核阶段",
      approved: "通过",
      rejected: "驳回",
    };
    return map[step] || step;
  }

  window.TaskStore = {
    buildStep,
    labelStep,
  };
})();
