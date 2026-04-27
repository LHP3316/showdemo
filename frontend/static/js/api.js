/**
 * API client for static pages
 */
const API_BASE_URL = "http://localhost:8001";

function resolveApiBaseCandidates() {
  const out = [];
  const pushUnique = (v) => {
    const value = String(v || "").trim();
    if (!value || out.includes(value)) return;
    out.push(value);
  };

  pushUnique(API_BASE_URL);
  pushUnique(API_BASE_URL.replace("localhost", "127.0.0.1"));

  const host = String((window.location && window.location.hostname) || "").trim();
  if (host && host !== "localhost" && host !== "127.0.0.1") {
    pushUnique(`http://${host}:8001`);
  }
  return out;
}

async function apiRequest(url, options = {}) {
  const token = localStorage.getItem("token");

  const config = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  };

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (config.data !== undefined) {
    config.body = JSON.stringify(config.data);
    delete config.data;
  }

  const candidateUrls = url.startsWith("http")
    ? [url]
    : resolveApiBaseCandidates().map((base) => `${base}${url}`);

  let response = null;
  let networkError = null;
  for (const fullUrl of candidateUrls) {
    try {
      response = await fetch(fullUrl, config);
      networkError = null;
      break;
    } catch (e) {
      networkError = e;
    }
  }
  if (!response) {
    throw new Error("Cannot connect to backend server");
  }

  if (response.status === 401) {
    if (!url.includes("/auth/login")) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "login.html";
    }
    throw new Error("Session expired, please login again");
  }

  let payload = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }

  if (!response.ok) {
    throw new Error((payload && (payload.detail || payload.message)) || "Request failed");
  }

  return payload;
}

const api = {
  get(url, params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiRequest(query ? `${url}?${query}` : url);
  },

  post(url, data = {}) {
    return apiRequest(url, { method: "POST", data });
  },

  put(url, data = {}) {
    return apiRequest(url, { method: "PUT", data });
  },

  delete(url) {
    return apiRequest(url, { method: "DELETE" });
  },
};

// 提供给 static 页面其他脚本（workspace/common 等）直接访问
window.api = api;
window.apiRequest = apiRequest;

