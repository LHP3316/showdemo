/* ========================================
   分镜卡片
   ======================================== */
(function () {
  function render(scene, active) {
    return `
      <button data-scene-id="${scene.id}" class="w-full text-left border rounded-lg p-3 transition-all ${
        active ? "border-gold-400 bg-gold-400/10" : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
      }">
        <div class="text-xs text-gray-400 mb-1">Scene ${scene.scene_index}</div>
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
