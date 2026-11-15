// Módulo de Administración: Clientes, Usuarios y Asignaciones
let editingUserId = null;
let cachedUsers = [];
let editingClientId = null;
let cachedClients = [];

async function loadManageData() {
  const [clientsRes, usersRes, assignRes] = await Promise.all([
    API.getClients(),
    API.getUsers(),
    API.getAssignments()
  ]);

  const cTbody = document.getElementById('clientsTableBody');
  const assignClientSelect = document.getElementById('assignClientSelect');
  const userClientSelect = document.getElementById('newUserClientSelect');
  const prevUserClientVal = userClientSelect ? userClientSelect.value : '';
  cTbody.innerHTML = '';
  if (assignClientSelect) assignClientSelect.innerHTML = '<option value="">Selecciona cliente...</option>';
  if (userClientSelect) userClientSelect.innerHTML = '<option value="">Selecciona qué calendario verá...</option>';

  const clientsMap = {};
  cachedClients = clientsRes.success ? (clientsRes.data || []) : [];
  if (clientsRes.success) {
    cachedClients.forEach(c => {
      clientsMap[c.id] = c.name;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(c.name)}</strong></td>
        <td>${Number(c.monthlyTarget || 0)} posts</td>
        <td>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button type="button" class="btn btn-secondary btn-sm" onclick="editClient('${escapeHtml(c.id)}')">Editar</button>
            <button type="button" class="btn btn-outline-danger btn-sm" onclick="removeClient('${escapeHtml(c.id)}')">Eliminar</button>
          </div>
        </td>
      `;
      cTbody.appendChild(tr);

      if (assignClientSelect) {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        assignClientSelect.appendChild(opt);
      }

      if (userClientSelect) {
        const userOpt = document.createElement('option');
        userOpt.value = c.id;
        userOpt.textContent = c.name;
        userClientSelect.appendChild(userOpt);
      }
    });
  }
  if (userClientSelect && prevUserClientVal) {
    userClientSelect.value = prevUserClientVal;
  }
  syncUserRoleClientField();

  const uTbody = document.getElementById('usersTableBody');
  const aTbody = document.getElementById('assignmentsTableBody');
  const assignUserSelect = document.getElementById('assignUserSelect');
  uTbody.innerHTML = '';
  if (aTbody) aTbody.innerHTML = '';
  if (assignUserSelect) assignUserSelect.innerHTML = '<option value="">Selecciona operario...</option>';

  const usersMap = {};
  cachedUsers = usersRes.success ? (usersRes.data || []) : [];
  if (usersRes.success) {
    cachedUsers.forEach(u => {
      usersMap[u.id] = u.name || u.username;
      const clientName = u.clientId ? (clientsMap[u.clientId] || u.clientId) : 'Todos / Sin restringir';

      const trUser = document.createElement('tr');
      trUser.innerHTML = `
        <td><strong>${escapeHtml(u.name || u.username)}</strong></td>
        <td><code>${escapeHtml(u.username)}</code></td>
        <td><code>${escapeHtml(u.password || '')}</code></td>
        <td><span class="user-role-badge">${escapeHtml(u.role)}</span></td>
        <td>${escapeHtml(clientName)}</td>
        <td>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button type="button" class="btn btn-secondary btn-sm" onclick="editUser('${escapeHtml(u.id)}')">Editar</button>
            <button type="button" class="btn btn-outline-danger btn-sm" onclick="removeUser('${escapeHtml(u.id)}')">Eliminar</button>
          </div>
        </td>
      `;
      uTbody.appendChild(trUser);

      if (assignUserSelect && u.role === 'operator') {
        const opt = document.createElement('option');
        opt.value = u.id;
        opt.textContent = `${u.name || u.username} (${u.username})`;
        assignUserSelect.appendChild(opt);
      }
    });
  }

  if (aTbody && assignRes && assignRes.success) {
    assignRes.data.forEach(a => {
      const trAssign = document.createElement('tr');
      trAssign.innerHTML = `
        <td><strong>${escapeHtml(usersMap[a.userId] || a.userId)}</strong></td>
        <td>${escapeHtml(clientsMap[a.clientId] || a.clientId)}</td>
        <td>${escapeHtml(a.taskNote || '-')}</td>
        <td><button class="btn btn-outline-danger btn-sm" onclick="removeAssignment('${escapeHtml(a.id)}')">Quitar</button></td>
      `;
      aTbody.appendChild(trAssign);
    });
  }
  if (window.lucide) window.lucide.createIcons();
}

window.removeAssignment = async (assignmentId) => {
  if (!confirm('¿Quitar esta asignación?')) return;
  const res = await API.deleteAssignment(assignmentId);
  if (res.success) {
    await loadManageData();
  } else {
    showToast(res.message || 'Error al eliminar asignación.', 'error');
  }
};

async function handleCreateAssignment(e) {
  e.preventDefault();
  const data = {
    userId: document.getElementById('assignUserSelect').value,
    clientId: document.getElementById('assignClientSelect').value,
    taskNote: document.getElementById('assignTaskNote').value.trim()
  };

  const res = await API.createAssignment(data);
  if (res.success) {
    document.getElementById('newAssignmentForm').reset();
    await loadManageData();
  } else {
    showToast(res.message || 'Error al guardar asignación.', 'error');
  }
}

window.editSpecificTarget = async (clientId, current) => {
  const val = prompt('Nueva meta mensual de posts:', current);
  if (val !== null && !isNaN(val)) {
    await API.updateMonthlyTarget(clientId, Number(val));
    loadManageData();
    loadCalendarAndStats();
  }
};

function resetClientForm() {
  editingClientId = null;
  document.getElementById('newClientForm').reset();
  const titleEl = document.getElementById('clientFormTitle');
  const labelEl = document.getElementById('clientSubmitLabel');
  const cancelBtn = document.getElementById('cancelEditClientBtn');
  if (titleEl) titleEl.textContent = 'Crear Nuevo Cliente';
  if (labelEl) labelEl.textContent = 'Crear Cliente';
  if (cancelBtn) cancelBtn.style.display = 'none';
}

window.editClient = (clientId) => {
  const client = cachedClients.find(c => String(c.id) === String(clientId));
  if (!client) return;
  editingClientId = client.id;
  document.getElementById('newClientName').value = client.name || '';
  document.getElementById('newClientTarget').value = Number(client.monthlyTarget || 0);
  const titleEl = document.getElementById('clientFormTitle');
  const labelEl = document.getElementById('clientSubmitLabel');
  const cancelBtn = document.getElementById('cancelEditClientBtn');
  if (titleEl) titleEl.textContent = `Editando Cliente: ${client.name}`;
  if (labelEl) labelEl.textContent = 'Actualizar Cliente';
  if (cancelBtn) cancelBtn.style.display = 'inline-flex';
};

window.removeClient = async (clientId) => {
  const client = cachedClients.find(c => String(c.id) === String(clientId));
  const label = client ? client.name : clientId;
  if (!confirm(`¿Eliminar el cliente "${label}"?`)) return;
  const res = await API.deleteClient(clientId);
  if (res.success) {
    if (String(editingClientId) === String(clientId)) resetClientForm();
    showToast('Cliente eliminado.', 'success');
    await loadClients();
    await loadManageData();
    await loadCalendarAndStats();
  } else {
    showToast(res.message || 'No se pudo eliminar el cliente.', 'error');
  }
};

window.removeUser = async (userId) => {
  const current = Auth.getCurrentUser();
  if (current && String(current.id) === String(userId)) {
    showToast('No puedes eliminar el usuario con el que iniciaste sesión.', 'error');
    return;
  }
  const user = cachedUsers.find(u => String(u.id) === String(userId));
  const label = user ? (user.name || user.username) : userId;
  if (!confirm(`¿Eliminar el usuario "${label}"?`)) return;
  const res = await API.deleteUser(userId);
  if (res.success) {
    if (String(editingUserId) === String(userId)) resetUserForm();
    showToast('Usuario eliminado.', 'success');
    await loadManageData();
  } else {
    showToast(res.message || 'No se pudo eliminar el usuario.', 'error');
  }
};

async function handleCreateClient(e) {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;

  try {
    const name = document.getElementById('newClientName').value.trim();
    const target = document.getElementById('newClientTarget').value;

    const res = editingClientId
      ? await API.updateClient({ id: editingClientId, name, monthlyTarget: target })
      : await API.createClient({ name, monthlyTarget: target });

    if (res.success) {
      showToast(editingClientId ? 'Cliente actualizado correctamente.' : 'Cliente creado correctamente.', 'success');
      resetClientForm();
      await loadClients();
      await loadManageData();
      await loadCalendarAndStats();
    } else {
      showToast(res.message || 'Error al guardar cliente.', 'error');
    }
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

function syncUserRoleClientField() {
  const roleEl = document.getElementById('newUserRole');
  const clientSelect = document.getElementById('newUserClientSelect');
  const clientLabel = document.getElementById('newUserClientLabel');
  if (!roleEl || !clientSelect) return;

  const isClient = roleEl.value === 'client';
  const defaultOpt = clientSelect.querySelector('option[value=""]');

  if (isClient) {
    if (clientLabel) clientLabel.textContent = 'Calendario / Cliente que verá';
    if (defaultOpt) defaultOpt.textContent = 'Selecciona qué calendario verá...';
    clientSelect.disabled = false;
    clientSelect.required = true;
  } else {
    if (clientLabel) clientLabel.textContent = 'Cliente asignado';
    if (defaultOpt) defaultOpt.textContent = 'Todos los calendarios (no requiere asignar uno)';
    clientSelect.value = '';
    clientSelect.required = false;
    clientSelect.disabled = true;
  }
}

function resetUserForm() {
  editingUserId = null;
  document.getElementById('newUserForm').reset();
  document.getElementById('userFormTitle').textContent = 'Crear Nuevo Usuario';
  document.getElementById('userSubmitLabel').textContent = 'Guardar Usuario';
  const cancelBtn = document.getElementById('cancelEditUserBtn');
  if (cancelBtn) cancelBtn.style.display = 'none';
  syncUserRoleClientField();
}

window.editUser = (userId) => {
  const user = cachedUsers.find(u => String(u.id) === String(userId));
  if (!user) return;
  editingUserId = user.id;
  document.getElementById('newUserName').value = user.name || '';
  document.getElementById('newUserUsername').value = user.username || '';
  document.getElementById('newUserPassword').value = user.password || '';
  document.getElementById('newUserRole').value = user.role || 'client';
  syncUserRoleClientField();
  document.getElementById('newUserClientSelect').value = user.clientId || '';
  document.getElementById('userFormTitle').textContent = `Editando Usuario: ${user.username}`;
  document.getElementById('userSubmitLabel').textContent = 'Actualizar Usuario';
  const cancelBtn = document.getElementById('cancelEditUserBtn');
  if (cancelBtn) cancelBtn.style.display = 'inline-flex';
};

async function handleCreateUser(e) {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;

  try {
    const role = document.getElementById('newUserRole').value;
    const clientId = role === 'client' ? document.getElementById('newUserClientSelect').value : '';

    if (role === 'client' && !clientId) {
      showToast('Selecciona el calendario / cliente que verá este usuario.', 'error');
      return;
    }

    const userData = {
      name: document.getElementById('newUserName').value.trim(),
      username: document.getElementById('newUserUsername').value.trim(),
      password: document.getElementById('newUserPassword').value.trim(),
      role,
      clientId
    };

    const res = editingUserId
      ? await API.updateUser({ id: editingUserId, ...userData })
      : await API.createUser(userData);

    if (res.success) {
      showToast(editingUserId ? 'Usuario actualizado correctamente.' : 'Usuario creado correctamente.', 'success');
      resetUserForm();
      await loadManageData();
    } else {
      showToast(res.message || 'Error al guardar usuario.', 'error');
    }
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}
