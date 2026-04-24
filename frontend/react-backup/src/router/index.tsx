/**
 * 路由配置
 * 说明: 定义所有页面路由和权限守卫
 * 版本: v2.0
 */
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { useAuth } from '@/store/AuthContext';

// 页面组件（懒加载）
const Login = React.lazy(() => import('@/views/Login'));
const Workspace = React.lazy(() => import('@/views/Workspace'));
const ProjectCockpit = React.lazy(() => import('@/views/ProjectCockpit'));
const ScriptWorkbench = React.lazy(() => import('@/views/Placeholder'));
const StoryboardWorkbench = React.lazy(() => import('@/views/StoryboardWorkbench'));
const RenderQueue = React.lazy(() => import('@/views/RenderQueue'));
const ReviewSession = React.lazy(() => import('@/views/ReviewSession'));
const ExportCenter = React.lazy(() => import('@/views/ExportCenter'));

// 权限守卫组件
const ProtectedRoute: React.FC<{ children: React.ReactNode; requiredRole?: string }> = ({ 
  children, 
  requiredRole 
}) => {
  const { isAuthenticated, user } = useAuth();
  const [loading, setLoading] = React.useState(true);

  // 等待 AuthContext 初始化
  React.useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 100);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to="/workspace" replace />;
  }

  return <>{children}</>;
};

// 路由配置
const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <React.Suspense fallback={<div className="loading">加载中...</div>}>
        <Routes>
          {/* 公开路由 */}
          <Route path="/login" element={<Login />} />

          {/* 保护路由 */}
          <Route
            path="/workspace"
            element={
              <ProtectedRoute>
                <Workspace />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/project/:id"
            element={
              <ProtectedRoute>
                <ProjectCockpit />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/project/:id/script"
            element={
              <ProtectedRoute>
                <ScriptWorkbench title="剧本工作台" />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/project/:id/storyboard"
            element={
              <ProtectedRoute>
                <StoryboardWorkbench />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/project/:id/render"
            element={
              <ProtectedRoute>
                <RenderQueue />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/project/:id/review"
            element={
              <ProtectedRoute requiredRole="director">
                <ReviewSession />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/project/:id/export"
            element={
              <ProtectedRoute>
                <ExportCenter />
              </ProtectedRoute>
            }
          />

          {/* 默认重定向 */}
          <Route path="*" element={<Navigate to="/workspace" replace />} />
        </Routes>
      </React.Suspense>
    </BrowserRouter>
  );
};

export default AppRouter;
