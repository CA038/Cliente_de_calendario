// Coordinador Principal de la Aplicación
let calendar;
let activeClient = null;
let currentSelectedPost = null;
let editingPostId = null;

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  calendar = new CalendarView('calendarGrid', onPostClick);
  setupEventListeners();

  const user = Auth.getCurrentUser();
  if (user) {
    showAppScreen();
  } else {
    showLoginScreen();
  }
}

function showLoginScreen() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('appScreen').style.display = 'none';

  const quickAccess = document.getElementById('quickAccessDemo');
  if (quickAccess) {
    const isLocal = window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.protocol === 'file:';
    quickAccess.style.display = isLocal ? 'block' : 'none';
  }

  if (window.lucide) window.lucide.createIcons();
  initGoogleSignIn();
}

let googleSignInInitialized = false;

function initGoogleSignIn(retries = 0) {
  const btnContainer = document.getElementById('googleLoginBtn');
  if (!btnContainer || !CONFIG.GOOGLE_CLIENT_ID) return;

  if (!window.google?.accounts?.id) {
    if (retries < 20) {
      setTimeout(() => initGoogleSignIn(retries + 1), 250);
    }
    return;
  }

  if (!googleSignInInitialized) {
    window.google.accounts.id.initialize({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      callback: handleGoogleCredentialResponse
    });
    googleSignInInitialized = true;
  }

  btnContainer.innerHTML = '';
  window.google.accounts.id.renderButton(btnContainer, {
    theme: 'outline',
    size: 'large',
    text: 'continue_with',
    shape: 'pill',
    width: 300,
    locale: 'es'
  });
}

async function handleGoogleCredentialResponse(response) {
  const errorEl = document.getElementById('loginError');
  if (errorEl) errorEl.style.display = 'none';

  if (!response?.credential) {
    if (errorEl) {
      errorEl.textContent = 'No se recibió credencial de Google.';
      errorEl.style.display = 'block';
    }
    return;
  }

  try {
    const res = await API.loginWithGoogle(response.credential);
    if (res.success && res.data?.user) {
      Auth.setSession(res.data.user, '');
      showAppScreen();
      showToast('Sesión iniciada con Google', 'success');
    } else if (errorEl) {
      errorEl.textContent = res.message || 'No se pudo iniciar sesión con Google';
      errorEl.style.display = 'block';
    }
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = 'Error al conectar con el servidor: ' + err.message;
      errorEl.style.display = 'block';
    }
  }
}

async function showAppScreen() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appScreen').style.display = 'flex';

  Auth.applyRolePermissions();
  await loadClients();
  await loadCalendarAndStats();
  loadNotifications();
}

function switchManageTab(tabId) {
  openModal('manageModal');
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

  const targetBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  const targetPane = document.getElementById(tabId);
  if (targetBtn) targetBtn.classList.add('active');
  if (targetPane) targetPane.classList.add('active');
  loadManageData();
}

function setupEventListeners() {
  // Login Form
  document.getElementById('loginForm').addEventListener('submit', handleLogin);

  // Mostrar / Ocultar contraseña en login
  const togglePasswordBtn = document.getElementById('togglePasswordBtn');
  const passwordInput = document.getElementById('password');
  if (togglePasswordBtn && passwordInput) {
    togglePasswordBtn.addEventListener('click', () => {
      const isHidden = passwordInput.type === 'password';
      passwordInput.type = isHidden ? 'text' : 'password';
      togglePasswordBtn.title = isHidden ? 'Ocultar contraseña' : 'Mostrar contraseña';
      togglePasswordBtn.innerHTML = `<i data-lucide="${isHidden ? 'eye-off' : 'eye'}"></i>`;
      if (window.lucide) window.lucide.createIcons();
    });
  }

  // Quick Demo Buttons
  document.querySelectorAll('.btn-demo').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('username').value = btn.dataset.user;
      document.getElementById('password').value = btn.dataset.pass;
      document.getElementById('loginForm').dispatchEvent(new Event('submit'));
    });
  });

  // Logout desde Menú Lateral
  const sideLogoutBtn = document.getElementById('sideLogoutBtn');
  if (sideLogoutBtn) sideLogoutBtn.addEventListener('click', () => Auth.logout());

  // Menú móvil (hamburguesa)
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const sidebar = document.getElementById('appSidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  const closeSidebar = () => {
    if (sidebar) sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('active');
  };
  if (mobileMenuBtn && sidebar && backdrop) {
    mobileMenuBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      backdrop.classList.toggle('active');
    });
    backdrop.addEventListener('click', closeSidebar);
    document.querySelectorAll('.sidebar-btn').forEach(btn => btn.addEventListener('click', closeSidebar));
  }

  // Navegación del Menú Lateral
  const sideNavCalendar = document.getElementById('sideNavCalendar');
  if (sideNavCalendar) {
    sideNavCalendar.addEventListener('click', () => {
      document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
      sideNavCalendar.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  const sideNavNewPost = document.getElementById('sideNavNewPost');
  if (sideNavNewPost) {
    sideNavNewPost.addEventListener('click', openNewPostModal);
  }

  const sideNavClients = document.getElementById('sideNavClients');
  if (sideNavClients) {
    sideNavClients.addEventListener('click', () => switchManageTab('clientsTab'));
  }

  const sideNavUsers = document.getElementById('sideNavUsers');
  if (sideNavUsers) {
    sideNavUsers.addEventListener('click', () => switchManageTab('usersTab'));
  }

  const sideNavAssignments = document.getElementById('sideNavAssignments');
  if (sideNavAssignments) {
    sideNavAssignments.addEventListener('click', () => switchManageTab('assignmentsTab'));
  }

  // Navegación de Mes
  document.getElementById('prevMonthBtn').addEventListener('click', () => {
    const { year, month } = calendar.getCurrentMonthYear();
    calendar.setDate(year, month - 1);
    loadCalendarAndStats();
  });

  document.getElementById('nextMonthBtn').addEventListener('click', () => {
    const { year, month } = calendar.getCurrentMonthYear();
    calendar.setDate(year, month + 1);
    loadCalendarAndStats();
  });

  // Selector de Cliente
  document.getElementById('clientSelect').addEventListener('change', (e) => {
    activeClient = e.target.value;
    loadCalendarAndStats();
  });

  // Selector de Vista (Calendario / Lista de Posts)
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchCalendarView(btn.dataset.view);
    });
  });

  // Botón Nuevo Post en Topbar
  const newPostBtn = document.getElementById('newPostBtn');
  if (newPostBtn) {
    newPostBtn.addEventListener('click', openNewPostModal);
  }

  document.getElementById('postForm').addEventListener('submit', handleSavePost);

  // Pestañas internas de Administración
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });

  document.getElementById('newClientForm').addEventListener('submit', handleCreateClient);
  document.getElementById('newUserForm').addEventListener('submit', handleCreateUser);
  const newUserRoleSelect = document.getElementById('newUserRole');
  if (newUserRoleSelect) {
    newUserRoleSelect.addEventListener('change', syncUserRoleClientField);
    syncUserRoleClientField();
  }
  const cancelEditClientBtn = document.getElementById('cancelEditClientBtn');
  if (cancelEditClientBtn) {
    cancelEditClientBtn.addEventListener('click', resetClientForm);
  }
  const cancelEditUserBtn = document.getElementById('cancelEditUserBtn');
  if (cancelEditUserBtn) {
    cancelEditUserBtn.addEventListener('click', resetUserForm);
  }
  const newAssignmentForm = document.getElementById('newAssignmentForm');
  if (newAssignmentForm) {
    newAssignmentForm.addEventListener('submit', handleCreateAssignment);
  }

  // Edición rápida de meta mensual
  const editTargetBtn = document.getElementById('editTargetBtn');
  if (editTargetBtn) {
    editTargetBtn.addEventListener('click', handleEditTarget);
  }

  // Acciones en Detalle de Post (Editar / Eliminar / Aprobar / Rechazar)
  const editPostBtn = document.getElementById('editPostBtn');
  if (editPostBtn) {
    editPostBtn.addEventListener('click', () => {
      if (currentSelectedPost) {
        closeModal('detailModal');
        openEditPostModal(currentSelectedPost);
      }
    });
  }
  const deletePostBtn = document.getElementById('deletePostBtn');
  if (deletePostBtn) {
    deletePostBtn.addEventListener('click', handleDeletePost);
  }
  document.getElementById('approvePostBtn').addEventListener('click', () => handleUpdateStatus('approved'));
  document.getElementById('openRejectBtn').addEventListener('click', () => {
    document.getElementById('rejectionInputSection').style.display = 'block';
  });
  document.getElementById('cancelRejectBtn').addEventListener('click', () => {
    document.getElementById('rejectionInputSection').style.display = 'none';
  });
  document.getElementById('confirmRejectBtn').addEventListener('click', () => {
    const reason = document.getElementById('rejectionReasonInput').value.trim();
    if (!reason) {
      showToast('Por favor especifica el motivo del rechazo.', 'error');
      return;
    }
    handleUpdateStatus('rejected', reason);
  });

  // Cerrar modales con botones de clase data-close
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });

  // Campanita de notificaciones
  const notifBellBtn = document.getElementById('notifBellBtn');
  const notifDropdown = document.getElementById('notifDropdown');
  const markNotifReadBtn = document.getElementById('markNotifReadBtn');
  if (notifBellBtn && notifDropdown) {
    notifBellBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = notifDropdown.style.display === 'flex';
      notifDropdown.style.display = isOpen ? 'none' : 'flex';
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#notifWrapper')) {
        notifDropdown.style.display = 'none';
      }
    });
  }
  if (markNotifReadBtn) {
    markNotifReadBtn.addEventListener('click', async () => {
      await API.markNotificationsRead();
      await loadNotifications();
    });
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const errorBanner = document.getElementById('loginError');
  errorBanner.style.display = 'none';

  const userVal = document.getElementById('username').value.trim();
  const passVal = document.getElementById('password').value.trim();

  try {
    const res = await API.login(userVal, passVal);
    if (res.success && res.data) {
      const loggedUser = res.data.user || res.data;
      const token = res.data.token || '';
      Auth.setSession(loggedUser, token);
      showAppScreen();
    } else {
      errorBanner.textContent = res.message || 'Usuario o contraseña incorrectos';
      errorBanner.style.display = 'block';
    }
  } catch (err) {
    errorBanner.textContent = 'Error de conexión con el servidor.';
    errorBanner.style.display = 'block';
  }
}

async function loadClients() {
  const res = await API.getClients();
  if (!res.success) return;

  const clients = res.data || [];
  const clientSelect = document.getElementById('clientSelect');
  const postClientSelect = document.getElementById('postClient');
  const userClientSelect = document.getElementById('newUserClientSelect');

  clientSelect.innerHTML = '';
  postClientSelect.innerHTML = '';
  userClientSelect.innerHTML = '<option value="">Sin cliente asignado (para admin/operario)</option>';

  const user = Auth.getCurrentUser();

  clients.forEach(client => {
    const opt = document.createElement('option');
    opt.value = client.id;
    opt.textContent = client.name;
    clientSelect.appendChild(opt);

    const postOpt = opt.cloneNode(true);
    postClientSelect.appendChild(postOpt);

    const userOpt = opt.cloneNode(true);
    userClientSelect.appendChild(userOpt);
  });

  if (user && user.role === 'client') {
    if (user.clientId) {
      activeClient = user.clientId;
      const assigned = clients.find(c => String(c.id) === String(user.clientId));
      const brandNameEl = document.getElementById('clientBrandName');
      if (brandNameEl) brandNameEl.textContent = assigned ? assigned.name : 'Mi Calendario';
    } else {
      activeClient = null;
      const brandNameEl = document.getElementById('clientBrandName');
      if (brandNameEl) brandNameEl.textContent = 'Sin cliente asignado';
    }
  } else if (clients.length > 0) {
    activeClient = clients[0].id;
    clientSelect.value = activeClient;
  } else {
    activeClient = null;
  }
}

let currentPosts = [];
let currentCalendarView = 'calendar';

function switchCalendarView(view) {
  currentCalendarView = view === 'list' ? 'list' : 'calendar';
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === currentCalendarView);
  });

  const calendarSection = document.querySelector('.calendar-section');
  const postsListSection = document.getElementById('postsListSection');
  if (calendarSection) {
    calendarSection.style.display = currentCalendarView === 'calendar' ? '' : 'none';
  }
  if (postsListSection) {
    postsListSection.style.display = currentCalendarView === 'list' ? 'block' : 'none';
  }
  if (currentCalendarView === 'list') {
    renderPostsList(currentPosts);
  }
}

function renderPostsList(posts) {
  const grid = document.getElementById('postsListGrid');
  if (!grid) return;

  const user = Auth.getCurrentUser();
  if (user && user.role === 'client' && !activeClient) {
    grid.innerHTML = '<div class="posts-empty-state">Tu usuario aún no tiene un calendario/cliente asignado. Pide al administrador que te asigne uno.</div>';
    return;
  }

  const { yearMonth } = calendar.getCurrentMonthYear();
  const monthPosts = (posts || [])
    .filter(p => String(p.scheduledDate || '').startsWith(yearMonth))
    .sort((a, b) => String(a.scheduledDate || '').localeCompare(String(b.scheduledDate || '')));

  if (monthPosts.length === 0) {
    grid.innerHTML = '<div class="posts-empty-state">No hay posts programados para este mes.</div>';
    return;
  }

  const statusLabels = {
    approved: 'Aprobado',
    rejected: 'Rechazado',
    pending: 'Pendiente'
  };

  grid.innerHTML = '';
  monthPosts.forEach(post => {
    const card = document.createElement('article');
    card.className = 'post-list-card';

    const mediaUrls = Array.isArray(post.mediaUrls) ? post.mediaUrls : [];
    const firstUrl = mediaUrls[0] || '';
    const isVideo = post.mediaType === 'video' || /\.(mp4|mov|webm)(\?|$)/i.test(firstUrl);

    let mediaHtml = '<div class="post-list-placeholder"><i data-lucide="image"></i><span>Sin archivo</span></div>';
    if (firstUrl) {
      mediaHtml = isVideo
        ? `<video src="${escapeHtml(firstUrl)}" muted playsinline preload="metadata"></video>`
        : `<img src="${escapeHtml(firstUrl)}" alt="${escapeHtml(post.title || 'Post')}" loading="lazy">`;
    }

    const status = post.status || 'pending';
    const statusText = statusLabels[status] || 'Pendiente';

    card.innerHTML = `
      <div class="post-list-media">${mediaHtml}</div>
      <div class="post-list-body">
        <div class="post-list-meta">
          <span>${escapeHtml(post.scheduledDate || '')}</span>
          <span class="status-badge ${escapeHtml(status)}">${escapeHtml(statusText)}</span>
        </div>
        <h4 class="post-list-title">${escapeHtml(post.title || 'Sin título')}</h4>
        <p class="post-list-caption">${escapeHtml(post.caption || '')}</p>
        <div class="post-list-actions">
          <button type="button" class="btn btn-secondary btn-sm view-post-detail-btn">
            <i data-lucide="eye"></i> Revisar Post
          </button>
        </div>
      </div>
    `;

    card.querySelector('.view-post-detail-btn').addEventListener('click', () => openPostDetail(post));
    grid.appendChild(card);
  });

  if (window.lucide) window.lucide.createIcons();
}

async function loadCalendarAndStats() {
  document.getElementById('currentMonthLabel').textContent = calendar.getMonthLabel();
  const { yearMonth } = calendar.getCurrentMonthYear();
  const user = Auth.getCurrentUser();

  if (user && user.role === 'client' && !activeClient) {
    currentPosts = [];
    calendar.render([]);
    renderPostsList([]);
    showToast('Tu usuario no tiene un cliente asignado aún.', 'error');
    return;
  }

  try {
    // Cargar Posts
    const postsRes = await API.getPosts(activeClient);
    if (!postsRes.success) {
      showToast(postsRes.message || 'No se pudieron cargar los posts.', 'error');
    }
    const posts = postsRes.success ? (postsRes.data || []) : [];
    currentPosts = posts;
    calendar.render(posts);
    renderPostsList(posts);

    // Cargar Métricas y Faltantes
    if (activeClient) {
      const statsRes = await API.getStats(activeClient, yearMonth);
      if (statsRes.success && statsRes.data) {
        const s = statsRes.data;
        document.getElementById('kpiTargetVal').textContent = `${s.monthlyTarget} / ${s.videoTarget || 0}`;
        document.getElementById('kpiRemainingVal').textContent = s.remainingPosts;
        const remVideosEl = document.getElementById('kpiRemainingVideosVal');
        if (remVideosEl) remVideosEl.textContent = s.remainingVideos ?? 0;
        document.getElementById('kpiApprovedVal').textContent = s.approvedCount;
        document.getElementById('kpiScheduledVal').textContent = s.totalScheduled;
        document.getElementById('kpiRejectedVal').textContent = s.rejectedCount;
      }
    }
  } catch (err) {
    showToast(`Error de conexión al cargar calendario: ${err.message}`, 'error');
  }
}

async function loadNotifications() {
  const user = Auth.getCurrentUser();
  if (!user || user.role === 'client') return;

  try {
    const res = await API.getNotifications();
    if (!res.success) return;
    renderNotifications(res.data || []);
  } catch (err) {
    // Silencioso si el script aún no tiene la acción getNotifications
  }
}

function renderNotifications(items) {
  const listEl = document.getElementById('notifList');
  const badgeEl = document.getElementById('notifBadge');
  if (!listEl || !badgeEl) return;

  const unreadCount = items.filter(n => !n.read || n.read === 'false').length;
  if (unreadCount > 0) {
    badgeEl.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
    badgeEl.style.display = 'inline-flex';
  } else {
    badgeEl.style.display = 'none';
  }

  if (items.length === 0) {
    listEl.innerHTML = '<div class="notif-empty">Sin notificaciones aún.</div>';
    return;
  }

  listEl.innerHTML = '';
  items.forEach(n => {
    const isUnread = !n.read || n.read === 'false';
    const isApproved = n.status === 'approved';
    const item = document.createElement('div');
    item.className = `notif-item ${isUnread ? 'unread' : ''}`;
    item.innerHTML = `
      <div class="notif-item-top">
        <span class="notif-client">${escapeHtml(n.clientName || 'Cliente')}</span>
        <span class="status-badge ${isApproved ? 'approved' : 'rejected'}">${isApproved ? 'Aprobado' : 'Rechazado'}</span>
      </div>
      <div class="notif-title">${escapeHtml(n.postTitle || 'Post')}</div>
      ${n.reason ? `<div class="notif-reason">"${escapeHtml(n.reason)}"</div>` : ''}
    `;
    item.addEventListener('click', () => openNotificationTarget(n));
    listEl.appendChild(item);
  });
}

async function openNotificationTarget(notif) {
  const dropdown = document.getElementById('notifDropdown');
  if (dropdown) dropdown.style.display = 'none';

  if (notif.id) {
    API.markNotificationsRead([notif.id]).then(() => loadNotifications());
  }

  if (notif.clientId && String(activeClient) !== String(notif.clientId)) {
    activeClient = notif.clientId;
    const clientSelect = document.getElementById('clientSelect');
    if (clientSelect) clientSelect.value = activeClient;
    await loadCalendarAndStats();
  }

  const targetPost = currentPosts.find(p => String(p.id) === String(notif.postId));
  if (targetPost) {
    openPostDetail(targetPost);
  }
}

function resolveClientNameForPost(post) {
  const clientSelect = document.getElementById('clientSelect');
  if (clientSelect && post.clientId) {
    const opt = Array.from(clientSelect.options).find(o => String(o.value) === String(post.clientId));
    if (opt) return opt.textContent;
  }
  const brandBadge = document.getElementById('clientBrandName');
  if (brandBadge && brandBadge.textContent && brandBadge.textContent !== 'Mi Calendario') {
    return brandBadge.textContent;
  }
  return 'Cliente';
}

function renderSocialMediaSlide(post, urls, index) {
  const mediaContainer = document.getElementById('detailMediaContainer');
  if (!mediaContainer) return;
  mediaContainer.innerHTML = '';

  if (!urls || urls.length === 0) {
    mediaContainer.innerHTML = '<span style="font-size: 0.9rem; color: #a1a1aa; padding: 24px; text-align: center;">Sin vista previa multimedia.</span>';
    return;
  }

  const url = urls[index] || urls[0];
  if (post.mediaType === 'video' || String(url).includes('drive.google.com/file/d/')) {
    if (String(url).includes('drive.google.com/file/d/')) {
      const iframe = document.createElement('iframe');
      iframe.src = url.includes('/preview') ? url : url.replace(/\/view.*$/, '/preview');
      iframe.allow = 'autoplay';
      mediaContainer.appendChild(iframe);
    } else {
      const vid = document.createElement('video');
      vid.src = url;
      vid.controls = true;
      mediaContainer.appendChild(vid);
    }
  } else {
    const img = document.createElement('img');
    img.referrerPolicy = 'no-referrer';
    img.src = url;
    img.alt = post.title || 'Post';
    mediaContainer.appendChild(img);
  }
}

function onPostClick(post) {
  currentSelectedPost = post;

  const brandName = resolveClientNameForPost(post);
  const brandEl = document.getElementById('detailBrandName');
  const avatarEl = document.getElementById('detailBrandAvatar');
  if (brandEl) brandEl.textContent = brandName;
  if (avatarEl) avatarEl.textContent = brandName.trim().charAt(0).toUpperCase() || 'C';

  document.getElementById('detailTitle').textContent = post.title || '';
  document.getElementById('detailCaption').textContent = post.caption || '(Sin copy especificado)';
  document.getElementById('detailDate').textContent = post.scheduledDate ? post.scheduledDate.replace('T', ' ') : '';

  // Badge de Estado
  const badge = document.getElementById('detailStatusBadge');
  badge.className = `status-badge ${post.status}`;
  badge.textContent = post.status === 'approved' ? 'Aprobado' : (post.status === 'rejected' ? 'Rechazado' : 'Pendiente');

  // Media Preview con soporte de carrusel
  const urls = Array.isArray(post.mediaUrls) ? post.mediaUrls : [];
  let slideIdx = 0;
  renderSocialMediaSlide(post, urls, slideIdx);

  const prevBtn = document.getElementById('carouselPrevBtn');
  const nextBtn = document.getElementById('carouselNextBtn');
  const dotsWrap = document.getElementById('carouselDots');
  const hasMultiple = urls.length > 1;

  if (prevBtn && nextBtn && dotsWrap) {
    prevBtn.style.display = hasMultiple ? 'inline-flex' : 'none';
    nextBtn.style.display = hasMultiple ? 'inline-flex' : 'none';
    dotsWrap.style.display = hasMultiple ? 'flex' : 'none';

    const updateCarouselUI = () => {
      renderSocialMediaSlide(post, urls, slideIdx);
      Array.from(dotsWrap.children).forEach((d, idx) => {
        d.classList.toggle('active', idx === slideIdx);
      });
    };

    if (hasMultiple) {
      dotsWrap.innerHTML = '';
      urls.forEach((_, idx) => {
        const dot = document.createElement('span');
        dot.className = `carousel-dot ${idx === 0 ? 'active' : ''}`;
        dot.addEventListener('click', () => {
          slideIdx = idx;
          updateCarouselUI();
        });
        dotsWrap.appendChild(dot);
      });
      prevBtn.onclick = () => {
        slideIdx = (slideIdx - 1 + urls.length) % urls.length;
        updateCarouselUI();
      };
      nextBtn.onclick = () => {
        slideIdx = (slideIdx + 1) % urls.length;
        updateCarouselUI();
      };
    }
  }

  // Retroalimentación de rechazo si existe
  const rejBox = document.getElementById('detailRejectionBox');
  const rejText = document.getElementById('detailRejectionText');
  if (post.status === 'rejected' && post.rejectionReason) {
    rejBox.style.display = 'block';
    rejText.textContent = `"${post.rejectionReason}"`;
  } else {
    rejBox.style.display = 'none';
  }

  // Reset sección de rechazo
  document.getElementById('rejectionInputSection').style.display = 'none';
  document.getElementById('rejectionReasonInput').value = '';

  // Mostrar botones de Editar/Eliminar solo a operarios y superadmin
  const canEdit = Auth.isOperator();
  const editBtn = document.getElementById('editPostBtn');
  const deleteBtn = document.getElementById('deletePostBtn');
  if (editBtn) editBtn.style.display = canEdit ? 'inline-flex' : 'none';
  if (deleteBtn) deleteBtn.style.display = canEdit ? 'inline-flex' : 'none';

  openModal('detailModal');
  if (window.lucide) window.lucide.createIcons();
}

const openPostDetail = onPostClick;

async function handleUpdateStatus(status, rejectionReason = '') {
  if (!currentSelectedPost) return;

  const res = await API.updatePostStatus(currentSelectedPost.id, status, rejectionReason);
  if (res.success) {
    closeModal('detailModal');
    showToast(status === 'approved' ? 'Post aprobado.' : 'Post rechazado con observaciones.', 'success');
    await loadCalendarAndStats();
  } else {
    showToast(res.message || 'Error al actualizar estado.', 'error');
  }
}

function openNewPostModal() {
  editingPostId = null;
  document.getElementById('postForm').reset();
  if (activeClient) {
    document.getElementById('postClient').value = activeClient;
  }
  const timeInput = document.getElementById('postTime');
  if (timeInput && !timeInput.value) timeInput.value = '12:00';
  document.getElementById('postModalTitle').textContent = 'Programar Nuevo Post';
  document.getElementById('postSubmitLabel').textContent = 'Programar Post';
  openModal('postModal');
}

function openEditPostModal(post) {
  editingPostId = post.id;
  document.getElementById('postClient').value = post.clientId || activeClient || '';
  document.getElementById('postTitle').value = post.title || '';
  document.getElementById('postCaption').value = post.caption || '';
  document.getElementById('postMediaType').value = post.mediaType || 'image';

  const rawDate = String(post.scheduledDate || '');
  const [datePart, timePart] = rawDate.split('T');
  document.getElementById('postDate').value = datePart ? datePart.slice(0, 10) : '';
  const timeInput = document.getElementById('postTime');
  if (timeInput) timeInput.value = timePart ? timePart.slice(0, 5) : '12:00';

  document.getElementById('postMediaUrls').value = Array.isArray(post.mediaUrls) ? post.mediaUrls.join(', ') : '';

  document.getElementById('postModalTitle').textContent = 'Editar Post (Reenviar a Revisión)';
  document.getElementById('postSubmitLabel').textContent = 'Guardar Cambios';
  openModal('postModal');
}

async function handleSavePost(e) {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const submitLabel = document.getElementById('postSubmitLabel');
  const prevLabel = submitLabel ? submitLabel.textContent : '';
  if (submitBtn) submitBtn.disabled = true;

  try {
    const rawUrls = document.getElementById('postMediaUrls').value.trim();
    const urls = rawUrls ? rawUrls.split(',').map(u => u.trim()).filter(Boolean) : [];

    // Subir archivos seleccionados a Google Drive si hay alguno
    const fileInput = document.getElementById('postMediaFiles');
    const files = fileInput && fileInput.files ? Array.from(fileInput.files) : [];
    for (let i = 0; i < files.length; i++) {
      if (submitLabel) submitLabel.textContent = `Subiendo ${i + 1}/${files.length} a Drive...`;
      const uploadRes = await API.uploadMedia(files[i]);
      if (uploadRes.success && uploadRes.data && uploadRes.data.url) {
        urls.push(uploadRes.data.url);
      } else {
        showToast(uploadRes.message || `Error al subir ${files[i].name}`, 'error');
        return;
      }
    }

    if (submitLabel) submitLabel.textContent = 'Guardando post...';
    const dateVal = document.getElementById('postDate').value;
    const timeEl = document.getElementById('postTime');
    const timeVal = timeEl && timeEl.value ? timeEl.value : '12:00';
    const postData = {
      clientId: document.getElementById('postClient').value,
      title: document.getElementById('postTitle').value.trim(),
      caption: document.getElementById('postCaption').value.trim(),
      mediaType: document.getElementById('postMediaType').value,
      scheduledDate: dateVal ? `${dateVal}T${timeVal}` : '',
      mediaUrls: urls
    };

    if (!postData.clientId) {
      showToast('Debes seleccionar un cliente antes de guardar el post.', 'error');
      return;
    }

    const wasEditing = Boolean(editingPostId);
    const res = wasEditing
      ? await API.updatePost(editingPostId, postData)
      : await API.createPost(postData);

    if (res.success) {
      editingPostId = null;
      closeModal('postModal');
      document.getElementById('postForm').reset();
      showToast(wasEditing ? 'Post actualizado y reenviado a revisión.' : 'Post programado correctamente.', 'success');
      await loadCalendarAndStats();
    } else {
      showToast(res.message || res.error || 'Error al guardar post.', 'error');
    }
  } catch (err) {
    showToast(`Error al subir o guardar el post: ${err.message}`, 'error');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
    if (submitLabel) submitLabel.textContent = prevLabel;
  }
}

async function handleDeletePost() {
  if (!currentSelectedPost) return;
  if (!confirm(`¿Seguro que deseas eliminar "${currentSelectedPost.title}"?`)) return;

  const res = await API.deletePost(currentSelectedPost.id);
  if (res.success) {
    closeModal('detailModal');
    currentSelectedPost = null;
    showToast('Post eliminado.', 'success');
    await loadCalendarAndStats();
  } else {
    showToast(res.message || 'Error al eliminar post.', 'error');
  }
}

async function handleEditTarget() {
  const current = document.getElementById('kpiTargetVal').textContent;
  const newTarget = prompt('Ingresa la meta mensual de posts para este cliente:', current);
  if (newTarget !== null && !isNaN(newTarget)) {
    const res = await API.updateMonthlyTarget(activeClient, Number(newTarget));
    if (res.success) {
      await loadCalendarAndStats();
    } else {
      alert(res.message || 'Error al actualizar meta.');
    }
  }
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.style.display = 'flex';
    if (window.lucide) window.lucide.createIcons();
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.style.display = 'none';
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}
