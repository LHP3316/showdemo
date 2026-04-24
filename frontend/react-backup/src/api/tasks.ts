/**
 * 任务队列 API
 * 说明: AI生成任务的创建、查询、重试等
 * 版本: v2.0
 */
import api from './index';
import type { Task, TaskCreate, ApiResponse, PaginatedResponse } from '@/types';

export const taskApi = {
  /**
   * 创建AI生成任务
   */
  create: (data: TaskCreate) => {
    return api.post<any, ApiResponse<{ task_id: number; status: string }>>('/api/tasks', data);
  },

  /**
   * 获取任务列表（分页）
   */
  getList: (params?: {
    scene_id?: number;
    status?: string;
    task_type?: string;
    page?: number;
    size?: number;
  }) => {
    return api.get<any, ApiResponse<PaginatedResponse<Task>>>('/api/tasks', { params });
  },

  /**
   * 获取任务详情
   */
  getDetail: (id: number) => {
    return api.get<any, ApiResponse<Task>>(`/api/tasks/${id}`);
  },

  /**
   * 删除任务
   */
  delete: (id: number) => {
    return api.delete(`/api/tasks/${id}`);
  },

  /**
   * 重试失败任务
   */
  retry: (id: number) => {
    return api.post<any, ApiResponse<{ task_id: number }>>(`/api/tasks/${id}/retry`);
  },
};
