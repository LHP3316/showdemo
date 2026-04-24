/* ========================================
   项目与分镜数据
   ======================================== */
(function () {
  async function getProject(projectId) {
    return API.get(`/projects/${projectId}`);
  }

  async function updateProject(projectId, payload) {
    return API.put(`/projects/${projectId}`, payload);
  }

  async function listScenes(projectId) {
    return API.get(`/api/scenes/?project_id=${projectId}`);
  }

  async function updateScene(sceneId, payload) {
    return API.put(`/api/scenes/${sceneId}`, payload);
  }

  async function createScene(payload) {
    return API.post("/api/scenes/", payload);
  }

  async function generateImage(sceneId) {
    return API.post(`/api/scenes/${sceneId}/generate-image`);
  }

  async function generateVideo(sceneId) {
    return API.post(`/api/scenes/${sceneId}/generate-video`);
  }

  async function submitReview(projectId, status, comment) {
    return API.post("/api/reviews/", {
      project_id: Number(projectId),
      status,
      comment: comment || "",
    });
  }

  async function listReviews(projectId) {
    return API.get(`/api/reviews/?project_id=${projectId}`);
  }

  async function transition(projectId, stepKey) {
    const map = {
      script_ready: "processing",
      storyboard_in_progress: "processing",
      render_in_progress: "processing",
      in_review: "review",
      approved: "approved",
      rejected: "rejected",
    };
    const status = map[stepKey];
    if (!status) throw new Error("不支持的步骤流转");
    return updateProject(projectId, { status });
  }

  window.ProjectStore = {
    getProject,
    updateProject,
    listScenes,
    updateScene,
    createScene,
    generateImage,
    generateVideo,
    submitReview,
    listReviews,
    transition,
  };
})();
