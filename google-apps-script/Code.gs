/**
 * Google Apps Script - Base de datos para Calendario de Post
 * Adrian Reyes Creativo
 */

const SPREADSHEET = SpreadsheetApp.getActiveSpreadsheet();

// Inicializa las hojas necesarias con sus encabezados si no existen
function setupSheets() {
  const schemas = {
    'Posts': ['id', 'clientId', 'title', 'caption', 'mediaType', 'mediaUrls', 'scheduledDate', 'status', 'rejectionReason', 'createdAt'],
    'Users': ['id', 'username', 'password', 'role', 'clientId', 'name'],
    'Clients': ['id', 'name', 'monthlyTarget', 'active'],
    'Assignments': ['id', 'userId', 'clientId', 'taskNote', 'createdAt'],
    'Settings': ['key', 'value']
  };

  for (const sheetName in schemas) {
    let sheet = SPREADSHEET.getSheetByName(sheetName);
    if (!sheet) {
      sheet = SPREADSHEET.insertSheet(sheetName);
      sheet.appendRow(schemas[sheetName]);

      // Datos semilla iniciales si la hoja es nueva
      if (sheetName === 'Users') {
        sheet.appendRow(['usr_admin', 'admin', '123', 'superadmin', '', 'Adrian Reyes']);
        sheet.appendRow(['usr_op', 'operario1', '123', 'operator', '', 'Operario Creativo']);
        sheet.appendRow(['usr_cli', 'cliente1', '123', 'client', 'cli_1', 'Cliente Demo']);
      }
      if (sheetName === 'Clients') {
        sheet.appendRow(['cli_1', 'Adrian Reyes Creativo', 15, true]);
      }
    }
  }
}

// Endpoint HTTP GET
function doGet(e) {
  setupSheets();
  const action = e.parameter.action;
  let result = { success: false, message: 'Acción no válida' };

  try {
    switch (action) {
      case 'getPosts':
        result = { success: true, data: getPostsForRequest(e.parameter) };
        break;
      case 'getClients':
        result = { success: true, data: getClientsForRequest(e.parameter) };
        break;
      case 'getUsers':
        result = {
          success: true,
          data: getRowsAsObjects('Users').map(u => ({
            id: u.id,
            username: u.username,
            password: u.password !== undefined ? String(u.password) : '',
            role: u.role,
            clientId: u.clientId || '',
            name: u.name || u.username
          }))
        };
        break;
      case 'getAssignments':
        result = { success: true, data: getRowsAsObjects('Assignments') };
        break;
      case 'getStats':
        result = { success: true, data: getMonthlyStats(e.parameter.clientId, e.parameter.yearMonth) };
        break;
      default:
        result = { success: true, message: 'API Calendario de Post activa' };
    }
  } catch (error) {
    result = { success: false, error: error.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// Endpoint HTTP POST
function doPost(e) {
  setupSheets();
  let result = { success: false, message: 'Sin datos' };

  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;

    switch (action) {
      case 'login':
        result = loginUser(payload.data);
        break;
      case 'loginWithGoogle':
        result = loginWithGoogle(payload.data);
        break;
      case 'uploadMedia':
        result = uploadMediaToDrive(payload.data);
        break;
      case 'savePost':
        result = savePost(payload.data);
        break;
      case 'updatePost':
        result = updatePost(payload.data);
        break;
      case 'deletePost':
        result = deletePost(payload.data.id);
        break;
      case 'updateStatus':
        result = updatePostStatus(payload.data.id, payload.data.status, payload.data.rejectionReason);
        break;
      case 'saveClient':
        result = saveClient(payload.data);
        break;
      case 'updateClient':
        result = updateClient(payload.data);
        break;
      case 'deleteClient':
        result = deleteClient(payload.data.id);
        break;
      case 'saveUser':
        result = saveUser(payload.data);
        break;
      case 'updateUser':
        result = updateUser(payload.data);
        break;
      case 'deleteUser':
        result = deleteUser(payload.data.id);
        break;
      case 'updateTarget':
        result = updateClientTarget(payload.data.clientId, payload.data.monthlyTarget);
        break;
      case 'saveAssignment':
        result = saveAssignment(payload.data);
        break;
      case 'deleteAssignment':
        result = deleteAssignment(payload.data.id);
        break;
      default:
        result = { success: false, message: 'Acción POST desconocida' };
    }
  } catch (error) {
    result = { success: false, error: error.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// Funciones Auxiliares
function getRowsAsObjects(sheetName, filterClientId = null) {
  const sheet = SPREADSHEET.getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0];
  const rows = [];

  for (let i = 1; i < data.length; i++) {
    const row = {};
    headers.forEach((header, colIdx) => {
      let value = data[i][colIdx];
      // Normalizar fechas de Google Sheets para mantener formato YYYY-MM-DDTHH:mm
      if (header === 'scheduledDate' && value instanceof Date) {
        value = Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm");
      }
      row[header] = value;
    });

    if (filterClientId && row.clientId && String(row.clientId) !== String(filterClientId)) {
      continue;
    }
    rows.push(row);
  }
  return rows;
}

function savePost(post) {
  const sheet = SPREADSHEET.getSheetByName('Posts');
  const id = post.id || Utilities.getUuid();
  const createdAt = post.createdAt || new Date().toISOString();
  
  const lastRow = sheet.getLastRow() + 1;
  sheet.appendRow([
    id,
    post.clientId || '',
    post.title || '',
    post.caption || '',
    post.mediaType || 'image',
    JSON.stringify(post.mediaUrls || []),
    post.scheduledDate || '',
    post.status || 'pending', // pending, approved, rejected
    post.rejectionReason || '',
    createdAt
  ]);
  // Forzar formato de texto plano en scheduledDate para evitar conversión automática de Sheets
  sheet.getRange(lastRow, 7).setNumberFormat('@');

  return { success: true, id: id };
}

function updatePost(post) {
  const sheet = SPREADSHEET.getSheetByName('Posts');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(post.id)) {
      const rowNum = i + 1;
      sheet.getRange(rowNum, 2).setValue(post.clientId || data[i][1]);
      sheet.getRange(rowNum, 3).setValue(post.title || '');
      sheet.getRange(rowNum, 4).setValue(post.caption || '');
      sheet.getRange(rowNum, 5).setValue(post.mediaType || 'image');
      sheet.getRange(rowNum, 6).setValue(JSON.stringify(post.mediaUrls || []));
      sheet.getRange(rowNum, 7).setNumberFormat('@').setValue(post.scheduledDate || '');
      sheet.getRange(rowNum, 8).setValue(post.status || 'pending');
      sheet.getRange(rowNum, 9).setValue('');
      return { success: true, message: 'Post actualizado' };
    }
  }
  return { success: false, message: 'Post no encontrado' };
}

function deletePost(postId) {
  const sheet = SPREADSHEET.getSheetByName('Posts');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(postId)) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Post eliminado' };
    }
  }
  return { success: false, message: 'Post no encontrado' };
}

function updatePostStatus(postId, status, reason = '') {
  const sheet = SPREADSHEET.getSheetByName('Posts');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(postId)) {
      sheet.getRange(i + 1, 8).setValue(status); // Columna 8: status
      sheet.getRange(i + 1, 9).setValue(reason || ''); // Columna 9: rejectionReason
      return { success: true, message: 'Estado actualizado' };
    }
  }
  return { success: false, message: 'Post no encontrado' };
}

function updateClientTarget(clientId, target) {
  const sheet = SPREADSHEET.getSheetByName('Clients');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(clientId)) {
      sheet.getRange(i + 1, 3).setValue(Number(target));
      return { success: true, message: 'Meta actualizada' };
    }
  }
  return { success: false, message: 'Cliente no encontrado' };
}

function saveClient(client) {
  const sheet = SPREADSHEET.getSheetByName('Clients');
  const id = client.id || Utilities.getUuid();
  sheet.appendRow([id, client.name, Number(client.monthlyTarget || 0), true]);
  return { success: true, id: id };
}

function updateClient(client) {
  const sheet = SPREADSHEET.getSheetByName('Clients');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(client.id)) {
      const rowNum = i + 1;
      sheet.getRange(rowNum, 2).setValue(client.name || data[i][1]);
      sheet.getRange(rowNum, 3).setValue(Number(client.monthlyTarget || 0));
      return { success: true, message: 'Cliente actualizado' };
    }
  }
  return { success: false, message: 'Cliente no encontrado' };
}

function deleteClient(clientId) {
  const sheet = SPREADSHEET.getSheetByName('Clients');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(clientId)) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Cliente eliminado' };
    }
  }
  return { success: false, message: 'Cliente no encontrado' };
}

function updatePost(post) {
  const sheet = SPREADSHEET.getSheetByName('Posts');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(post.id)) {
      const rowNum = i + 1;
      sheet.getRange(rowNum, 2).setValue(post.clientId || data[i][1]);
      sheet.getRange(rowNum, 3).setValue(post.title || '');
      sheet.getRange(rowNum, 4).setValue(post.caption || '');
      sheet.getRange(rowNum, 5).setValue(post.mediaType || 'image');
      sheet.getRange(rowNum, 6).setValue(JSON.stringify(post.mediaUrls || []));
      sheet.getRange(rowNum, 7).setNumberFormat('@').setValue(post.scheduledDate || '');
      sheet.getRange(rowNum, 8).setValue(post.status || 'pending');
      sheet.getRange(rowNum, 9).setValue('');
      return { success: true, message: 'Post actualizado' };
    }
  }
  return { success: false, message: 'Post no encontrado' };
}

function deletePost(postId) {
  const sheet = SPREADSHEET.getSheetByName('Posts');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(postId)) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Post eliminado' };
    }
  }
  return { success: false, message: 'Post no encontrado' };
}

function saveUser(user) {
  const sheet = SPREADSHEET.getSheetByName('Users');
  const id = user.id || Utilities.getUuid();
  sheet.appendRow([id, user.username, user.password, user.role, user.clientId || '', user.name || '']);
  return { success: true, id: id };
}

function updateUser(user) {
  const sheet = SPREADSHEET.getSheetByName('Users');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(user.id)) {
      const rowNum = i + 1;
      sheet.getRange(rowNum, 2).setValue(user.username || data[i][1]);
      if (user.password !== undefined) {
        sheet.getRange(rowNum, 3).setValue(String(user.password));
      }
      sheet.getRange(rowNum, 4).setValue(user.role || data[i][3]);
      sheet.getRange(rowNum, 5).setValue(user.clientId !== undefined ? user.clientId : data[i][4]);
      sheet.getRange(rowNum, 6).setValue(user.name !== undefined ? user.name : data[i][5]);
      return { success: true, message: 'Usuario actualizado' };
    }
  }
  return { success: false, message: 'Usuario no encontrado' };
}

function deleteUser(userId) {
  const sheet = SPREADSHEET.getSheetByName('Users');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(userId)) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Usuario eliminado' };
    }
  }
  return { success: false, message: 'Usuario no encontrado' };
}

function saveAssignment(assignment) {
  const sheet = SPREADSHEET.getSheetByName('Assignments');
  const id = assignment.id || Utilities.getUuid();
  const createdAt = assignment.createdAt || new Date().toISOString();
  sheet.appendRow([id, assignment.userId || '', assignment.clientId || '', assignment.taskNote || '', createdAt]);
  return { success: true, id: id };
}

function deleteAssignment(assignmentId) {
  const sheet = SPREADSHEET.getSheetByName('Assignments');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(assignmentId)) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Asignación eliminada' };
    }
  }
  return { success: false, message: 'Asignación no encontrada' };
}

const GOOGLE_CLIENT_ID = '1054676254470-5m9duhfa3f5tjekb6197nkok1soanf54.apps.googleusercontent.com';

function loginWithGoogle(data) {
  if (!data || !data.idToken) {
    return { success: false, message: 'Token de Google requerido' };
  }

  let info;
  try {
    const res = UrlFetchApp.fetch(
      'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(data.idToken),
      { muteHttpExceptions: true }
    );
    if (res.getResponseCode() !== 200) {
      return { success: false, message: 'Token de Google inválido o expirado' };
    }
    info = JSON.parse(res.getContentText());
  } catch (err) {
    return { success: false, message: 'Error al validar token con Google: ' + err.message };
  }

  if (info.aud !== GOOGLE_CLIENT_ID || String(info.email_verified) !== 'true' || !info.email) {
    return { success: false, message: 'Cuenta de Google no autorizada' };
  }

  const email = String(info.email).trim().toLowerCase();
  const users = getRowsAsObjects('Users');
  const user = users.find(u => String(u.username || '').trim().toLowerCase() === email);

  if (!user) {
    return {
      success: false,
      message: 'El correo ' + email + ' no está registrado. Pide al administrador que lo agregue.'
    };
  }

  return {
    success: true,
    data: {
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        clientId: user.clientId || '',
        name: user.name || info.name || user.username
      }
    }
  };
}

function loginUser(credentials) {
  if (!credentials || !credentials.username) {
    return { success: false, message: 'Usuario y contraseña requeridos' };
  }
  const users = getRowsAsObjects('Users');
  const user = users.find(
    u => String(u.username) === String(credentials.username) && String(u.password) === String(credentials.password)
  );
  if (!user) {
    return { success: false, message: 'Credenciales incorrectas' };
  }
  return {
    success: true,
    data: {
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        clientId: user.clientId || '',
        name: user.name || user.username
      }
    }
  };
}

function getClientsForRequest(params) {
  const clients = getRowsAsObjects('Clients');
  const role = params.role || '';
  const userId = params.userId || '';
  const clientId = params.clientId || '';

  if (role === 'client') {
    return clientId ? clients.filter(c => String(c.id) === String(clientId)) : [];
  }
  if (role === 'operator' && userId) {
    const assignments = getRowsAsObjects('Assignments');
    const allowed = {};
    assignments.forEach(a => {
      if (String(a.userId) === String(userId)) allowed[String(a.clientId)] = true;
    });
    return clients.filter(c => Boolean(allowed[String(c.id)]));
  }
  return clients;
}

function getPostsForRequest(params) {
  const role = params.role || '';
  const userId = params.userId || '';
  const filterClientId = params.clientId || null;

  if (role === 'client' && !filterClientId) {
    return [];
  }

  let posts = getRowsAsObjects('Posts', filterClientId);

  if (role === 'client') {
    posts = posts.filter(p => String(p.clientId) === String(filterClientId));
  }

  if (role === 'operator' && userId) {
    const assignments = getRowsAsObjects('Assignments');
    const allowed = {};
    assignments.forEach(a => {
      if (String(a.userId) === String(userId)) allowed[String(a.clientId)] = true;
    });
    posts = posts.filter(p => Boolean(allowed[String(p.clientId)]));
  }

  return posts.map(post => {
    let parsedMedia = [];
    try {
      parsedMedia = typeof post.mediaUrls === 'string' ? JSON.parse(post.mediaUrls) : (post.mediaUrls || []);
    } catch (err) {
      parsedMedia = post.mediaUrls ? [post.mediaUrls] : [];
    }
    post.mediaUrls = parsedMedia;
    return post;
  });
}

function getMonthlyStats(clientId, yearMonth) {
  const clients = getRowsAsObjects('Clients');
  const client = clients.find(c => String(c.id) === String(clientId));
  const target = client ? Number(client.monthlyTarget || 0) : 0;

  const ym = yearMonth || new Date().toISOString().slice(0, 7);
  const posts = getRowsAsObjects('Posts', clientId);
  const monthPosts = posts.filter(p => p.scheduledDate && String(p.scheduledDate).indexOf(ym) === 0);

  const approvedCount = monthPosts.filter(p => p.status === 'approved').length;
  const pendingCount = monthPosts.filter(p => p.status === 'pending').length;
  const rejectedCount = monthPosts.filter(p => p.status === 'rejected').length;
  const totalScheduled = monthPosts.length;
  const remainingPosts = Math.max(0, target - (approvedCount + pendingCount));

  return {
    monthlyTarget: target,
    totalScheduled: totalScheduled,
    approvedCount: approvedCount,
    pendingCount: pendingCount,
    rejectedCount: rejectedCount,
    remainingPosts: remainingPosts
  };
}

function uploadMediaToDrive(data) {
  if (!data || !data.base64Data || !data.fileName) {
    return { success: false, message: 'Archivo inválido o vacío' };
  }

  const folderName = 'Calendario_Post_Media';
  const folders = DriveApp.getFoldersByName(folderName);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

  const bytes = Utilities.base64Decode(data.base64Data);
  const mimeType = data.mimeType || 'application/octet-stream';
  const blob = Utilities.newBlob(bytes, mimeType, data.fileName);
  const file = folder.createFile(blob);

  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const fileId = file.getId();
  const isVideo = mimeType.indexOf('video/') === 0;
  const url = isVideo
    ? 'https://drive.google.com/file/d/' + fileId + '/preview'
    : 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1200';

  return {
    success: true,
    data: {
      id: fileId,
      url: url,
      mimeType: mimeType
    }
  };
}

function updatePost(post) {
  const sheet = SPREADSHEET.getSheetByName('Posts');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(post.id)) {
      const rowNum = i + 1;
      sheet.getRange(rowNum, 2).setValue(post.clientId || data[i][1]);
      sheet.getRange(rowNum, 3).setValue(post.title || '');
      sheet.getRange(rowNum, 4).setValue(post.caption || '');
      sheet.getRange(rowNum, 5).setValue(post.mediaType || 'image');
      sheet.getRange(rowNum, 6).setValue(JSON.stringify(post.mediaUrls || []));
      sheet.getRange(rowNum, 7).setNumberFormat('@').setValue(post.scheduledDate || '');
      sheet.getRange(rowNum, 8).setValue(post.status || 'pending');
      sheet.getRange(rowNum, 9).setValue('');
      return { success: true, message: 'Post actualizado' };
    }
  }
  return { success: false, message: 'Post no encontrado' };
}

function deletePost(postId) {
  const sheet = SPREADSHEET.getSheetByName('Posts');
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(postId)) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Post eliminado' };
    }
  }
  return { success: false, message: 'Post no encontrado' };
}
