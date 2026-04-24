/**
 * 项目驾驶舱
 * 说明: 项目详情、进度追踪、分镜管理入口
 * 版本: v2.0
 */
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { projectsApi, scenesApi } from '@/api';
import { Project, Scene } from '@/types';

const ProjectCockpit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProject();
  }, [id]);

  const loadProject = async () => {
    try {
      const [projectRes, scenesRes] = await Promise.all([
        projectsApi.getById(Number(id)),
        scenesApi.list(Number(id))
      ]);

      if (projectRes.data.success) {
        setProject(projectRes.data.data);
      }
      if (scenesRes.data.success) {
        setScenes(scenesRes.data.data);
      }
    } catch (error) {
      console.error('加载失败:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  if (!project) {
    return <div className="error">项目不存在</div>;
  }

  const getProgress = () => {
    const total = scenes.length;
    const completed = scenes.filter(s => s.status === 'video_ready').length;
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      draft: { color: '#6b7280', text: '草稿' },
      processing: { color: '#3b82f6', text: '制作中' },
      review: { color: '#f59e0b', text: '审核中' },
      approved: { color: '#10b981', text: '已通过' },
      rejected: { color: '#ef4444', text: '已驳回' },
    };
    const config = statusMap[status] || { color: '#6b7280', text: status };
    return (
      <span className="status-badge" style={{ backgroundColor: config.color + '20', color: config.color, borderColor: config.color + '40' }}>
        {config.text}
      </span>
    );
  };

  return (
    <div className="project-cockpit">
      {/* 顶部导航 */}
      <nav className="topnav">
        <div className="topnav-left">
          <button className="btn-back" onClick={() => navigate('/workspace')}>
            ← 返回
          </button>
          <h1 className="topnav-title">{project.title}</h1>
        </div>
        <div className="topnav-actions">
          <button className="btn-secondary" onClick={() => navigate(`/project/${id}/script`)}>
            剧本编辑
          </button>
          <button className="btn-primary" onClick={() => navigate(`/project/${id}/storyboard`)}>
            分镜工作台
          </button>
        </div>
      </nav>

      {/* 项目信息 */}
      <main className="cockpit-content">
        <div className="project-header">
          <div className="project-info">
            <h2>{project.title}</h2>
            {project.description && <p className="project-desc">{project.description}</p>}
            <div className="project-meta">
              {project.genre && <span className="meta-tag">{project.genre}</span>}
              {project.episode_count && <span className="meta-tag">{project.episode_count}集</span>}
              {getStatusBadge(project.status)}
            </div>
          </div>

          {/* 进度环 */}
          <div className="progress-ring">
            <svg className="ring-svg" viewBox="0 0 120 120">
              <circle
                className="ring-bg"
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="8"
              />
              <circle
                className="ring-progress"
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke="#ffd700"
                strokeWidth="8"
                strokeDasharray={`${getProgress() * 3.39} 339`}
                strokeLinecap="round"
                transform="rotate(-90 60 60)"
              />
            </svg>
            <div className="ring-text">
              <div className="ring-percent">{getProgress()}%</div>
              <div className="ring-label">完成</div>
            </div>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="stats-row">
          <div className="stat-item">
            <div className="stat-num">{scenes.length}</div>
            <div className="stat-label">总分镜</div>
          </div>
          <div className="stat-item">
            <div className="stat-num">{scenes.filter(s => s.image_url).length}</div>
            <div className="stat-label">已生成图片</div>
          </div>
          <div className="stat-item">
            <div className="stat-num">{scenes.filter(s => s.video_url).length}</div>
            <div className="stat-label">已生成视频</div>
          </div>
          <div className="stat-item">
            <div className="stat-num">{project.deadline ? Math.ceil((new Date(project.deadline).getTime() - Date.now()) / 86400000) : '--'}</div>
            <div className="stat-label">剩余天数</div>
          </div>
        </div>

        {/* 分镜列表 */}
        <div className="scenes-section">
          <h3>分镜列表</h3>
          <div className="scenes-grid">
            {scenes.map((scene) => (
              <div
                key={scene.id}
                className="scene-card"
                onClick={() => navigate(`/project/${id}/storyboard?scene=${scene.id}`)}
              >
                <div className="scene-thumb">
                  {scene.image_url ? (
                    <img src={scene.image_url} alt={`分镜${scene.scene_index}`} />
                  ) : (
                    <div className="scene-placeholder">
                      <span>SC-{scene.scene_index}</span>
                    </div>
                  )}
                </div>
                <div className="scene-info">
                  <div className="scene-header">
                    <span className="scene-index">#{scene.scene_index}</span>
                    <span className="scene-status">
                      {scene.status === 'video_ready' ? '✅' : scene.status === 'image_ready' ? '🖼️' : '⏳'}
                    </span>
                  </div>
                  {scene.scene_description && (
                    <p className="scene-desc">{scene.scene_description.substring(0, 50)}...</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <style>{`
        .loading, .error {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0a0a0f;
          color: #e5e7eb;
          font-size: 18px;
        }

        .error {
          color: #ef4444;
        }

        .project-cockpit {
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

        .topnav-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .btn-back {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.15);
          color: #e5e7eb;
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.3s;
        }

        .btn-back:hover {
          background: rgba(255,255,255,0.12);
          border-color: #ffd700;
        }

        .topnav-title {
          font-size: 20px;
          font-weight: 700;
          color: #ffffff;
          margin: 0;
        }

        .topnav-actions {
          display: flex;
          gap: 12px;
        }

        .btn-secondary, .btn-primary {
          padding: 8px 20px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
        }

        .btn-secondary {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.15);
          color: #e5e7eb;
        }

        .btn-secondary:hover {
          background: rgba(255,255,255,0.12);
        }

        .btn-primary {
          background: linear-gradient(135deg, #ffd700, #ffb700);
          border: none;
          color: #0a0a0f;
        }

        .btn-primary:hover {
          box-shadow: 0 4px 15px rgba(255,215,0,0.3);
          transform: translateY(-2px);
        }

        .cockpit-content {
          padding: 32px 40px;
          max-width: 1440px;
          margin: 0 auto;
        }

        .project-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 40px;
          gap: 40px;
        }

        .project-info h2 {
          font-size: 32px;
          font-weight: 900;
          color: #ffffff;
          margin: 0 0 12px 0;
        }

        .project-desc {
          font-size: 14px;
          color: #9ca3af;
          margin: 0 0 16px 0;
          line-height: 1.6;
        }

        .project-meta {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .meta-tag {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.15);
          padding: 4px 12px;
          border-radius: 6px;
          font-size: 12px;
          color: #9ca3af;
        }

        .status-badge {
          padding: 4px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          border: 1px solid;
        }

        .progress-ring {
          position: relative;
          width: 120px;
          height: 120px;
        }

        .ring-svg {
          width: 100%;
          height: 100%;
        }

        .ring-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
        }

        .ring-percent {
          font-size: 28px;
          font-weight: 900;
          color: #ffd700;
          line-height: 1;
        }

        .ring-label {
          font-size: 12px;
          color: #9ca3af;
          margin-top: 4px;
        }

        .stats-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px;
          margin-bottom: 48px;
        }

        .stat-item {
          background: linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02));
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255,215,0,0.15);
          border-radius: 16px;
          padding: 24px;
          text-align: center;
          transition: all 0.3s;
        }

        .stat-item:hover {
          border-color: rgba(255,215,0,0.3);
          transform: translateY(-2px);
        }

        .stat-num {
          font-size: 48px;
          font-weight: 900;
          color: #ffd700;
          line-height: 1;
          margin-bottom: 8px;
        }

        .stat-label {
          font-size: 13px;
          color: #9ca3af;
        }

        .scenes-section h3 {
          font-size: 24px;
          font-weight: 700;
          color: #ffffff;
          margin: 0 0 24px 0;
        }

        .scenes-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 20px;
        }

        .scene-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.3s;
        }

        .scene-card:hover {
          border-color: rgba(255,215,0,0.3);
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
          transform: translateY(-4px);
        }

        .scene-thumb {
          width: 100%;
          aspect-ratio: 16/9;
          background: #12121a;
        }

        .scene-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .scene-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 600;
          color: #6b7280;
        }

        .scene-info {
          padding: 12px;
        }

        .scene-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .scene-index {
          font-size: 13px;
          font-weight: 700;
          color: #ffd700;
        }

        .scene-status {
          font-size: 16px;
        }

        .scene-desc {
          font-size: 12px;
          color: #9ca3af;
          margin: 0;
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
};

export default ProjectCockpit;
