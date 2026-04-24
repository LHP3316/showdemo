/**
 * 登录页
 * 说明: 用户登录界面，电影工业风设计
 * 版本: v2.0
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/store/AuthContext';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      navigate('/workspace');
    } catch (err: any) {
      setError(err.message || '登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* 背景光效 */}
      <div className="login-bg-effects">
        <div className="bg-effect effect-1"></div>
        <div className="bg-effect effect-2"></div>
      </div>

      {/* 登录卡片 */}
      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <div className="logo-icon glow-pulse">AI</div>
          <h1 className="login-title">短剧协作台</h1>
          <p className="login-subtitle">电影工业级创作协作平台</p>
        </div>

        {/* 登录表单 */}
        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label className="form-label">账号</label>
            <input
              type="text"
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入您的账号"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">密码</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入您的密码"
              required
            />
          </div>

          <button
            type="submit"
            className="btn-login"
            disabled={loading}
          >
            {loading ? '登录中...' : '立即登录'}
          </button>

          <div className="login-footer">
            <span>忘记密码？</span>
            <span className="divider">·</span>
            <span>联系管理员</span>
          </div>
        </form>
      </div>

      {/* 内联样式 */}
      <style>{`
        .login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #0a0a0f 0%, #12121a 100%);
          position: relative;
          overflow: hidden;
          padding: 20px;
        }

        .login-bg-effects {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .bg-effect {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
          opacity: 0.08;
        }

        .effect-1 {
          width: 600px;
          height: 600px;
          background: #ffd700;
          top: -200px;
          left: -200px;
        }

        .effect-2 {
          width: 500px;
          height: 500px;
          background: #ff8c00;
          bottom: -150px;
          right: -150px;
        }

        .login-card {
          background: linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02));
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255,215,0,0.15);
          border-radius: 24px;
          padding: 48px;
          width: 100%;
          max-width: 440px;
          position: relative;
          z-index: 1;
          animation: fadeIn 0.6s ease-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .login-logo {
          text-align: center;
          margin-bottom: 40px;
        }

        .logo-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, #ffd700, #ffb700);
          border-radius: 20px;
          font-size: 32px;
          font-weight: 900;
          color: #0a0a0f;
          margin-bottom: 24px;
        }

        .glow-pulse {
          animation: glowPulse 3s ease-in-out infinite;
        }

        @keyframes glowPulse {
          0%, 100% {
            box-shadow: 0 0 20px rgba(255,215,0,0.3);
          }
          50% {
            box-shadow: 0 0 40px rgba(255,215,0,0.5);
          }
        }

        .login-title {
          font-size: 36px;
          font-weight: 900;
          color: #ffffff;
          margin: 0 0 8px 0;
          letter-spacing: 2px;
        }

        .login-subtitle {
          font-size: 14px;
          color: #9ca3af;
          margin: 0;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .error-message {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #ef4444;
          padding: 12px 16px;
          border-radius: 10px;
          font-size: 14px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-label {
          font-size: 14px;
          font-weight: 500;
          color: #9ca3af;
        }

        .form-input {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 10px;
          padding: 12px 16px;
          font-size: 15px;
          color: #e5e7eb;
          transition: all 0.3s;
        }

        .form-input:focus {
          outline: none;
          border-color: #ffd700;
          box-shadow: 0 0 0 3px rgba(255,215,0,0.1);
        }

        .form-input::placeholder {
          color: #6b7280;
        }

        .btn-login {
          background: linear-gradient(135deg, #ffd700, #ffb700);
          color: #0a0a0f;
          border: none;
          border-radius: 10px;
          padding: 14px;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s;
          box-shadow: 0 4px 15px rgba(255,215,0,0.3);
          margin-top: 8px;
        }

        .btn-login:hover:not(:disabled) {
          box-shadow: 0 6px 20px rgba(255,215,0,0.5);
          transform: translateY(-2px);
        }

        .btn-login:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .login-footer {
          text-align: center;
          font-size: 13px;
          color: #6b7280;
          margin-top: 8px;
        }

        .divider {
          margin: 0 8px;
        }
      `}</style>
    </div>
  );
};

export default Login;
