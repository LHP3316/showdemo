/**
 * 分镜工作台
 * 说明: 分镜编辑、AI生成、审核管理
 * 版本: v2.0
 */
import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { scenesApi } from '@/api';
import { Scene } from '@/types';

const StoryboardWorkbench: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadScenes();
  }, [id]);

  useEffect(() => {
    const sceneId = searchParams.get('scene');
    if (sceneId && scenes.length > 0) {
      const scene = scenes.find(s => s.id === Number(sceneId));
      if (scene) setSelectedScene(scene);
    }
  }, [searchParams, scenes]);

  const loadScenes = async () => {
    try {
      const res = await scenesApi.list(Number(id));
      if (res.data.success) {
        setScenes(res.data.data);
      }
    } catch (error) {
      console.error('加载失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!selectedScene) return;
    
    setGenerating(true);
    try {
      const res = await scenesApi.generateImage(selectedScene.id);
      if (res.data.success) {
        // 重新加载
        loadScenes();
        alert('图片生成成功！');
      }
    } catch (error: any) {
      alert('生成失败：' + (error.message || '未知错误'));
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!selectedScene) return;
    
    setGenerating(true);
    try {
      const res = await scenesApi.generateVideo(selectedScene.id);
      if (res.data.success) {
        loadScenes();
        alert('视频生成成功！');
      }
    } catch (error: any) {
      alert('生成失败：' + (error.message || '未知错误'));
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div className="storyboard-workbench">
      {/* 左侧分镜列表 */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>分镜列表</h2>
          <span className="count">{scenes.length}</span>
        </div>
        <div className="sidebar-list">
          {scenes.map((scene) => (
            <div
              key={scene.id}
              className={`sidebar-item ${selectedScene?.id === scene.id ? 'active' : ''}`}
              onClick={() => setSelectedScene(scene)}
            >
              <div className="item-thumb">
                {scene.image_url ? (
                  <img src={scene.image_url} alt="" />
                ) : (
                  <div className="item-placeholder">#{scene.scene_index}</div>
                )}
              </div>
              <div className="item-info">
                <div className="item-header">
                  <span className="item-index">SC-{scene.scene_index}</span>
                  <span className="item-status">
                    {scene.status === 'video_ready' ? '✓' : scene.status === 'image_ready' ? '○' : '·'}
                  </span>
                </div>
                {scene.dialogue && (
                  <p className="item-dialogue">{scene.dialogue.substring(0, 30)}...</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* 右侧编辑区 */}
      <main className="workbench-main">
        {selectedScene ? (
          <>
            {/* 顶部工具栏 */}
            <div className="toolbar">
              <h3>分镜 #{selectedScene.scene_index}</h3>
              <div className="toolbar-actions">
                <button
                  className="btn-generate"
                  onClick={handleGenerateImage}
                  disabled={generating || !selectedScene.prompt}
                >
                  {generating ? '生成中...' : '生成图片'}
                </button>
                <button
                  className="btn-generate-video"
                  onClick={handleGenerateVideo}
                  disabled={generating || !selectedScene.image_url}
                >
                  生成视频
                </button>
              </div>
            </div>

            {/* 内容区 */}
            <div className="content-area">
              {/* 预览区 */}
              <div className="preview-section">
                <div className="preview-container">
                  {selectedScene.image_url ? (
                    <img src={selectedScene.image_url} alt="分镜图片" className="preview-image" />
                  ) : (
                    <div className="preview-placeholder">
                      <span>等待生成</span>
                    </div>
                  )}
                </div>
                {selectedScene.video_url && (
                  <div className="video-container">
                    <video src={selectedScene.video_url} controls className="preview-video" />
                  </div>
                )}
              </div>

              {/* 信息区 */}
              <div className="info-section">
                <div className="info-group">
                  <label>场景描述</label>
                  <p className="info-value">{selectedScene.scene_description || '无'}</p>
                </div>
                <div className="info-group">
                  <label>角色</label>
                  <p className="info-value">{selectedScene.characters || '无'}</p>
                </div>
                <div className="info-group">
                  <label>对话</label>
                  <p className="info-value">{selectedScene.dialogue || '无'}</p>
                </div>
                <div className="info-group">
                  <label>镜头角度</label>
                  <p className="info-value">{selectedScene.camera_angle || '无'}</p>
                </div>
                <div className="info-group">
                  <label>情绪</label>
                  <p className="info-value">{selectedScene.emotion || '无'}</p>
                </div>
                <div className="info-group">
                  <label>Prompt</label>
                  <textarea
                    className="prompt-input"
                    value={selectedScene.prompt || ''}
                    readOnly
                    rows={4}
                  />
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <h3>选择一个分镜开始编辑</h3>
            <p>从左侧列表选择一个分镜查看详情</p>
          </div>
        )}
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

        .storyboard-workbench {
          display: flex;
          height: 100vh;
          background: #0a0a0f;
          color: #e5e7eb;
        }

        .sidebar {
          width: 320px;
          background: #12121a;
          border-right: 1px solid rgba(255,215,0,0.15);
          display: flex;
          flex-direction: column;
        }

        .sidebar-header {
          padding: 24px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .sidebar-header h2 {
          font-size: 18px;
          font-weight: 700;
          color: #ffffff;
          margin: 0;
        }

        .count {
          background: rgba(255,215,0,0.15);
          color: #ffd700;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 600;
        }

        .sidebar-list {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .sidebar-item {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          padding: 12px;
          margin-bottom: 12px;
          cursor: pointer;
          transition: all 0.3s;
        }

        .sidebar-item:hover {
          background: rgba(255,255,255,0.06);
          border-color: rgba(255,215,0,0.2);
        }

        .sidebar-item.active {
          background: rgba(255,215,0,0.08);
          border-color: #ffd700;
        }

        .item-thumb {
          width: 100%;
          aspect-ratio: 16/9;
          background: #1a1a24;
          border-radius: 6px;
          margin-bottom: 10px;
          overflow: hidden;
        }

        .item-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .item-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 600;
          color: #6b7280;
        }

        .item-info {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .item-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .item-index {
          font-size: 13px;
          font-weight: 700;
          color: #ffd700;
        }

        .item-status {
          font-size: 16px;
          color: #10b981;
        }

        .item-dialogue {
          font-size: 12px;
          color: #9ca3af;
          margin: 0;
          line-height: 1.4;
        }

        .workbench-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .toolbar {
          height: 64px;
          background: linear-gradient(180deg, rgba(10,10,15,0.98), rgba(10,10,15,0.95));
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255,215,0,0.15);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 32px;
        }

        .toolbar h3 {
          font-size: 20px;
          font-weight: 700;
          color: #ffffff;
          margin: 0;
        }

        .toolbar-actions {
          display: flex;
          gap: 12px;
        }

        .btn-generate, .btn-generate-video {
          padding: 8px 20px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
        }

        .btn-generate {
          background: linear-gradient(135deg, #ffd700, #ffb700);
          border: none;
          color: #0a0a0f;
        }

        .btn-generate:hover:not(:disabled) {
          box-shadow: 0 4px 15px rgba(255,215,0,0.3);
          transform: translateY(-2px);
        }

        .btn-generate:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-generate-video {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.15);
          color: #e5e7eb;
        }

        .btn-generate-video:hover:not(:disabled) {
          background: rgba(255,255,255,0.12);
          border-color: #ffd700;
        }

        .content-area {
          flex: 1;
          display: flex;
          gap: 32px;
          padding: 32px;
          overflow: hidden;
        }

        .preview-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .preview-container {
          flex: 1;
          background: #12121a;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .preview-image {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }

        .preview-placeholder {
          color: #6b7280;
          font-size: 16px;
        }

        .video-container {
          height: 200px;
          background: #12121a;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          overflow: hidden;
        }

        .preview-video {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .info-section {
          width: 360px;
          background: #12121a;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          padding: 24px;
          overflow-y: auto;
        }

        .info-group {
          margin-bottom: 20px;
        }

        .info-group label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: #9ca3af;
          margin-bottom: 8px;
        }

        .info-value {
          font-size: 14px;
          color: #e5e7eb;
          margin: 0;
          line-height: 1.6;
        }

        .prompt-input {
          width: 100%;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 8px;
          padding: 12px;
          font-size: 13px;
          color: #e5e7eb;
          font-family: monospace;
          resize: none;
        }

        .empty-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
        }

        .empty-state h3 {
          font-size: 24px;
          font-weight: 700;
          color: #ffffff;
          margin: 0;
        }

        .empty-state p {
          font-size: 14px;
          color: #9ca3af;
          margin: 0;
        }
      `}</style>
    </div>
  );
};

export default StoryboardWorkbench;
