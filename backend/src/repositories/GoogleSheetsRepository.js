import { config } from '../config/index.js';

// Base de datos en memoria para pruebas iniciales si aún no se conecta Google Sheets
const localStore = {
  clients: [
    { id: 'cli_1', name: 'Adrian Reyes Creativo', monthlyTarget: 12, active: true },
    { id: 'cli_2', name: 'Restaurante Gourmet', monthlyTarget: 20, active: true }
  ],
  users: [
    { id: 'usr_1', username: 'admin', password: '123', role: 'superadmin', name: 'Adrian Reyes', clientId: '' },
    { id: 'usr_2', username: 'operario1', password: '123', role: 'operator', name: 'Carlos Operario', clientId: '' },
    { id: 'usr_3', username: 'cliente1', password: '123', role: 'client', name: 'Cliente Gourmet', clientId: 'cli_2' }
  ],
  assignments: [
    { id: 'asg_1', userId: 'usr_2', clientId: 'cli_1', taskNote: 'Calendario mensual', createdAt: new Date().toISOString() }
  ],
  posts: [
    {
      id: 'post_1',
      clientId: 'cli_1',
      title: 'Lanzamiento Nueva Colección',
      caption: 'Descubre nuestra nueva línea visual minimalista y moderna.',
      mediaType: 'image',
      mediaUrls: JSON.stringify(['https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80']),
      scheduledDate: '2026-11-05T15:00',
      status: 'pending',
      rejectionReason: '',
      createdAt: new Date().toISOString()
    },
    {
      id: 'post_2',
      clientId: 'cli_1',
      title: 'Reel de Identidad de Marca',
      caption: 'Proceso creativo paso a paso detrás del diseño de marca.',
      mediaType: 'video',
      mediaUrls: JSON.stringify(['https://assets.mixkit.co/videos/preview/mixkit-hands-holding-a-modern-smartphone-with-green-screen-42996-large.mp4']),
      scheduledDate: '2026-11-08T18:30',
      status: 'approved',
      rejectionReason: '',
      createdAt: new Date().toISOString()
    }
  ]
};

export class GoogleSheetsRepository {
  constructor() {
    this.scriptUrl = config.googleScriptUrl;
  }

  hasRemote() {
    return Boolean(this.scriptUrl && this.scriptUrl.startsWith('http'));
  }

  async getPosts(clientId = null) {
    if (!this.hasRemote()) {
      if (clientId) {
        return localStore.posts.filter(p => String(p.clientId) === String(clientId));
      }
      return [...localStore.posts];
    }

    const url = new URL(this.scriptUrl);
    url.searchParams.append('action', 'getPosts');
    if (clientId) url.searchParams.append('clientId', clientId);

    const res = await fetch(url.toString());
    const json = await res.json();
    return json.success ? json.data : [];
  }

  async savePost(postData) {
    if (!this.hasRemote()) {
      const newPost = {
        ...postData,
        id: postData.id || `post_${Date.now()}`,
        status: postData.status || 'pending',
        rejectionReason: '',
        createdAt: new Date().toISOString(),
        mediaUrls: typeof postData.mediaUrls === 'string' ? postData.mediaUrls : JSON.stringify(postData.mediaUrls || [])
      };
      localStore.posts.push(newPost);
      return { success: true, id: newPost.id };
    }

    const res = await fetch(this.scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'savePost', data: postData })
    });
    return await res.json();
  }

  async updatePost(postId, postData) {
    if (!this.hasRemote()) {
      const post = localStore.posts.find(p => String(p.id) === String(postId));
      if (!post) return { success: false, message: 'Post no encontrado' };
      post.clientId = postData.clientId || post.clientId;
      post.title = postData.title;
      post.caption = postData.caption || '';
      post.mediaType = postData.mediaType || 'image';
      post.mediaUrls = typeof postData.mediaUrls === 'string' ? postData.mediaUrls : JSON.stringify(postData.mediaUrls || []);
      post.scheduledDate = postData.scheduledDate;
      post.status = 'pending';
      post.rejectionReason = '';
      return { success: true, message: 'Post actualizado' };
    }

    const res = await fetch(this.scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'updatePost', data: { ...postData, id: postId, status: 'pending' } })
    });
    return await res.json();
  }

  async deletePost(postId) {
    if (!this.hasRemote()) {
      const idx = localStore.posts.findIndex(p => String(p.id) === String(postId));
      if (idx === -1) return { success: false, message: 'Post no encontrado' };
      localStore.posts.splice(idx, 1);
      return { success: true, message: 'Post eliminado' };
    }

    const res = await fetch(this.scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'deletePost', data: { id: postId } })
    });
    return await res.json();
  }

  async updatePostStatus(postId, status, rejectionReason = '') {
    if (!this.hasRemote()) {
      const post = localStore.posts.find(p => String(p.id) === String(postId));
      if (!post) return { success: false, message: 'Post no encontrado' };
      post.status = status;
      post.rejectionReason = rejectionReason;
      return { success: true, message: 'Estado actualizado' };
    }

    const res = await fetch(this.scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'updateStatus',
        data: { id: postId, status, rejectionReason }
      })
    });
    return await res.json();
  }

  async getClients() {
    if (!this.hasRemote()) {
      return [...localStore.clients];
    }
    const res = await fetch(`${this.scriptUrl}?action=getClients`);
    const json = await res.json();
    return json.success ? json.data : [];
  }

  async saveClient(clientData) {
    if (!this.hasRemote()) {
      const newClient = {
        id: `cli_${Date.now()}`,
        name: clientData.name,
        monthlyTarget: Number(clientData.monthlyTarget || 0),
        active: true
      };
      localStore.clients.push(newClient);
      return { success: true, id: newClient.id };
    }

    const res = await fetch(this.scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'saveClient', data: clientData })
    });
    return await res.json();
  }

  async updateClientTarget(clientId, target) {
    if (!this.hasRemote()) {
      const client = localStore.clients.find(c => String(c.id) === String(clientId));
      if (!client) return { success: false, message: 'Cliente no encontrado' };
      client.monthlyTarget = Number(target);
      return { success: true, message: 'Meta actualizada' };
    }

    const res = await fetch(this.scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'updateTarget', data: { clientId, monthlyTarget: target } })
    });
    return await res.json();
  }

  async getUsers() {
    if (!this.hasRemote()) {
      return [...localStore.users];
    }
    const res = await fetch(`${this.scriptUrl}?action=getUsers`);
    const json = await res.json();
    return json.success ? json.data : [];
  }

  async saveUser(userData) {
    if (!this.hasRemote()) {
      const newUser = {
        id: `usr_${Date.now()}`,
        username: userData.username,
        password: userData.password,
        role: userData.role,
        clientId: userData.clientId || '',
        name: userData.name || userData.username
      };
      localStore.users.push(newUser);
      return { success: true, id: newUser.id };
    }

    const res = await fetch(this.scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'saveUser', data: userData })
    });
    return await res.json();
  }

  async getAssignments() {
    if (!this.hasRemote()) {
      return [...localStore.assignments];
    }
    const res = await fetch(`${this.scriptUrl}?action=getAssignments`);
    const json = await res.json();
    return json.success ? json.data : [];
  }

  async saveAssignment(assignmentData) {
    if (!this.hasRemote()) {
      const newAsg = {
        id: `asg_${Date.now()}`,
        userId: assignmentData.userId,
        clientId: assignmentData.clientId,
        taskNote: assignmentData.taskNote || '',
        createdAt: new Date().toISOString()
      };
      localStore.assignments.push(newAsg);
      return { success: true, id: newAsg.id };
    }

    const res = await fetch(this.scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'saveAssignment', data: assignmentData })
    });
    return await res.json();
  }

  async deleteAssignment(assignmentId) {
    if (!this.hasRemote()) {
      const idx = localStore.assignments.findIndex(a => String(a.id) === String(assignmentId));
      if (idx === -1) return { success: false, message: 'Asignación no encontrada' };
      localStore.assignments.splice(idx, 1);
      return { success: true, message: 'Asignación eliminada' };
    }

    const res = await fetch(this.scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'deleteAssignment', data: { id: assignmentId } })
    });
    return await res.json();
  }
}
