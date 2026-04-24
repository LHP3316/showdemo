/**
 * TypeScript 类型定义
 * 说明: 定义所有前端数据结构的类型
 * 版本: v2.0
 */

// ============================================================
// 用户相关类型
// ============================================================

export interface User {
  id: number;
  username: string;
  display_name: string | null;
  role: 'director' | 'staff' | 'writer' | 'reviewer';
  avatar_url: string | null;
  is_active: number;
  last_login: string | null;
  created_at: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

// ============================================================
// 项目相关类型
// ============================================================

export interface Project {
  id: number;
  title: string;
  description: string | null;
  script: string | null;
  genre: string | null;
  episode_count: number | null;
  current_episode: number;
  status: 'draft' | 'processing' | 'review' | 'approved' | 'rejected' | 'exported';
  created_by: number | null;
  assigned_to: number | null;
  deadline: string | null;
  created_at: string;
  updated_at: string;
  scene_count?: number;
  creator?: User;
  assignee?: User;
}

export interface ProjectCreate {
  title: string;
  description?: string;
  script?: string;
  genre?: string;
  episode_count?: number;
  assigned_to?: number;
  deadline?: string;
}

export interface ProjectUpdate {
  title?: string;
  description?: string;
  script?: string;
  genre?: string;
  episode_count?: number;
  current_episode?: number;
  status?: string;
  assigned_to?: number;
  deadline?: string;
}

export interface ProjectStats {
  total: number;
  draft: number;
  processing: number;
  review: number;
  approved: number;
}

// ============================================================
// 分镜相关类型
// ============================================================

export interface Scene {
  id: number;
  project_id: number;
  episode_number: number;
  scene_index: number;
  characters: string | null;
  scene_description: string | null;
  dialogue: string | null;
  camera_angle: string | null;
  emotion: string | null;
  prompt: string | null;
  image_url: string | null;
  video_url: string | null;
  duration: number | null;
  status: 'pending' | 'editing' | 'image_ready' | 'video_ready' | 'accepted';
  created_at: string;
  updated_at: string;
}

export interface SceneCreate {
  project_id: number;
  episode_number?: number;
  scene_index: number;
  characters?: string;
  scene_description?: string;
  dialogue?: string;
  camera_angle?: string;
  emotion?: string;
  prompt?: string;
}

export interface SceneUpdate {
  episode_number?: number;
  scene_index?: number;
  characters?: string;
  scene_description?: string;
  dialogue?: string;
  camera_angle?: string;
  emotion?: string;
  prompt?: string;
  image_url?: string;
  video_url?: string;
  duration?: number;
  status?: string;
}

// ============================================================
// 审核相关类型
// ============================================================

export interface Review {
  id: number;
  project_id: number;
  reviewer_id: number;
  status: 'approved' | 'rejected';
  comment: string | null;
  created_at: string;
  reviewer?: User;
}

export interface ReviewCreate {
  project_id: number;
  status: 'approved' | 'rejected';
  comment?: string;
  scene_comments?: Array<{
    scene_id: number;
    action: 'approved' | 'rejected';
    comment?: string;
  }>;
}

// ============================================================
// 任务队列相关类型
// ============================================================

export interface Task {
  id: number;
  scene_id: number;
  task_type: 'text2img' | 'img2video';
  status: 'pending' | 'processing' | 'success' | 'failed';
  progress: number;
  result_url: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskCreate {
  scene_id: number;
  task_type: 'text2img' | 'img2video';
}

// ============================================================
// Prompt配置相关类型
// ============================================================

export interface PromptConfig {
  id: number;
  type: 'text2img' | 'img2video' | 'img2img';
  name: string | null;
  config: any;
  created_at: string;
}

// ============================================================
// 通用API响应类型
// ============================================================

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data: T;
}

export interface PaginatedResponse<T = any> {
  total: number;
  page: number;
  size: number;
  items: T[];
}

// ============================================================
// 导出资产类型
// ============================================================

export interface AssetItem {
  scene_id: number;
  episode_number: number;
  scene_index: number;
  scene_description: string | null;
  image_url: string | null;
  video_url: string | null;
  status: string;
}

export interface ProjectAssets {
  project_id: number;
  project_title: string;
  episode: number | null;
  total_scenes: number;
  images_count: number;
  videos_count: number;
  assets: AssetItem[];
}
