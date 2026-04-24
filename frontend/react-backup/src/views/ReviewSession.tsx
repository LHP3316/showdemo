/**
 * 审核会话
 * 说明: 导演审核项目，查看分镜并给出审核意见
 * 版本: v2.0
 */
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { reviewsApi, scenesApi } from '@/api';
import { Scene, ReviewComment } from '@/types';

const ReviewSession: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [comments, setComments] = useState<Record<number, string>>({});
  const [actions, setActions] = useState<Record<number, 'approve' | 'revise' | 'reject'>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadScenes();
  }, [id]);

  const loadScenes = async () => {
    try {
      const res = await scenesApi.list(Number(id));
      if (res.data.success) {
        setScenes(res.data.data);
      }
    } catch (error) {
      console.error('加载失败:', error);
    }
  };

  const handleAction = (sceneId: number, action: 'approve' | 'revise' | 'reject') => {
    setActions(prev => ({ ...prev, [sceneId]: action }));
  };

  const handleComment = (sceneId: number, comment: string) => {
    setComments(prev => ({ ...prev, [sceneId]: comment }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // 收集审核意见
      const sceneComments: ReviewComment[] = scenes
        .filter(scene => actions[scene.id])
        .map(scene => ({
          scene_id: scene.id,
          action: actions[scene.id]!,
          comment: comments[scene.id] || '',
        }));

      // 提交审核
      const res = await reviewsApi.create({
        project_id: Number(id),
        status: 'approved',
        comment: '审核完成',
        scene_comments: sceneComments,
      });

      if (res.data.success) {
        alert('审核已提交');
      }
    } catch (error: any) {
      alert('提交失败：' + (error.message || '未知错误'));
    } finally {
      setSubmitting(false);
    }
  };

  if (scenes.length === 0) {
    return <div className="loading">加载中...</div>;
  }

  const currentScene = scenes[currentIndex];

  return (
    <div className="review-session">
      {/* 顶部 */}
      <header className="review-header">
        <h1>审核模式</h1>
        <div className="review-progress">
          <span>{currentIndex + 1} / {scenes.length}</span>
        </div>
        <button
          className="btn-submit"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? '提交中...' : '提交审核'}
        </button>
      </header>

      {/* 内容区 */}
      <main className="review-content">
        {/* 左侧：预览 */}
        <div className="preview-area">
          <div className="preview-media">
            {currentScene.video_url ? (
              <video src={currentScene.video_url} controls />
            ) : currentScene.image_url ? (
              <img src={currentScene.image_url} alt="分镜" />
            ) : (
              <div className="preview-empty">等待生成</div>
            )}
          </div>
          <div className="preview-info">
            <h3>SC-{currentScene.scene_index}</h3>
            {currentScene.scene_description && (
              <p>{currentScene.scene_description}</p>
            )}
          </div>
        </div>

        {/* 右侧：审核操作 */}
        <div className="review-actions">
          <h2>审核操作</h2>
          
          <div className="action-buttons">
            <button
              className={`btn-action approve ${actions[currentScene.id] === 'approve' ? 'active' : ''}`}
              onClick={() => handleAction(currentScene.id, 'approve')}
            >
              ✓ 通过
            </button>
            <button
              className={`btn-action revise ${actions[currentScene.id] === 'revise' ? 'active' : ''}`}
              onClick={() => handleAction(currentScene.id, 'revise')}
            >
              ↻ 修改
            </button>
            <button
              className={`btn-action reject ${actions[currentScene.id] === 'reject' ? 'active' : ''}`}
              onClick={() => handleAction(currentScene.id, 'reject')}
            >
              ✗ 拒绝
            </button>
          </div>

          <div className="comment-section">
            <label>审核意见</label>
            <textarea
              value={comments[currentScene.id] || ''}
              onChange={(e) => handleComment(currentScene.id, e.target.value)}
              placeholder="输入审核意见..."
              rows={6}
            />
          </div>

          {/* 导航 */}
          <div className="review-nav">
            <button
              className="btn-nav"
              onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
            >
              ← 上一个
            </button>
            <button
              className="btn-nav"
              onClick={() => setCurrentIndex(Math.min(scenes.length - 1, currentIndex + 1))}
              disabled={currentIndex === scenes.length - 1}
            >
              下一个 →
            </button>
          </div>
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

        .review-session {
          min-height: 100vh;
          background: #0a0a0f;
          color: #e5e7eb;
          display: flex;
          flex-direction: column;
        }

        .review-header {
          height: 64px;
          background: linear-gradient(180deg, rgba(10,10,15,0.98), rgba(10,10,15,0.95));
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255,215,0,0.15);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 32px;
        }

        .review-header h1 {
          font-size: 20px;
          font-weight: 700;
          color: #ffffff;
          margin: 0;
        }

        .review-progress span {
          font-size: 14px;
          color: #9ca3af;
        }

        .btn-submit {
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

        .btn-submit:hover:not(:disabled) {
          box-shadow: 0 4px 15px rgba(255,215,0,0.3);
          transform: translateY(-2px);
        }

        .btn-submit:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .review-content {
          flex: 1;
          display: flex;
          gap: 32px;
          padding: 32px;
        }

        .preview-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .preview-media {
          flex: 1;
          background: #12121a;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .preview-media img,
        .preview-media video {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }

        .preview-empty {
          color: #6b7280;
          font-size: 18px;
        }

        .preview-info h3 {
          font-size: 20px;
          font-weight: 700;
          color: #ffd700;
          margin: 0 0 12px 0;
        }

        .preview-info p {
          font-size: 14px;
          color: #9ca3af;
          margin: 0;
          line-height: 1.6;
        }

        .review-actions {
          width: 400px;
          background: #12121a;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          padding: 32px;
        }

        .review-actions h2 {
          font-size: 18px;
          font-weight: 700;
          color: #ffffff;
          margin: 0 0 24px 0;
        }

        .action-buttons {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
        }

        .btn-action {
          flex: 1;
          padding: 12px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
          border: 2px solid;
        }

        .btn-action.approve {
          background: rgba(16, 185, 129, 0.1);
          border-color: #10b981;
          color: #10b981;
        }

        .btn-action.approve.active {
          background: #10b981;
          color: #ffffff;
        }

        .btn-action.revise {
          background: rgba(245, 158, 11, 0.1);
          border-color: #f59e0b;
          color: #f59e0b;
        }

        .btn-action.revise.active {
          background: #f59e0b;
          color: #ffffff;
        }

        .btn-action.reject {
          background: rgba(239, 68, 68, 0.1);
          border-color: #ef4444;
          color: #ef4444;
        }

        .btn-action.reject.active {
          background: #ef4444;
          color: #ffffff;
        }

        .comment-section {
          margin-bottom: 24px;
        }

        .comment-section label {
          display: block;
          font-size: 14px;
          font-weight: 600;
          color: #9ca3af;
          margin-bottom: 8px;
        }

        .comment-section textarea {
          width: 100%;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 8px;
          padding: 12px;
          font-size: 14px;
          color: #e5e7eb;
          resize: none;
          font-family: inherit;
        }

        .review-nav {
          display: flex;
          gap: 12px;
        }

        .btn-nav {
          flex: 1;
          padding: 10px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.15);
          color: #e5e7eb;
        }

        .btn-nav:hover:not(:disabled) {
          background: rgba(255,255,255,0.12);
          border-color: #ffd700;
        }

        .btn-nav:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default ReviewSession;
