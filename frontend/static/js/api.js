/**
 * API 配置
 * 说明: 配置后端 API 地址和通用请求方法
 */
const API_BASE_URL = 'http://localhost:8000';

/**
 * 发送 API 请求
 * @param {string} url - 请求路径
 * @param {object} options - 请求配置
 * @returns {Promise} - 返回 Promise
 */
function apiRequest(url, options = {}) {
  const token = localStorage.getItem('token');
  
  const defaultOptions = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (token) {
    defaultOptions.headers['Authorization'] = `Bearer ${token}`;
  }

  const config = { ...defaultOptions, ...options };
  
  if (config.data) {
    config.body = JSON.stringify(config.data);
  }

  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;

  return fetch(fullUrl, config)
    .then(response => {
      if (response.status === 401) {
        // 排除登录接口的 401
        if (!url.includes('/auth/login')) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login.html';
        }
        throw new Error('登录已过期，请重新登录');
      }
      
      if (!response.ok) {
        return response.json().then(data => {
          throw new Error(data.detail || '请求失败');
        });
      }
      
      return response.json();
    });
}

// API 方法封装
const api = {
  // GET 请求
  get(url, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const fullUrl = queryString ? `${url}?${queryString}` : url;
    return apiRequest(fullUrl);
  },

  // POST 请求
  post(url, data = {}) {
    return apiRequest(url, {
      method: 'POST',
      data,
    });
  },

  // PUT 请求
  put(url, data = {}) {
    return apiRequest(url, {
      method: 'PUT',
      data,
    });
  },

  // DELETE 请求
  delete(url) {
    return apiRequest(url, {
      method: 'DELETE',
    });
  },
};
