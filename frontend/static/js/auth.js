/**
 * 认证逻辑
 * 说明: 处理用户登录、登出、权限检查
 */

$(document).ready(function() {
  // 检查是否已登录
  checkAuth();

  // 登录表单提交
  $('#loginForm').on('submit', function(e) {
    e.preventDefault();
    
    const username = $('#username').val().trim();
    const password = $('#password').val().trim();
    
    if (!username || !password) {
      showError('请输入账号和密码');
      return;
    }

    // 禁用按钮
    const $btn = $('#loginBtn');
    $btn.prop('disabled', true).text('登录中...');
    hideError();

    // 发送登录请求
    api.post('/auth/login', { username, password })
      .then(data => {
        // 保存 token 和用户信息
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // 跳转到工作台
        window.location.href = '/workspace.html';
      })
      .catch(error => {
        showError(error.message || '登录失败，请检查账号和密码');
        $btn.prop('disabled', false).text('立即登录');
      });
  });
});

/**
 * 检查登录状态
 */
function checkAuth() {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');
  
  if (token && user) {
    // 已登录，跳转到工作台
    window.location.href = '/workspace.html';
  }
}

/**
 * 显示错误信息
 */
function showError(message) {
  $('#errorMessage').text(message).addClass('show');
}

/**
 * 隐藏错误信息
 */
function hideError() {
  $('#errorMessage').removeClass('show');
}

/**
 * 登出
 */
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login.html';
}
