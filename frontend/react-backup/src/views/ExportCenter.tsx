/**
 * 导出中心
 * 说明: 项目导出、视频合并、下载
 * 版本: v2.0
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface ExportTask {
  id: number;
  project_id: number;
  project_title: string;
  status: 'pending' | 'processing' | 'success' | 'failed';
  file_url?: string;
  created_at: string;
}

const ExportCenter: React.FC = () => {
  const navigate = useNavigate();
  const [exportTasks, setExportTasks] = useState<ExportTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 模拟数据
    setTimeout(() => {
      setExportTasks([
        {
          id: 1,
          project_id: 101,
          project_title: '都市爱情故事',
          status: 'success',
          file_url: '/exports/project-101.mp4',
          created_at: '2026-04-24T10:00:00',
        },
        {
          id: 2,
          project_id: 102,
          project_title: '科幻冒险',
          status: 'processing',
          created_at: '2026-04-24T11:30:00',
        },
      ]);
      setLoading(false);
    }, 500);
  }, []);

  const getStatusText = (status: string) => {
    const map: Record<string, string> = {
      pending: '等待中',
      processing: '导出中',
      success: '已完成',
      failed: '失败',
    };
    return map[status] || status;
  };

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      pending: '#6b7280',
      processing: '#3b82f6',
      success: '#10b981',
      failed: '#ef4444',
    };
    return map[status] || '#6b7280';
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div className="export-center">
      <nav className="topnav">
        <button className="btn-back" onClick={() => navigate('/workspace')}>
          ← 返回
        </button>
        <h1>导出中心</h1>
        <button className="btn-new-export">新建导出</button>
      </nav>

      <main className="export-content">
        {/* 说明卡片 */}
        <div className="info-card">
          <h3>📦 导出说明</h3>
          <ul>
            <li>导出会将所有分镜视频按顺序合并为一个完整视频</li>
            <li>导出过程可能需要几分钟，请耐心等待</li>
            <li>导出完成后可直接下载最终视频文件</li>
          </ul>
        </div>

        {/* 导出任务列表 */}
        <div className="export-list">
          <h3>导出任务</h3>
          {exportTasks.length === 0 ? (
            <div className="empty-state">
              <p>暂无导出任务</p>
              <button className="btn-create">创建第一个导出任务</button>
            </div>
          ) : (
            <div className="task-cards">
              {exportTasks.map(task => (
                <div key={task.id} className="export-card">
                  <div className="card-header">
                    <div>
                      <h4>{task.project_title}</h4>
                      <span className="task-id">任务 #{task.id}</span>
                    </div>
                    <span
                      className="status-badge"
                      style={{
                        backgroundColor: getStatusColor(task.status) + '20',
                        color: getStatusColor(task.status),
                        borderColor: getStatusColor(task.status) + '40',
                      }}
                    >
                      {getStatusText(task.status)}
                    </span>
                  </div>

                  <div className="card-body">
                    <div className="task-meta">
                      <span>项目 ID: {task.project_id}</span>
                      <span>创建时间: {new Date(task.created_at).toLocaleString()}</span>
                    </div>

                    {task.status === 'processing' && (
                      <div className="progress-section">
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: '45%' }}></div>
                        </div>
                        <span className="progress-text">45%</span>
                      </div>
                    )}
                  </div>

                  <div className="card-footer">
                    {task.status === 'success' && task.file_url && (
                      <a href={task.file_url} download className="btn-download">
                        ⬇ 下载视频
                      </a>
                    )}
                    {task.status === 'failed' && (
                      <button className="btn-retry">重新导出</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <style>{`
        .loading {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0a0a0f;
          color: #e5e7eb;
          font-size: 18px;
        }

        .export-center {
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

        .topnav h1 {
          font-size: 20px;
          font-weight: 700;
          color: #ffffff;
          margin: 0;
        }

        .btn-new-export {
          background: linear-gradient(135deg, #ffd700, #ffb700);
          border: none;
          color: #0a0a0f;
          padding: 10px 24px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s;
        }

        .btn-new-export:hover {
          box-shadow: 0 4px 15px rgba(255,215,0,0.3);
          transform: translateY(-2px);
        }

        .export-content {
          padding: 32px 40px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .info-card {
          background: linear-gradient(135deg, rgba(255,215,0,0.08), rgba(255,215,0,0.02));
          border: 1px solid rgba(255,215,0,0.2);
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 32px;
        }

        .info-card h3 {
          font-size: 16px;
          font-weight: 700;
          color: #ffd700;
          margin: 0 0 12px 0;
        }

        .info-card ul {
          margin: 0;
          padding-left: 20px;
          font-size: 14px;
          color: #9ca3af;
          line-height: 1.8;
        }

        .export-list h3 {
          font-size: 20px;
          font-weight: 700;
          color: #ffffff;
          margin: 0 0 24px 0;
        }

        .empty-state {
          text-align: center;
          padding: 60px 20px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
        }

        .empty-state p {
          font-size: 16px;
          color: #9ca3af;
          margin: 0 0 20px 0;
        }

        .btn-create {
          background: linear-gradient(135deg, #ffd700, #ffb700);
          border: none;
          color: #0a0a0f;
          padding: 12px 28px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s;
        }

        .btn-create:hover {
          box-shadow: 0 4px 15px rgba(255,215,0,0.3);
        }

        .task-cards {
          display: grid;
          gap: 20px;
        }

        .export-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          padding: 24px;
          transition: all 0.3s;
        }

        .export-card:hover {
          border-color: rgba(255,215,0,0.3);
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .card-header h4 {
          font-size: 18px;
          font-weight: 700;
          color: #ffffff;
          margin: 0 0 4px 0;
        }

        .task-id {
          font-size: 12px;
          color: #6b7280;
        }

        .status-badge {
          padding: 4px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          border: 1px solid;
        }

        .card-body {
          margin-bottom: 16px;
        }

        .task-meta {
          display: flex;
          gap: 24px;
          font-size: 13px;
          color: #9ca3af;
          margin-bottom: 12px;
        }

        .progress-section {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .progress-bar {
          flex: 1;
          height: 8px;
          background: rgba(255,255,255,0.1);
          border-radius: 4px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #ffd700, #ffb700);
          border-radius: 4px;
          animation: progress 2s ease-in-out infinite;
        }

        @keyframes progress {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }

        .progress-text {
          font-size: 13px;
          font-weight: 600;
          color: #ffd700;
        }

        .card-footer {
          display: flex;
          justify-content: flex-end;
        }

        .btn-download, .btn-retry {
          padding: 10px 24px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
          text-decoration: none;
        }

        .btn-download {
          background: linear-gradient(135deg, #10b981, #059669);
          border: none;
          color: #ffffff;
        }

        .btn-download:hover {
          box-shadow: 0 4px 15px rgba(16,185,129,0.3);
          transform: translateY(-2px);
        }

        .btn-retry {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.15);
          color: #e5e7eb;
        }

        .btn-retry:hover {
          background: rgba(255,255,255,0.12);
          border-color: #ffd700;
        }
      `}</style>
    </div>
  );
};

export default ExportCenter;
