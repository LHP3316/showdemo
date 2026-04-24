/* ========================================
   分镜卡片
   ======================================== */
(function () {
  function render(scene, active) {
    return `
      <button data-scene-id="${scene.id}" class="w-full text-left border rounded-lg p-3 transition-all ${
        active ? "border-brand-500 bg-brand-50" : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
      }">
        <div class="text-xs text-gray-500 mb-1">Scene ${scene.scene_index}</div>
        <div class="text-sm text-gray-700 truncate">${_escape(scene.scene_description || scene.prompt || "未命名分镜")}</div>
      </button>
    `;
  }

  function _escape(text) {
    return String(text || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  window.SceneCard = { render };
})();
