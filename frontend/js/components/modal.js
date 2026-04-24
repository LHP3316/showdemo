(function () {
  let currentCallback = null;

  function show(options = {}) {
    const {
      title = "提示",
      content = "",
      confirmText = "确认",
      cancelText = "取消",
      showCancel = true,
      type = "info",
      onConfirm = null,
      onCancel = null,
    } = options;

    hide();
    const accentColor = type === "danger" ? "#ef4444" : type === "warning" ? "#f59e0b" : "#3b82f6";
    const overlay = document.createElement("div");
    overlay.id = "modal-overlay";
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="bg-dark-800 rounded-xl border border-dark-500 w-full max-w-md mx-4 p-5">
        <h3 class="text-lg font-semibold text-gray-100 mb-3">${title}</h3>
        <div class="text-sm text-gray-400 leading-relaxed mb-4">${content}</div>
        <div class="flex justify-end gap-3">
          ${showCancel ? `<button id="modal-cancel" class="px-4 py-2 rounded-lg text-sm text-gray-300 bg-dark-600 hover:bg-dark-500">${cancelText}</button>` : ""}
          <button id="modal-confirm" class="px-4 py-2 rounded-lg text-sm text-white" style="background:${accentColor}">${confirmText}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const confirmBtn = document.getElementById("modal-confirm");
    const cancelBtn = document.getElementById("modal-cancel");
    confirmBtn.addEventListener("click", () => {
      if (onConfirm) onConfirm();
      hide();
    });
    if (cancelBtn) cancelBtn.addEventListener("click", () => {
      hide();
      if (onCancel) onCancel();
    });
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        hide();
        if (onCancel) onCancel();
      }
    });
    currentCallback = (e) => {
      if (e.key === "Escape") {
        hide();
        if (onCancel) onCancel();
      }
    };
    document.addEventListener("keydown", currentCallback);
  }

  function hide() {
    const overlay = document.getElementById("modal-overlay");
    if (overlay) overlay.remove();
    if (currentCallback) {
      document.removeEventListener("keydown", currentCallback);
      currentCallback = null;
    }
  }

  window.Modal = { show, hide };
})();
