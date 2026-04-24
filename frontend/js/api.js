(function () {
  const BASE_URL = "http://localhost:8000";

  class ApiClient {
    constructor(baseURL) {
      this.baseURL = baseURL;
    }

    _headers() {
      const headers = { "Content-Type": "application/json" };
      const token = localStorage.getItem("token");
      if (token) headers.Authorization = `Bearer ${token}`;
      return headers;
    }

    async _request(method, path, body) {
      const options = { method, headers: this._headers() };
      if (body && method !== "GET") options.body = JSON.stringify(body);

      try {
        const resp = await fetch(this.baseURL + path, options);
        if (resp.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          if (window.location.hash !== "#/login") window.location.hash = "#/login";
          throw new Error("未授权，请重新登录");
        }

        let data = null;
        if (resp.status !== 204) {
          const text = await resp.text();
          if (text) {
            try {
              data = JSON.parse(text);
            } catch {
              data = { message: text };
            }
          }
        }

        if (!resp.ok) throw new Error((data && (data.detail || data.message)) || `请求失败 (${resp.status})`);
        return data;
      } catch (err) {
        if (err.message === "Failed to fetch") throw new Error("无法连接到服务器，请检查后端服务是否启动");
        throw err;
      }
    }

    get(path) { return this._request("GET", path); }
    post(path, body) { return this._request("POST", path, body); }
    put(path, body) { return this._request("PUT", path, body); }
    delete(path) { return this._request("DELETE", path); }
  }

  window.API = new ApiClient(BASE_URL);
})();
