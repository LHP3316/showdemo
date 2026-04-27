/**
 * Project detail page (semantic layout)
 */
(function () {
  let currentUser = null;
  let cachedProject = null;

  document.addEventListener("DOMContentLoaded", async function () {
    if (!window.CommonApp || !window.api) return;
    const ok = await CommonApp.ensureSession(true);
    if (!ok) return;
    currentUser = safeJson(localStorage.getItem("user"));

    bindActions();
    await loadProjectInfo();
  });

  function bindActions() {
    bindClick("#btn-go-script", goToScriptWorkbench);
    bindClick("#btn-go-storyboard", () => goToWorkbench("storyboard"));
    bindClick("#btn-go-render", () => goToWorkbench("render"));
    bindClick("#btn-go-review", () => goToWorkbench("review"));
    bindClick("#btn-go-export", () => goToWorkbench("export"));
    bindClick("#btn-view-blockers", () => goToWorkbench("review"));
    bindClick("#btn-assign-staff", assignStaffForProject);
  }

  function bindClick(selector, handler) {
    const node = document.querySelector(selector);
    if (!node) return;
    node.addEventListener("click", handler);
  }

  async function loadProjectInfo() {
    try {
      let id = getProjectId();
      if (!id) {
        const projectsRes = await api.get("/projects?size=1");
        const first = projectsRes && projectsRes.data && projectsRes.data.items ? projectsRes.data.items[0] : null;
        if (!first || !first.id) {
          return;
        }
        id = String(first.id);
        localStorage.setItem("activeProjectId", id);
        window.history.replaceState({}, "", `project.html?id=${id}`);
      }

      const [projectRes, tasksRes, assetsRes, reviewsRes] = await Promise.all([
        api.get(`/projects/${id}`),
        // size 最大 100（后端校验 le=100）
        api.get("/api/tasks/tasks?size=100"),
        api.get(`/api/export/export/project/${id}/assets`),
        api.get(`/api/reviews/?project_id=${id}&size=20`),
      ]);

      const project = projectRes && projectRes.data ? projectRes.data : {};
      const tasksAll = tasksRes && tasksRes.data && tasksRes.data.items ? tasksRes.data.items : [];
      const assets = assetsRes && assetsRes.data ? assetsRes.data : {};
      const reviews = reviewsRes && reviewsRes.data && reviewsRes.data.items ? reviewsRes.data.items : [];
      cachedProject = project;

      const scenes = Array.isArray(project.scenes) ? project.scenes : [];
      const sceneIdSet = new Set(scenes.map((s) => s && s.id).filter(Boolean));
      const tasks = tasksAll.filter((t) => t && sceneIdSet.has(t.scene_id));

      patchProjectHeader(project);
      patchProgress(project, { scenes, tasks, assets });
      patchAssets(assets);
      patchFlowSteps(project, { scenes, tasks, assets, reviews });
      patchTimeline(project, { scenes, tasks, reviews });
      patchBlockers(project, { scenes, tasks, reviews });
      patchAssignAction(project);
      patchQuickActions(project, { scenes, tasks, reviews });
    } catch (err) {
      console.error("Failed to load project detail:", err);
      // keep semantic page defaults when backend is unavailable
    }
  }

  function getProjectId() {
    const queryId = new URLSearchParams(window.location.search).get("id");
    if (queryId) {
      localStorage.setItem("activeProjectId", String(queryId));
      return String(queryId);
    }
    return localStorage.getItem("activeProjectId");
  }

  function goToWorkbench(route) {
    if (window.CommonApp) {
      CommonApp.routeTo(route);
      return;
    }
    const id = getProjectId();
    const base = `${route}.html`;
    if (route === "review") {
      window.location.href = base;
      return;
    }
    window.location.href = id ? `${base}?id=${id}` : base;
  }

  function hasProducedAssets(project) {
    const scenes = Array.isArray(project && project.scenes) ? project.scenes : [];
    return scenes.some((s) => {
      const image = String((s && s.image_url) || "").trim();
      const video = String((s && s.video_url) || "").trim();
      return !!(image || video);
    });
  }

  function goToScriptWorkbench() {
    // 允许导演进入剧本工位；具体是否可编辑由剧本页按资产状态控制只读
    goToWorkbench("script");
  }

  function patchProjectHeader(project) {
    const title = project.title || "未命名项目";
    const meta = `${project.genre || "未知风格"} · ${project.episode_count || 0} 集`;
    setText("#project-breadcrumb-current", title);
    setText("#project-title", title);
    setText("#project-meta", meta);
    setText("#project-subtitle", project.description || "电影工业级创作协作平台");
    const assigneeName = project.assignee && (project.assignee.display_name || project.assignee.username);
    if (project.assigned_to) {
      setText(
        "#project-assign-status",
        `当前已分配：${assigneeName ? assigneeName : `工作人员ID ${project.assigned_to}`}`
      );
    } else {
      setText("#project-assign-status", "当前未分配工作人员");
    }
  }

  function patchProgress(project, ctx) {
    const scenes = (ctx && Array.isArray(ctx.scenes)) ? ctx.scenes : [];
    const tasks = (ctx && Array.isArray(ctx.tasks)) ? ctx.tasks : [];
    const assets = (ctx && ctx.assets && typeof ctx.assets === "object") ? ctx.assets : {};
    const sceneCount = Number(project.scene_count || assets.total_scenes || scenes.length || 0);

    // 优先按分镜资产进度计算（有图或有视频即计入已制作），避免任务队列缺失时进度一直为 0%
    const sceneAssetDone = scenes.filter((s) => {
      const image = String((s && s.image_url) || "").trim();
      const video = String((s && s.video_url) || "").trim();
      return !!(image || video);
    }).length;

    const assetDone = Math.max(
      sceneAssetDone,
      Number(assets.images_count || 0),
      Number(assets.videos_count || 0),
      tasks.filter((t) => t.status === "success").length
    );
    const total = Math.max(sceneCount, 1);
    const percent = Math.min(100, Math.floor((assetDone / total) * 100));

    setText("#project-progress-percent", `${percent}%`);
    setText(
      "#project-progress-summary",
      `${mapProjectStatus(project.status)}阶段 · 第${project.current_episode || 1}/${project.episode_count || 0}集`
    );

    const bar = document.querySelector("#project-progress-bar");
    if (bar) bar.style.width = `${percent}%`;
    const track = document.querySelector(".progress-track");
    if (track) track.setAttribute("aria-valuenow", String(percent));
  }

  function patchAssets(assets) {
    setText("#asset-images", String(assets.images_count || 0));
    setText("#asset-videos", String(assets.videos_count || 0));
    setText("#asset-scenes", String(assets.total_scenes || 0));
  }

  function patchTimeline(project, ctx) {
    const scenes = (ctx && ctx.scenes) ? ctx.scenes : [];
    const tasks = (ctx && ctx.tasks) ? ctx.tasks : [];
    const reviews = (ctx && ctx.reviews) ? ctx.reviews : [];

    const hasScript = !!(project && project.script && String(project.script).trim());
    const hasScenes = scenes.length > 0;
    const taskDone = tasks.filter((t) => t.status === "success").length;
    const taskTotal = tasks.length;
    const latestReview = reviews && reviews[0] ? reviews[0] : null;
    const producedCount = scenes.filter((s) => {
      const image = String((s && s.image_url) || "").trim();
      const video = String((s && s.video_url) || "").trim();
      return !!(image || video);
    }).length;
    const allProduced = hasScenes && producedCount >= scenes.length;

    const scriptState = hasScript ? "done" : "active";
    const storyboardState = !hasScript ? "pending" : (hasScenes ? "done" : "pending");
    const renderForcedDone = project.status === "review" || project.status === "approved" || project.status === "exported";
    const renderState = !hasScenes
      ? "pending"
      : (renderForcedDone
        ? "done"
        : (allProduced ? "done" : (producedCount > 0 || taskTotal > 0 ? "active" : "pending")));
    const reviewState = project.status === "review" ? "active" : (latestReview ? "done" : "pending");
    const exportState = project.status === "approved" ? "active" : (project.status === "exported" ? "done" : "pending");

    const items = [
      {
        title: "剧本工位",
        desc: hasScript ? `已录入剧本 · ${formatDate(project.updated_at)}` : "未录入剧本：请先进入剧本工位上传/粘贴剧本并保存",
        tag: hasScript ? "已完成" : "待处理",
        state: scriptState,
      },
      {
        title: "AI分镜 / 分镜设计",
        desc: hasScenes ? `已生成分镜 ${scenes.length} 条 · ${formatDate(project.updated_at)}` : (hasScript ? "尚未生成分镜：可直接进入分镜工位创建与编辑分镜" : "等待剧本录入后可创建分镜"),
        tag: hasScenes ? "已完成" : "待开始",
        state: storyboardState,
      },
      {
        title: "生成队列",
        desc: hasScenes
          ? (allProduced
            ? `资产已完成 ${producedCount}/${scenes.length}`
            : (producedCount > 0
              ? `资产生成中 ${producedCount}/${scenes.length}`
              : (taskTotal ? `任务 ${taskDone}/${taskTotal} 已完成` : "暂无生成任务：进入分镜工位后可触发文生图/图生视频")))
          : "暂无生成任务：进入分镜工位后可触发文生图/图生视频",
        tag: renderForcedDone ? "已完成" : (allProduced ? "已完成" : (hasScenes && (producedCount > 0 || taskTotal > 0) ? "进行中" : "待开始")),
        state: renderState,
      },
      {
        title: "审核确认",
        desc: project.status === "review"
          ? "项目已提交审核，等待导演确认"
          : (latestReview ? `最近一次审核：${latestReview.status} · ${formatDate(latestReview.created_at)}` : "暂未提交审核"),
        tag: project.status === "review" ? "待审核" : (latestReview ? "已完成" : "暂未提交"),
        state: reviewState,
      },
      {
        title: "导出交付",
        desc: project.status === "approved" ? "项目已通过审核，可进入导出交付" : "待审核通过后可导出",
        tag: project.status === "approved" ? "可导出" : "待开始",
        state: exportState,
      },
    ];

    const list = document.querySelector("#project-timeline");
    if (!list) return;
    list.innerHTML = items
      .map(
        (it) => `
        <li class="timeline-item ${it.state === "done" ? "is-done" : it.state === "active" ? "is-active" : ""}">
          <div class="timeline-dot" aria-hidden="true"></div>
          <div class="timeline-body">
            <h3 class="timeline-item-title">${escapeHtml(it.title)}</h3>
            <p class="timeline-item-desc">${escapeHtml(it.desc)}</p>
          </div>
          <span class="timeline-tag">${escapeHtml(it.tag)}</span>
        </li>`
      )
      .join("");
  }

  function patchFlowSteps(project, ctx) {
    const scenes = (ctx && Array.isArray(ctx.scenes)) ? ctx.scenes : [];
    const assets = (ctx && ctx.assets && typeof ctx.assets === "object") ? ctx.assets : {};
    const hasScenes = scenes.length > 0;
    const producedCount = scenes.filter((s) => {
      const image = String((s && s.image_url) || "").trim();
      const video = String((s && s.video_url) || "").trim();
      return !!(image || video);
    }).length;
    const allProduced = hasScenes && producedCount >= scenes.length;
    const status = String((project && project.status) || "").trim();

    // 计算当前处于哪一步（1-5）
    // 1 剧本创作 -> 2 分镜设计 -> 3 生成队列 -> 4 审核确认 -> 5 导出交付
    let activeStep = 1;
    if (status === "review") activeStep = 4;
    else if (status === "approved") activeStep = 5;
    else if (status === "exported") activeStep = 5;
    else if (status === "processing") activeStep = 2;
    else if (status === "draft") activeStep = 1;

    // 生成队列：有产出时可视为进入第3步（但若已到 review/approved 则由上面覆盖）
    if (activeStep <= 3) {
      const hasAnyAsset = Math.max(Number(assets.images_count || 0), Number(assets.videos_count || 0), producedCount) > 0;
      if (hasAnyAsset) activeStep = 3;
      if (allProduced) activeStep = 3;
    }

    const steps = Array.from(document.querySelectorAll(".flow-list .flow-step"));
    if (!steps.length) return;
    steps.forEach((node, idx) => {
      const stepNo = idx + 1;
      node.classList.remove("is-done", "is-active");
      if (stepNo < activeStep) node.classList.add("is-done");
      else if (stepNo === activeStep) node.classList.add("is-active");
    });

    // 导出交付已完成时（exported）把第5步标 done
    if (status === "exported" && steps[4]) {
      steps[4].classList.remove("is-active");
      steps[4].classList.add("is-done");
    }
  }

  function patchBlockers(project, ctx) {
    const box = document.querySelector("#project-blockers");
    const count = document.querySelector("#blocker-count");
    const action = document.querySelector("#btn-view-blockers");
    if (!box) return;

    let issues = [];
    const scenes = (ctx && ctx.scenes) ? ctx.scenes : [];
    const reviews = (ctx && ctx.reviews) ? ctx.reviews : [];
    const hasScript = !!(project && project.script && String(project.script).trim());
    const hasScenes = scenes.length > 0;
    const isDirector = !!(currentUser && currentUser.role === "director");

    if (!hasScript) issues.push("未录入剧本：请进入剧本工位上传/粘贴剧本并保存。");
    if (isDirector && !project.assigned_to) issues.push("未分配工作人员：请先分配执行人员。");
    if (hasScript && !hasScenes) {
      issues.push(isDirector ? "未生成分镜：请先分配工作人员，由工作人员进入分镜工位创建分镜列表。" : "未生成分镜：请进入分镜工位创建分镜列表。");
    }
    if (project.status === "rejected") {
      const latest = reviews && reviews[0] ? reviews[0] : null;
      const comment = latest && latest.comment ? String(latest.comment) : "";
      issues.push(comment ? `审核未通过：${comment}` : "审核未通过：请根据反馈修改后重新提交。");
    }

    if (!issues.length) {
      box.innerHTML = "<li>暂无阻塞问题</li>";
      if (count) count.textContent = "0";
      if (action) action.style.visibility = "hidden";
      return;
    }

    box.innerHTML = issues.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
    if (count) count.textContent = String(issues.length);
    if (action) action.style.visibility = "visible";
  }

  function patchAssignAction(project) {
    const btn = document.querySelector("#btn-assign-staff");
    if (!btn) return;
    const isDirector = !!(currentUser && currentUser.role === "director");
    btn.toggleAttribute("hidden", !isDirector);
    if (isDirector) {
      btn.textContent = project && project.assigned_to ? "重新分配工作人员" : "分配给工作人员";
    }
  }

  function patchQuickActions(project, ctx) {
    const scenes = (ctx && ctx.scenes) ? ctx.scenes : [];
    const hasScript = !!(project && project.script && String(project.script).trim());
    const hasScenes = scenes.length > 0;
    const isDirector = !!(currentUser && currentUser.role === "director");
    const isStaff = !!(currentUser && currentUser.role === "staff");
    const scriptLockedForDirector = isDirector && hasProducedAssets(project);

    // 导演：主要负责剧本/分配/审核/导出，不进入分镜与生成队列执行工位
    // 工作人员：进入分镜与生成队列执行制作
    setBtnState("#btn-go-script", { disabled: false, title: "" });
    setBtnState("#btn-go-storyboard", {
      hidden: isDirector,
      disabled: !hasScript,
      title: hasScript ? "" : "请先录入剧本后再进入分镜工位",
    });
    setBtnState("#btn-go-render", {
      hidden: false,
      disabled: !hasScenes,
      title: hasScenes ? "" : "请先生成分镜后再进入生成队列",
    });

    // 审核中心：导演可见；工作人员仅查看状态（不开放进入审核中心）
    const canEnterReview = isDirector;
    setBtnState("#btn-go-review", { hidden: !canEnterReview, disabled: false, title: "" });

    // 导出交付：导演可见，且需 approved
    const canEnterExport = isDirector;
    setBtnState("#btn-go-export", { hidden: !canEnterExport, disabled: project.status !== "approved", title: project.status === "approved" ? "" : "需审核通过后才能导出" });

    // 分配按钮：仅导演可见
    const assignBtn = document.querySelector("#btn-assign-staff");
    if (assignBtn) {
      assignBtn.toggleAttribute("hidden", !isDirector);
      assignBtn.disabled = !isDirector;
    }

    // 标题与副标题提示
    const subtitle = document.querySelector("#project-subtitle");
    if (subtitle) {
      if (isDirector && !project.assigned_to) {
        subtitle.textContent = "当前未分配工作人员：请先分配执行人员，再推进分镜与生成。";
      } else if (scriptLockedForDirector) {
        subtitle.textContent = "项目已进入制作阶段：导演可跟进审核与导出，不再进入剧本工位。";
      } else if (!hasScript) {
        subtitle.textContent = "当前未录入剧本：请进入剧本工位上传/粘贴剧本并保存。";
      } else if (hasScript && !hasScenes) {
        subtitle.textContent = isDirector
          ? "已录入剧本：请分配工作人员进入分镜工位创建分镜。"
          : "已录入剧本：可直接进入分镜工位创建分镜。";
      } else if (isStaff) {
        subtitle.textContent = "你可以进入分镜工位完善分镜，并在生成队列生成资产。";
      }
    }
  }

  function setBtnState(selector, payload) {
    const btn = document.querySelector(selector);
    if (!btn) return;
    const hidden = !!(payload && payload.hidden);
    const disabled = !!(payload && payload.disabled);
    btn.toggleAttribute("hidden", hidden);
    btn.disabled = disabled;
    if (payload && typeof payload.title === "string") {
      if (payload.title) btn.setAttribute("title", payload.title);
      else btn.removeAttribute("title");
    }
  }

  async function assignStaffForProject() {
    const projectId = getProjectId();
    if (!projectId) return;
    if (!(currentUser && currentUser.role === "director")) return;
    if (window.CommonApp && typeof CommonApp.openAssignModal === "function") {
      CommonApp.openAssignModal({
        projectId,
        onAssigned: function (result) {
          const staffId = result && result.staffId ? Number(result.staffId) : null;
          if (staffId) {
            setText("#project-assign-status", `分配成功：工作人员 ID ${staffId}`);
            if (cachedProject) cachedProject.assigned_to = staffId;
            patchAssignAction(cachedProject || {});
          }
        },
      });
    }
  }

  function setText(selector, text) {
    const node = document.querySelector(selector);
    if (node) node.textContent = text;
  }

  function mapProjectStatus(status) {
    const map = {
      draft: "剧本创作",
      processing: "分镜设计",
      review: "审核确认",
      approved: "导出交付",
      rejected: "阻塞中",
    };
    return map[status] || status || "未知";
  }

  function escapeHtml(text) {
    return String(text || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function formatDate(iso) {
    if (!iso) return "待确认";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "待确认";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function safeJson(raw) {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
})();
