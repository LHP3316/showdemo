/* ========================================
   时间线组件
   ======================================== */
(function () {
  function render(items) {
    if (!items || !items.length) {
      return `<div class="text-sm text-gray-500">暂无时间线记录</div>`;
    }
    return `
      <div class="space-y-3">
        ${items.map((item) => `
          <div class="flex gap-3">
            <div class="w-2 h-2 rounded-full mt-2 bg-blue-400"></div>
            <div>
              <div class="text-sm text-gray-200">${_escape(item.title)}</div>
              <div class="text-xs text-gray-500">${_escape(item.time || "")}</div>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  function _escape(text) {
    return String(text || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  window.Timeline = { render };
})();
