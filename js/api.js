// Cliente API para comunicarse con el Backend
const isLocalCustomPort = window.location.hostname === 'localhost' && window.location.port !== '3001';
const API_BASE_URL = (window.location.protocol === 'file:' || isLocalCustomPort)
  ? 'http://localhost:3001'
  : '';

const API = {
  getAuthHeaders() {
    const token = Auth.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },

  async request(path, options = {}) {
    const headers = {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...this.getAuthHeaders(),
      ...(options.headers || {})
    };

    const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
    if (res.status === 401 && path !== '/api/auth/login') {
      Auth.logout();
      return { success: false, message: 'Sesión expirada' };
    }
    return await res.json();
  },

  async login(username, password) {
    return await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  },

  async getPosts(clientId = null) {
    const query = clientId ? `?clientId=${clientId}` : '';
    return await this.request(`/api/posts${query}`);
  },

  async createPost(postData) {
    return await this.request('/api/posts', {
      method: 'POST',
      body: JSON.stringify(postData)
    });
  },

  async updatePost(postId, postData) {
    return await this.request(`/api/posts/${postId}`, {
      method: 'PUT',
      body: JSON.stringify(postData)
    });
  },

  async deletePost(postId) {
    return await this.request(`/api/posts/${postId}`, {
      method: 'DELETE'
    });
  },

  async updatePostStatus(postId, status, rejectionReason = '') {
    return await this.request(`/api/posts/${postId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, rejectionReason })
    });
  },

  async getStats(clientId, yearMonth) {
    return await this.request(`/api/posts/stats?clientId=${clientId}&yearMonth=${yearMonth}`);
  },

  async updateMonthlyTarget(clientId, target) {
    return await this.request(`/api/posts/target/${clientId}`, {
      method: 'PUT',
      body: JSON.stringify({ target })
    });
  },

  async getClients() {
    return await this.request('/api/auth/clients');
  },

  async createClient(clientData) {
    return await this.request('/api/auth/clients', {
      method: 'POST',
      body: JSON.stringify(clientData)
    });
  },

  async getUsers() {
    return await this.request('/api/auth/users');
  },

  async createUser(userData) {
    return await this.request('/api/auth/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  },

  async getAssignments() {
    return await this.request('/api/auth/assignments');
  },

  async createAssignment(assignmentData) {
    return await this.request('/api/auth/assignments', {
      method: 'POST',
      body: JSON.stringify(assignmentData)
    });
  },

  async deleteAssignment(assignmentId) {
    return await this.request(`/api/auth/assignments/${assignmentId}`, {
      method: 'DELETE'
    });
  }
};
