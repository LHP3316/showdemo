/**
 * Axios 实例配置
 * 说明: 配置统一的 HTTP 客户端，包含请求/响应拦截器
 * 版本: v2.0
 */
import axios from 'axios';
import type { AxiosInstance } from 'axios';

// 创建 axios 实例
const api: AxiosInstance = axios.create({
  baseURL: 'http://localhost:8000',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 - 自动添加 Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器 - 统一错误处理
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // 处理 401 未授权（排除登录接口）
    if (error.response?.status === 401) {
      // 如果不是登录请求，才清除 token 并跳转
      if (!error.config?.url?.includes('/auth/login')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(new Error('登录已过期，请重新登录'));
      }
    }

    // 处理其他错误
    const message = error.response?.data?.detail || error.message || '请求失败';
    return Promise.reject(new Error(message));
  }
);

export default api;

// 导出各个 API 模块
export * from './auth';
export * from './projects';
export * from './scenes';
export * from './tasks';
export * from './reviews';
