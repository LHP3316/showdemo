/**
 * 占位页面
 * 说明: 用于路由占位，后续实现完整功能
 * 版本: v2.0
 */
import React from 'react';

interface PlaceholderProps {
  title: string;
}

const Placeholder: React.FC<PlaceholderProps> = ({ title }) => {
  return (
    <div className="placeholder-page">
      <h1>{title}</h1>
      <p>页面开发中，敬请期待...</p>
      
      <style>{`
        .placeholder-page {
          min-height: 100vh;
          background: #0a0a0f;
          color: #e5e7eb;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 24px;
        }
        
        h1 {
          font-size: 48px;
          font-weight: 900;
          color: #ffd700;
          margin: 0;
        }
        
        p {
          font-size: 16px;
          color: #9ca3af;
          margin: 0;
        }
      `}</style>
    </div>
  );
};

export default Placeholder;
