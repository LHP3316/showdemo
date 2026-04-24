/**
 * 渲染队列
 * 说明: 查看AI生成任务进度
 * 版本: v2.0
 */
import React, { useEffect, useState } from 'react';
import { tasksApi } from '@/api';
import { TaskQueue } from '@/types';

const RenderQueue: React.FC = () => {
  const [tasks, setTasks] = useState<TaskQueue[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadTasks();
    const interval = setInterval(loadTasks, 5000); // 5秒刷新
    return () => clearInterval(interval);
  }, []);

  const loadTasks = async () => {
    try {
      const res = await tasksApi.list();
      if (res.data.success) {
        setTasks(res.data.data);
      }
    } catch (error) {
      console.error('加载失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTasks = filter === 'all'
    ? tasks
    : tasks.filter(t => t.status === filter);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'processing': return '⚙️';
      case 'success': return '✅';
      case 'failed': return '❌';
      default: return '·';
    }
  };

  const getStatusText = (status: string) => {
    const map: Record<string, string> = {
      pending: '等待中',
      processing: '处理中',
      success: '成功',
      failed: '失败',
    };
    return map[status] || status;
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div className="render-queue">
      <nav className="topnav">
        <h1>渲染队列</h1>
        <div className="filters">
          {['all', 'pending', 'processing', 'success', 'failed'].map(f => (
            <button
              key={f}
              className={`filter-btn ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? '全部' : getStatusText(f)}
            </button>
          ))}
        </div>
      </nav>

      <main className="queue-content">
        <div className="stats-bar">
          <div className="stat">
            <span className="stat-num">{tasks.length}</span>
            <span className="stat-label">总任务</span>
          </div>
          <div className="stat">
            <span className="stat-num processing">{tasks.filter(t => t.status === 'processing').length}</span>
            <span className="stat-label">处理中</span>
          </div>
          <div className="stat">
            <span className="stat-num success">{tasks.filter(t => t.status === 'success').length}</span>
            <span className="stat-label">成功</span>
          </div>
          <div className="stat">
            <span className="stat-num failed">{tasks.filter(t => t.status === 'failed').length}</span>
            <span className="stat-label">失败</span>
          </div>
        </div>

        <div className="task-list">
          {filteredTasks.map(task => (
            <div key={task.id} className="task-card">
              <div className="task-header">
                <span className="task-id">#{task.id}</span>
                <span className="task-status">
                  {getStatusIcon(task.status)} {getStatusText(task.status)}
                </span>
              </div>
              <div className="task-body">
                <div className="task-info">
                  <span className="task-type">{task.task_type === 'text2img' ? '文生图' : '图生视频'}</span>
                  <span className="task-scene">分镜 #{task.scene_id}</span>
                </div>
                <div className="task-progress">
                  {task.status === 'processing' && (
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: '60%' }}></div>
                    </div>
                  )}
                </div>
                {task.error_message && (
                  <div className="task-error">{task.error_message}</div>
                )}
              </div>
              <div className="task-footer">
                <span className="task-time">{new Date(task.created_at).toLocaleString()}</span>
                {task.status === 'failed' && (
                  <button className="btn-retry">重试</button>
                )}
              </div>
            </div>
          ))}
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

        .render-queue {
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

        .topnav h1 {
          font-size: 20px;
          font-weight: 700;
          color: #ffffff;
          margin: 0;
        }

        .filters {
          display: flex;
          gap: 8px;
        }

        .filter-btn {
          padding: 6px 16px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.15);
          color: #9ca3af;
        }

        .filter-btn.active {
          background: rgba(255,215,0,0.15);
          border-color: #ffd700;
          color: #ffd700;
        }

        .queue-content {
          padding: 32px 40px;
          max-width: 1440px;
          margin: 0 auto;
        }

        .stats-bar {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          margin-bottom: 32px;
        }

        .stat {
          background: linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02));
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255,215,0,0.15);
          border-radius: 12px;
          padding: 20px;
          text-align: center;
        }

        .stat-num {
          display: block;
          font-size: 36px;
          font-weight: 900;
          color: #ffd700;
          line-height: 1;
          margin-bottom: 8px;
        }

        .stat-num.processing { color: #3b82f6; }
        .stat-num.success { color: #10b981; }
        .stat-num.failed { color: #ef4444; }

        .stat-label {
          font-size: 13px;
          color: #9ca3af;
        }

        .task-list {
          display: grid;
          gap: 16px;
        }

        .task-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          padding: 20px;
          transition: all 0.3s;
        }

        .task-card:hover {
          border-color: rgba(255,215,0,0.3);
        }

        .task-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .task-id {
          font-size: 14px;
          font-weight: 700;
          color: #ffd700;
        }

        .task-status {
          font-size: 13px;
          color: #9ca3af;
        }

        .task-body {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 12px;
        }

        .task-info {
          display: flex;
          gap: 16px;
        }

        .task-type, .task-scene {
          font-size: 13px;
          color: #e5e7eb;
        }

        .progress-bar {
          height: 6px;
          background: rgba(255,255,255,0.1);
          border-radius: 3px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #ffd700, #ffb700);
          border-radius: 3px;
          animation: progress 2s ease-in-out infinite;
        }

        @keyframes progress {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }

        .task-error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #ef4444;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 12px;
        }

        .task-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .task-time {
          font-size: 12px;
          color: #6b7280;
        }

        .btn-retry {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.15);
          color: #e5e7eb;
          padding: 6px 16px;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.3s;
        }

        .btn-retry:hover {
          background: rgba(255,255,255,0.12);
          border-color: #ffd700;
        }
      `}</style>
    </div>
  );
};

export default RenderQueue;
