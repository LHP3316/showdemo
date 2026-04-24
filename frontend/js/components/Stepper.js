/* ========================================
   流程步骤条
   ======================================== */
(function () {
  const STEPS = [
    "draft",
    "storyboard_in_progress",
    "render_in_progress",
    "in_review",
    "approved",
  ];

  const STEP_LABEL = {
    draft: "剧本",
    storyboard_in_progress: "分镜",
    render_in_progress: "生成",
    in_review: "审核",
    approved: "导出",
  };

  function render(currentStep) {
    const currentIndex = Math.max(STEPS.indexOf(currentStep), 0);
    return `
      <div class="flex flex-wrap items-center gap-2">
        ${STEPS.map((step, index) => {
          const active = index === currentIndex;
          const done = index < currentIndex;
          return `
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-full text-xs flex items-center justify-center ${
                active ? "bg-blue-500 text-white" : done ? "bg-green-500 text-white" : "bg-dark-600 text-gray-400"
              }">${index + 1}</div>
              <span class="text-xs ${active ? "text-blue-300" : "text-gray-400"}">${STEP_LABEL[step]}</span>
              ${index < STEPS.length - 1 ? '<div class="w-6 h-px bg-dark-500"></div>' : ""}
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  window.Stepper = { render };
})();
