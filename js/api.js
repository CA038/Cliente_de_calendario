// Cliente API directo a Google Apps Script (compatible con GitHub Pages sin servidor)
const API = {
  getScriptUrl() {
    return (typeof CONFIG !== 'undefined' && CONFIG.GOOGLE_SCRIPT_URL) ? CONFIG.GOOGLE_SCRIPT_URL : '';
  },

  async gasGet(action, params = {}) {
    const baseUrl = this.getScriptUrl();
    if (!baseUrl) {
      return { success: false, message: 'Falta configurar GOOGLE_SCRIPT_URL en js/config.js' };
    }

    const url = new URL(baseUrl);
    url.searchParams.append('action', action);
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        url.searchParams.append(key, val);
      }
    });

    const res = await fetch(url.toString());
    return await res.json();
  },

  async gasPost(action, data = {}) {
    const baseUrl = this.getScriptUrl();
    if (!baseUrl) {
      return { success: false, message: 'Falta configurar GOOGLE_SCRIPT_URL en js/config.js' };
    }

    // Se usa text/plain para evitar preflight CORS OPTIONS que Google Apps Script no soporta
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, data })
    });
    return await res.json();
  },

  async login(username, password) {
    return await this.gasPost('login', { username, password });
  },

  async getPosts(clientId = null) {
    const user = Auth.getCurrentUser() || {};
    const effectiveClient = user.role === 'client' ? user.clientId : clientId;
    return await this.gasGet('getPosts', {
      clientId: effectiveClient,
      role: user.role,
      userId: user.id
    });
  },

  async createPost(postData) {
    return await this.gasPost('savePost', postData);
  },

  async updatePost(postId, postData) {
    return await this.gasPost('updatePost', { ...postData, id: postId, status: 'pending' });
  },

  async deletePost(postId) {
    return await this.gasPost('deletePost', { id: postId });
  },

  async updatePostStatus(postId, status, rejectionReason = '') {
    return await this.gasPost('updateStatus', { id: postId, status, rejectionReason });
  },

  async getStats(clientId, yearMonth) {
    return await this.gasGet('getStats', { clientId, yearMonth });
  },

  async updateMonthlyTarget(clientId, target) {
    return await this.gasPost('updateTarget', { clientId, monthlyTarget: target });
  },

  async getClients() {
    const user = Auth.getCurrentUser() || {};
    return await this.gasGet('getClients', {
      role: user.role,
      userId: user.id,
      clientId: user.clientId
    });
  },

  async createClient(clientData) {
    return await this.gasPost('saveClient', clientData);
  },

  async getUsers() {
    return await this.gasGet('getUsers');
  },

  async createUser(userData) {
    return await this.gasPost('saveUser', userData);
  },

  async updateUser(userData) {
    return await this.gasPost('updateUser', userData);
  },

  async getAssignments() {
    return await this.gasGet('getAssignments');
  },

  async createAssignment(assignmentData) {
    return await this.gasPost('saveAssignment', assignmentData);
  },

  async deleteAssignment(assignmentId) {
    return await this.gasPost('deleteAssignment', { id: assignmentId });
  },

  uploadMedia(file) {
    return new Promise((resolve, reject) => {
      const maxBytes = 20 * 1024 * 1024; // 20 MB
      if (file.size > maxBytes) {
        resolve({ success: false, message: `"${file.name}" supera el límite de 20 MB para Google Apps Script.` });
        return;
      }

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const result = String(reader.result || '');
          const commaIdx = result.indexOf(',');
          const base64Data = commaIdx !== -1 ? result.slice(commaIdx + 1) : result;
          const res = await this.gasPost('uploadMedia', {
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            base64Data
          });
          resolve(res);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => resolve({ success: false, message: `No se pudo leer "${file.name}".` });
      reader.readAsDataURL(file);
    });
  }
};
