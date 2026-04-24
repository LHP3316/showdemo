/* ========================================
   审核弹窗
   ======================================== */
(function () {
  function open({ title, confirmText, type = "info", onSubmit }) {
    const content = `
      <div class="space-y-2">
        <p class="text-sm text-gray-400">请填写审核意见：</p>
        <textarea id="review-dialog-comment" class="textarea-dark min-h-[120px]" placeholder="请输入意见"></textarea>
      </div>
    `;
    Modal.show({
      title,
      content,
      confirmText: confirmText || "提交",
      type,
      onConfirm: () => {
        const commentEl = document.getElementById("review-dialog-comment");
        const comment = commentEl ? commentEl.value.trim() : "";
        if (typeof onSubmit === "function") onSubmit(comment);
      },
    });
  }

  window.ReviewDialog = { open };
})();
