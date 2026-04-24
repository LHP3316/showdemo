/* ========================================
   项目驾驶舱
   ======================================== */
(function () {
  let state = {
    project: null,
    scenes: [],
    reviews: [],
  };

  function render(params) {
    const id = params.id;
    if (id === "new") {
      return `
        <div class="h-full flex items-center justify-center">
          <div class="text-center">
            <p class="text-gray-300 mb-3">新项目尚未创建，请先进入剧本工位。</p>
            <a class="text-blue-300" href="#/project/new/script">前往剧本工位</a>
          </div>
        </div>
      `;
    }
    return `
      <div class="page-content space-y-6 fade-in">
        <section class="card">
          <div class="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 id="cockpit-title" class="text-2xl font-bold text-gray-900">项目加载中...</h2>
              <p id="cockpit-meta" class="text-sm text-gray-500 mt-1"></p>
            </div>
            <div id="cockpit-assignee"></div>
          </div>
          <div id="cockpit-stepper"></div>
        </section>

        <section class="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <article class="card">
            <h3 class="text-sm text-gray-500 mb-2">当前进度</h3>
            <p id="cockpit-progress" class="text-2xl text-gray-900 font-bold">-</p>
            <div class="mt-4 flex gap-2">
              <a id="cockpit-link-script" class="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm text-gray-700 transition-colors" href="#">剧本工位</a>
              <a id="cockpit-link-board" class="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm text-gray-700 transition-colors" href="#">分镜工位</a>
            </div>
          </article>
          <article class="card">
            <h3 class="text-sm text-gray-500 mb-2">阻塞提醒</h3>
            <ul id="cockpit-blockers" class="text-sm text-gray-600 space-y-1"></ul>
          </article>
          <article class="card">
            <h3 class="text-sm text-gray-500 mb-2">资产统计</h3>
            <p id="cockpit-assets" class="text-sm text-gray-700"></p>
          </article>
        </section>

        <section class="card">
          <h3 class="text-sm text-gray-500 mb-3">流程时间线</h3>
          <div id="cockpit-timeline"></div>
        </section>
      </div>
    `;
  }

  async function mount(params) {
    const id = params.id;
    if (id === "new") return;
    await _load(id);
  }

  async function _load(projectId) {
    try {
      const [project, scenes, reviews] = await Promise.all([
        ProjectStore.getProject(projectId),
        ProjectStore.listScenes(projectId),
        ProjectStore.listReviews(projectId).catch(() => []),
      ]);
      state.project = project;
      state.scenes = scenes;
      state.reviews = reviews;
      _render(projectId);
    } catch (err) {
      App.showToast(err.message || "项目加载失败", "error");
    }
  }

  function _render(projectId) {
    const step = TaskStore.buildStep(state.project, state.scenes);
    const titleEl = document.getElementById("cockpit-title");
    const metaEl = document.getElementById("cockpit-meta");
    const assigneeEl = document.getElementById("cockpit-assignee");
    const stepperEl = document.getElementById("cockpit-stepper");
    const progressEl = document.getElementById("cockpit-progress");
    const blockersEl = document.getElementById("cockpit-blockers");
    const assetsEl = document.getElementById("cockpit-assets");
    const timelineEl = document.getElementById("cockpit-timeline");

    if (titleEl) titleEl.textContent = state.project.title;
    if (metaEl) metaEl.textContent = `项目ID：${state.project.id} · 状态：${state.project.status}`;
    if (assigneeEl) assigneeEl.innerHTML = AssigneePill.render(`User#${state.project.assigned_to || "-"}`, "staff");
    if (stepperEl) stepperEl.innerHTML = Stepper.render(step);
    if (progressEl) progressEl.textContent = TaskStore.labelStep(step);

    if (assetsEl) {
      const images = state.scenes.filter((s) => !!s.image_url).length;
      const videos = state.scenes.filter((s) => !!s.video_url).length;
      assetsEl.textContent = `分镜 ${state.scenes.length} / 图片 ${images} / 视频 ${videos}`;
    }

    if (blockersEl) {
      const blockers = [];
      if (!state.project.script) blockers.push("剧本未填写");
      if (!state.scenes.length) blockers.push("尚未生成分镜");
      if (!state.scenes.some((s) => s.video_url)) blockers.push("暂无视频资产");
      blockersEl.innerHTML = blockers.length
        ? blockers.map((b) => `<li class="text-amber-600">• ${_escape(b)}</li>`).join("")
        : `<li class="text-green-600">• 当前无阻塞</li>`;
    }

    if (timelineEl) {
      const items = [
        { title: "项目创建", time: state.project.created_at },
        ...state.reviews.map((r) => ({ title: `审核${r.status === "approved" ? "通过" : "驳回"}：${r.comment || "无备注"}`, time: r.created_at })),
      ];
      timelineEl.innerHTML = Timeline.render(items);
    }

    const linkScript = document.getElementById("cockpit-link-script");
    const linkBoard = document.getElementById("cockpit-link-board");
    if (linkScript) linkScript.href = `#/project/${projectId}/script`;
    if (linkBoard) linkBoard.href = `#/project/${projectId}/storyboard`;
  }

  function _escape(text) {
    return String(text || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  window.ProjectCockpitPage = { render, mount };
})();
