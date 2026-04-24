/**
 * 工作台逻辑
 * 说明: 处理工作台页面初始化和用户信息显示
 */

$(document).ready(function() {
  // 检查登录状态
  checkLogin();
  
  // 加载用户信息
  loadUserInfo();
});

/**
 * 检查登录状态
 */
function checkLogin() {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');
  
  if (!token || !user) {
    // 未登录，跳转到登录页
    window.location.href = '/login.html';
  }
}

/**
 * 加载用户信息
 */
function loadUserInfo() {
  try {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
      const displayName = user.display_name || user.username;
      $('#username').text(displayName);
      $('#welcomeName').text(displayName);
    }
  } catch (e) {
    console.error('解析用户信息失败:', e);
  }
}
