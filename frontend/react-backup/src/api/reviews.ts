/**
 * 审核相关 API
 * 说明: 审核的创建、查询等
 * 版本: v2.0
 */
import api from './index';
import type { Review, ReviewCreate, ApiResponse, PaginatedResponse } from '@/types';

export const reviewApi = {
  /**
   * 创建审核（提交审核结果）
   */
  create: (data: ReviewCreate) => {
    return api.post<any, ApiResponse<Review>>('/api/reviews/', data);
  },

  /**
   * 获取项目的审核列表
   */
  getByProject: (projectId: number) => {
    return api.get<any, ApiResponse<Review[]>>('/api/reviews/', {
      params: { project_id: projectId },
    });
  },

  /**
   * 获取待审核项目列表
   */
  getPendingList: (params?: {
    page?: number;
    size?: number;
  }) => {
    return api.get<any, ApiResponse<PaginatedResponse<Review>>>('/api/reviews/pending', { params });
  },
};
