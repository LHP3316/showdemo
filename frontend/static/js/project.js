/**
 * 项目详情页逻辑
 */

$(document).ready(function() {
  checkLogin();
  loadUserInfo();
  loadProjectInfo();
});

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
      $('#username').text(user.display_name || user.username);
    }
  } catch (e) {
    console.error('解析用户信息失败:', e);
  }
}

function loadProjectInfo() {
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get('id');
  
  if (projectId) {
    // 模拟加载项目数据（后续可替换为真实 API 调用）
    const projects = {
      '1': {
        title: '都市情感剧《爱的抉择》',
        desc: '现代都市爱情题材，讲述职场女性在事业与爱情之间的抉择',
        episodes: 20,
        current: 15,
        status: '制作中'
      },
      '2': {
        title: '科幻短剧《星际迷航》',
        desc: '未来世界，人类探索外太空的神秘冒险故事',
        episodes: 12,
        current: 10,
        status: '待审核'
      },
      '3': {
        title: '古装剧《大明风华》',
        desc: '明朝历史背景，展现宫廷斗争与人物命运',
        episodes: 30,
        current: 30,
        status: '已完成'
      }
    };
    
    const project = projects[projectId];
    if (project) {
      $('#projectTitle').text(project.title);
      $('#projectDesc').text(project.desc);
    }
  }
}
