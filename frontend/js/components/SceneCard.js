/* ========================================
   分镜卡片
   ======================================== */
(function () {
  function render(scene, active) {
    return `
      <button data-scene-id="${scene.id}" class="scene-card w-full text-left border rounded-lg p-3 ${
        active ? "border-blue-500 bg-blue-500/10" : "border-dark-500 bg-dark-700 hover:border-dark-400"
      }">
        <div class="text-xs text-gray-500 mb-1">Scene ${scene.scene_index}</div>
        <div class="text-sm text-gray-200 truncate">${_escape(scene.scene_description || scene.prompt || "未命名分镜")}</div>
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
