/**
 * 认证相关 API
 * 说明: 用户登录、注册、登出等
 * 版本: v2.0
 */
import api from './index';
import type { LoginRequest, LoginResponse, User, ApiResponse } from '@/types';

export const authApi = {
  /**
   * 用户登录
   */
  login: (data: LoginRequest) => {
    return api.post<any, LoginResponse>('/auth/login', data);
  },

  /**
   * 获取当前用户信息
   */
  getCurrentUser: () => {
    return api.get<any, ApiResponse<User>>('/auth/me');
  },

  /**
   * 用户注册（仅导演可注册）
   */
  register: (data: LoginRequest & { role?: string }) => {
    return api.post<any, ApiResponse<User>>('/auth/register', data);
  },
};
