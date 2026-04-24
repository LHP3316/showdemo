/* ========================================
   Prompt 配置页
   ======================================== */
(function () {
  let state = {
    configs: [],
  };

  function render() {
    return `
      <div class="grid grid-cols-1 xl:grid-cols-3 gap-4 fade-in">
        <section class="xl:col-span-1 bg-dark-800 border border-dark-500 rounded-xl p-4">
          <h2 class="text-base font-semibold text-gray-100 mb-3">新建 Prompt 配置</h2>
          <form id="prompt-form" class="space-y-3">
            <select id="prompt-type" class="select-dark w-full">
              <option value="text2img">text2img</option>
              <option value="img2video">img2video</option>
              <option value="img2img">img2img</option>
            </select>
            <input id="prompt-name" class="input-dark" placeholder="配置名称（可选）" />
            <textarea id="prompt-config-json" class="textarea-dark min-h-[180px]" placeholder='{"template":"..."}'></textarea>
            <button class="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium">保存配置</button>
          </form>
        </section>

        <section class="xl:col-span-2 bg-dark-800 border border-dark-500 rounded-xl p-4">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-base font-semibold text-gray-100">配置列表</h2>
            <button id="prompt-refresh" class="px-3 py-1.5 rounded-lg bg-dark-600 hover:bg-dark-500 text-sm text-gray-200">刷新</button>
          </div>
          <div id="prompt-list" class="space-y-2"></div>
        </section>
      </div>
    `;
  }

  function mount() {
    _loadConfigs();
    document.getElementById("prompt-form").addEventListener("submit", _createConfig);
    document.getElementById("prompt-refresh").addEventListener("click", _loadConfigs);
  }

  async function _loadConfigs() {
    try {
      state.configs = await API.get("/api/prompt-configs/");
      _renderList();
    } catch (err) {
      App.showToast(err.message, "error");
    }
  }

  function _renderList() {
    const el = document.getElementById("prompt-list");
    if (!el) return;
    if (!state.configs.length) {
      el.innerHTML = `<div class="text-sm text-gray-500">暂无配置</div>`;
      return;
    }
    el.innerHTML = state.configs
      .map(
        (cfg) => `
      <article class="border border-dark-500 rounded-lg p-3 bg-dark-700">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <div class="text-sm text-gray-100 font-medium truncate">${cfg.name || "未命名配置"}</div>
            <div class="text-xs text-gray-500 mt-1">类型：${cfg.type} · ID：${cfg.id}</div>
          </div>
          <button data-id="${cfg.id}" class="prompt-delete px-2.5 py-1 rounded bg-red-600 hover:bg-red-500 text-xs text-white">删除</button>
        </div>
        <pre class="mt-2 text-xs text-gray-300 bg-dark-900 border border-dark-500 rounded p-2 overflow-auto">${_escape(
          JSON.stringify(cfg.config || {}, null, 2)
        )}</pre>
      </article>
    `
      )
      .join("");

    el.querySelectorAll(".prompt-delete").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        try {
          await API.delete(`/api/prompt-configs/${id}`);
          App.showToast("配置已删除", "success");
          await _loadConfigs();
        } catch (err) {
          App.showToast(err.message, "error");
        }
      });
    });
  }

  async function _createConfig(e) {
    e.preventDefault();
    const type = document.getElementById("prompt-type").value;
    const name = document.getElementById("prompt-name").value.trim();
    const jsonText = document.getElementById("prompt-config-json").value.trim();

    let configObj = {};
    if (jsonText) {
      try {
        configObj = JSON.parse(jsonText);
      } catch {
        return App.showToast("JSON 格式错误", "warning");
      }
    }

    try {
      await API.post("/api/prompt-configs/", {
        type,
        name,
        config: configObj,
      });
      App.showToast("配置保存成功", "success");
      document.getElementById("prompt-form").reset();
      await _loadConfigs();
    } catch (err) {
      App.showToast(err.message, "error");
    }
  }

  function _escape(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  window.PromptConfigPage = { render, mount };
})();
