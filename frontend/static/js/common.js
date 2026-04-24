/**
 * 公共工具函数
 */

function checkLogin() {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/login.html';
  }
}

function loadUserInfo() {
  try {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
      const displayName = user.display_name || user.username;
      $('#username').text(displayName);
    }
  } catch (e) {
    console.error('解析用户信息失败:', e);
  }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login.html';
}
