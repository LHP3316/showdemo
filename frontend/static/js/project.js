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
    bindClick("#btn-go-script", () => goToWorkbench("script"));
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

      const [projectRes, tasksRes, assetsRes] = await Promise.all([
        api.get(`/projects/${id}`),
        api.get("/api/tasks/tasks?size=200"),
        api.get(`/api/export/export/project/${id}/assets`),
      ]);

      const project = projectRes && projectRes.data ? projectRes.data : {};
      const tasks = tasksRes && tasksRes.data && tasksRes.data.items ? tasksRes.data.items : [];
      const assets = assetsRes && assetsRes.data ? assetsRes.data : {};
      cachedProject = project;

      patchProjectHeader(project);
      patchProgress(project, tasks);
      patchAssets(assets);
      patchTimeline(project);
      patchBlockers(project);
      patchAssignAction(project);
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
    window.location.href = id ? `${base}?id=${id}` : base;
  }

  function patchProjectHeader(project) {
    const title = project.title || "未命名项目";
    const meta = `${project.genre || "未知风格"} · ${project.episode_count || 0} 集`;
    setText("#project-breadcrumb-current", title);
    setText("#project-title", title);
    setText("#project-meta", meta);
    setText("#project-subtitle", project.description || "电影工业级创作协作平台");
    if (project.assigned_to) {
      setText("#project-assign-status", `当前已分配工作人员 ID：${project.assigned_to}`);
    } else {
      setText("#project-assign-status", "当前未分配工作人员");
    }
  }

  function patchProgress(project, tasks) {
    const sceneCount = Number(project.scene_count || 0);
    const done = tasks.filter((t) => t.status === "success").length;
    const total = Math.max(sceneCount, done, 1);
    const percent = Math.min(100, Math.floor((done / total) * 100));

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

  function patchTimeline(project) {
    const items = [
      {
        title: "剧本创作完成",
        desc: "由编剧提交，已通过导演审核",
        tag: "已完成",
        state: "done",
      },
      {
        title: "分镜设计进行中",
        desc: `当前状态：${mapProjectStatus(project.status)} · 截止 ${formatDate(project.updated_at)}`,
        tag: "进行中",
        state: "active",
      },
      {
        title: "AI生成队列",
        desc: "等待分镜设计完成后自动触发生成任务",
        tag: "待开始",
        state: "pending",
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

  function patchBlockers(project) {
    const box = document.querySelector("#project-blockers");
    const count = document.querySelector("#blocker-count");
    const action = document.querySelector("#btn-view-blockers");
    if (!box) return;

    let issues = [];
    if (project.status === "rejected") {
      issues = ["审核未通过：请根据反馈修改后重新提交。"];
    } else if (project.status === "processing" || project.status === "review") {
      issues = ["第7集分镜参考素材缺失，无法继续生成", "第9集配音演员档期冲突待协调"];
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
