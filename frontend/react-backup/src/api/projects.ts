/**
 * 项目相关 API
 * 说明: 项目的增删改查、分配、拆解等
 * 版本: v2.0
 */
import api from './index';
import type {
  Project,
  ProjectCreate,
  ProjectUpdate,
  ProjectStats,
  Scene,
  ApiResponse,
  PaginatedResponse,
} from '@/types';

export const projectApi = {
  /**
   * 创建项目
   */
  create: (data: ProjectCreate) => {
    return api.post<any, ApiResponse<{ id: number; title: string; status: string }>>('/projects/', data);
  },

  /**
   * 获取项目列表（分页）
   */
  getList: (params?: {
    status_filter?: string;
    genre_filter?: string;
    assigned_to?: number;
    page?: number;
    size?: number;
  }) => {
    return api.get<any, ApiResponse<PaginatedResponse<Project>>>('/projects/', { params });
  },

  /**
   * 获取项目统计
   */
  getStats: () => {
    return api.get<any, ApiResponse<ProjectStats>>('/projects/stats');
  },

  /**
   * 获取项目详情（包含分镜）
   */
  getDetail: (id: number) => {
    return api.get<any, ApiResponse<Project & { scenes: Scene[]; scene_count: number }>>(`/projects/${id}`);
  },

  /**
   * 更新项目
   */
  update: (id: number, data: ProjectUpdate) => {
    return api.put<any, ApiResponse<{ id: number }>>(`/projects/${id}`, data);
  },

  /**
   * 删除项目
   */
  delete: (id: number) => {
    return api.delete(`/projects/${id}`);
  },

  /**
   * AI 拆解剧本
   */
  decompose: (id: number) => {
    return api.post<any, ApiResponse<{ scene_count: number; scenes: any[] }>>(`/projects/${id}/decompose`);
  },

  /**
   * 分配项目给工作人员
   */
  assign: (id: number, assigned_to: number) => {
    return api.put<any, ApiResponse<{ project_id: number; assigned_to: number; assignee_name: string }>>(
      `/projects/${id}/assign`,
      null,
      { params: { assigned_to } }
    );
  },

  /**
   * 提交审核
   */
  submitReview: (id: number) => {
    return api.post<any, ApiResponse<{ project_id: number; status: string }>>(`/projects/${id}/submit-review`);
  },
};
