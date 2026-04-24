/**
 * 分镜相关 API
 * 说明: 分镜的增删改查、AI生成等
 * 版本: v2.0
 */
import api from './index';
import type { Scene, SceneCreate, SceneUpdate, ApiResponse } from '@/types';

export const sceneApi = {
  /**
   * 创建分镜
   */
  create: (data: SceneCreate) => {
    return api.post<any, ApiResponse<Scene>>('/api/scenes/', data);
  },

  /**
   * 获取项目的分镜列表
   */
  getByProject: (projectId: number, episode?: number) => {
    return api.get<any, ApiResponse<Scene[]>>('/api/scenes/', {
      params: { project_id: projectId, episode },
    });
  },

  /**
   * 获取分镜详情
   */
  getDetail: (id: number) => {
    return api.get<any, ApiResponse<Scene>>(`/api/scenes/${id}`);
  },

  /**
   * 更新分镜
   */
  update: (id: number, data: SceneUpdate) => {
    return api.put<any, ApiResponse<Scene>>(`/api/scenes/${id}`, data);
  },

  /**
   * 删除分镜
   */
  delete: (id: number) => {
    return api.delete(`/api/scenes/${id}`);
  },

  /**
   * 生成图片（文生图）
   */
  generateImage: (id: number) => {
    return api.post<any, ApiResponse<{ task_id: number }>>(`/api/scenes/${id}/generate-image`);
  },

  /**
   * 生成视频（图生视频）
   */
  generateVideo: (id: number) => {
    return api.post<any, ApiResponse<{ task_id: number }>>(`/api/scenes/${id}/generate-video`);
  },
};
