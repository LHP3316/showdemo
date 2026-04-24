/* ========================================
   负责人标签
   ======================================== */
(function () {
  function render(name, role) {
    const roleText = role || "staff";
    const cls = roleText === "director" ? "bg-purple-500/20 text-purple-300" : "bg-blue-500/20 text-blue-300";
    return `
      <span class="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs ${cls}">
        <span class="w-1.5 h-1.5 rounded-full bg-current"></span>
        ${_escape(name || "未分配")}
      </span>
    `;
  }

  function _escape(text) {
    return String(text || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  window.AssigneePill = { render };
})();
