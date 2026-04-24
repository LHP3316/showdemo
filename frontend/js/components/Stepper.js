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
      <div class="step-bar">
        ${STEPS.map((step, index) => {
          const active = index === currentIndex;
          const done = index < currentIndex;
          const state = active ? 'active' : done ? 'done' : 'pending';
          return `
            <div class="step-item">
              <div class="step-dot ${state}">${done ? '✓' : index + 1}</div>
              <span class="step-label ${state}">${STEP_LABEL[step]}</span>
            </div>
            ${index < STEPS.length - 1 ? '<div class="step-connector"></div>' : ''}
          `;
        }).join('')}
      </div>
    `;
  }

  window.Stepper = { render };
})();
