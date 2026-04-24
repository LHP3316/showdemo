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
    const accentColor = type === "danger" ? "#dc2626" : type === "warning" ? "#d97706" : "#2563eb";
    const overlay = document.createElement("div");
    overlay.id = "modal-overlay";
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="bg-white rounded-xl border border-gray-200 w-full max-w-md mx-4 p-5 shadow-lg">
        <h3 class="text-lg font-semibold text-gray-900 mb-3">${title}</h3>
        <div class="text-sm text-gray-600 leading-relaxed mb-4">${content}</div>
        <div class="flex justify-end gap-3">
          ${showCancel ? `<button id="modal-cancel" class="px-4 py-2 rounded-lg text-sm text-gray-700 bg-gray-100 hover:bg-gray-200">${cancelText}</button>` : ""}
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
