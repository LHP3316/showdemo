/**
 * 工作台页
 * 说明: 用户首页，显示统计和项目列表
 * 版本: v2.0
 */
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/store/AuthContext';

const Workspace: React.FC = () => {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 模拟加载
    setTimeout(() => setLoading(false), 500);
  }, []);

  if (loading) {
    return <div className="loading-page">加载中...</div>;
  }

  return (
    <div className="workspace-page">
      {/* 顶部导航 */}
      <nav className="topnav">
        <div className="topnav-brand">
          <div className="topnav-logo">AI</div>
          <span>短剧协作台</span>
        </div>
        <div className="topnav-user">
          <span>{user?.display_name || user?.username}</span>
          <button onClick={logout} className="btn-logout">退出</button>
        </div>
      </nav>

      {/* 页面内容 */}
      <main className="workspace-content">
        {/* 欢迎区 */}
        <div className="welcome-section">
          <h1>欢迎回来，{user?.display_name || user?.username}</h1>
          <p>今天是您加入平台的第 128 天，共参与 12 个项目</p>
        </div>

        {/* 统计卡片 */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">参与项目</div>
            <div className="stat-value">12</div>
            <div className="stat-desc">个在制作中</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">待处理任务</div>
            <div className="stat-value">5</div>
            <div className="stat-desc">需要您的处理</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">待审核</div>
            <div className="stat-value">3</div>
            <div className="stat-desc">分镜待审批</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">已完成项目</div>
            <div className="stat-value">8</div>
            <div className="stat-desc">精彩短剧上线</div>
          </div>
        </div>

        {/* 项目列表 */}
        <div className="projects-section">
          <h2>最近项目</h2>
          <div className="projects-grid">
            <div className="project-card" onClick={() => window.location.href = '/project/1'}>
              <div className="project-header">
                <h3>都市情感剧《爱的抉择》</h3>
                <span className="badge badge-active">制作中</span>
              </div>
              <p className="project-desc">现代都市爱情题材，讲述职场女性在事业与爱情之间的抉择</p>
              <div className="project-meta">
                <span>共 20 集</span>
                <span>•</span>
                <span>更新至第 15 集</span>
              </div>
            </div>
            
            <div className="project-card" onClick={() => window.location.href = '/project/2'}>
              <div className="project-header">
                <h3>科幻短剧《星际迷航》</h3>
                <span className="badge badge-pending">待审核</span>
              </div>
              <p className="project-desc">未来世界，人类探索外太空的神秘冒险故事</p>
              <div className="project-meta">
                <span>共 12 集</span>
                <span>•</span>
                <span>更新至第 10 集</span>
              </div>
            </div>
            
            <div className="project-card" onClick={() => window.location.href = '/project/3'}>
              <div className="project-header">
                <h3>古装剧《大明风华》</h3>
                <span className="badge badge-completed">已完成</span>
              </div>
              <p className="project-desc">明朝历史背景，展现宫廷斗争与人物命运</p>
              <div className="project-meta">
                <span>共 30 集</span>
                <span>•</span>
                <span>已完结</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <style>{`
        .loading-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0a0a0f;
          color: #e5e7eb;
          font-size: 18px;
        }

        .workspace-page {
          min-height: 100vh;
          background: #0a0a0f;
          color: #e5e7eb;
        }

        .topnav {
          height: 64px;
          background: linear-gradient(180deg, rgba(10,10,15,0.98), rgba(10,10,15,0.95));
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255,215,0,0.15);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 32px;
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .topnav-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 18px;
          font-weight: 700;
          color: #ffffff;
        }

        .topnav-logo {
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, #ffd700, #ffb700);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 900;
          color: #0a0a0f;
        }

        .topnav-user {
          display: flex;
          align-items: center;
          gap: 16px;
          font-size: 14px;
          color: #9ca3af;
        }

        .btn-logout {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.15);
          color: #e5e7eb;
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.3s;
        }

        .btn-logout:hover {
          background: rgba(255,255,255,0.12);
          border-color: #ffd700;
        }

        .workspace-content {
          padding: 32px 40px;
          max-width: 1440px;
          margin: 0 auto;
        }

        .welcome-section {
          margin-bottom: 40px;
        }

        .welcome-section h1 {
          font-size: 32px;
          font-weight: 900;
          color: #ffffff;
          margin: 0 0 8px 0;
        }

        .welcome-section p {
          font-size: 14px;
          color: #9ca3af;
          margin: 0;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 24px;
          margin-bottom: 40px;
        }

        .projects-section h2 {
          font-size: 24px;
          font-weight: 700;
          color: #ffffff;
          margin: 0 0 20px 0;
        }

        .projects-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 20px;
        }

        .project-card {
          background: linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02));
          border: 1px solid rgba(255,215,0,0.15);
          border-radius: 16px;
          padding: 24px;
          cursor: pointer;
          transition: all 0.3s;
        }

        .project-card:hover {
          border-color: #ffd700;
          box-shadow: 0 0 20px rgba(255,215,0,0.2);
          transform: translateY(-2px);
        }

        .project-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .project-header h3 {
          font-size: 18px;
          font-weight: 700;
          color: #ffffff;
          margin: 0;
        }

        .badge {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }

        .badge-active {
          background: rgba(34, 197, 94, 0.2);
          color: #22c55e;
          border: 1px solid rgba(34, 197, 94, 0.3);
        }

        .badge-pending {
          background: rgba(255, 215, 0, 0.2);
          color: #ffd700;
          border: 1px solid rgba(255, 215, 0, 0.3);
        }

        .badge-completed {
          background: rgba(107, 114, 128, 0.2);
          color: #9ca3af;
          border: 1px solid rgba(107, 114, 128, 0.3);
        }

        .project-desc {
          font-size: 14px;
          color: #9ca3af;
          margin: 0 0 16px 0;
          line-height: 1.6;
        }

        .project-meta {
          display: flex;
          gap: 8px;
          font-size: 13px;
          color: #6b7280;
        }

        .stat-card {
          background: linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02));
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255,215,0,0.15);
          border-radius: 16px;
          padding: 24px;
          transition: all 0.3s;
        }

        .stat-card:hover {
          border-color: rgba(255,215,0,0.3);
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
          transform: translateY(-2px);
        }

        .stat-label {
          font-size: 14px;
          color: #9ca3af;
          margin-bottom: 12px;
        }

        .stat-value {
          font-size: 48px;
          font-weight: 900;
          color: #ffd700;
          line-height: 1;
          margin-bottom: 8px;
        }

        .stat-desc {
          font-size: 12px;
          color: #6b7280;
        }
      `}</style>
    </div>
  );
};

export default Workspace;
