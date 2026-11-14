import { config } from '../config/index.js';
import { hashPassword, verifyPassword, signJwt } from '../utils/security.js';

export class AuthService {
  constructor(sheetsRepository, jwtSecret = config.jwtSecret) {
    this.sheetsRepository = sheetsRepository;
    this.jwtSecret = jwtSecret;
  }

  async login(username, password) {
    const users = await this.sheetsRepository.getUsers();
    const user = users.find(u => u.username === username && verifyPassword(password, u.password));

    if (!user) {
      throw new Error('Credenciales incorrectas');
    }

    const safeUser = {
      id: user.id,
      username: user.username,
      role: user.role, // 'superadmin' | 'operator' | 'client'
      clientId: user.clientId || '',
      name: user.name || user.username
    };

    const token = signJwt(safeUser, this.jwtSecret);
    return { user: safeUser, token };
  }

  async createUser(userData, currentUser) {
    if (currentUser.role !== 'superadmin') {
      throw new Error('Solo el superusuario puede crear nuevos usuarios.');
    }

    if (!userData.username || !userData.password || !userData.role) {
      throw new Error('Usuario, contraseña y rol son requeridos.');
    }

    const validRoles = ['superadmin', 'operator', 'client'];
    if (!validRoles.includes(userData.role)) {
      throw new Error(`Rol inválido. Debe ser: ${validRoles.join(', ')}`);
    }

    if (userData.role === 'client' && !userData.clientId) {
      throw new Error('Los usuarios clientes deben estar asignados a un cliente específico.');
    }

    const userToSave = {
      ...userData,
      password: hashPassword(userData.password)
    };

    return await this.sheetsRepository.saveUser(userToSave);
  }

  async createClient(clientData, currentUser) {
    if (currentUser.role !== 'superadmin') {
      throw new Error('Solo el superusuario puede registrar nuevos clientes.');
    }

    if (!clientData.name) {
      throw new Error('El nombre del cliente es obligatorio.');
    }

    return await this.sheetsRepository.saveClient(clientData);
  }

  async getClients(currentUser) {
    const clients = await this.sheetsRepository.getClients();
    if (currentUser.role === 'client') {
      return clients.filter(c => String(c.id) === String(currentUser.clientId));
    }
    if (currentUser.role === 'operator') {
      const assignments = await this.sheetsRepository.getAssignments();
      const allowedIds = new Set(
        assignments
          .filter(a => String(a.userId) === String(currentUser.id))
          .map(a => String(a.clientId))
      );
      return clients.filter(c => allowedIds.has(String(c.id)));
    }
    return clients;
  }

  async getAssignments(currentUser) {
    const assignments = await this.sheetsRepository.getAssignments();
    if (currentUser.role === 'superadmin') {
      return assignments;
    }
    if (currentUser.role === 'operator') {
      return assignments.filter(a => String(a.userId) === String(currentUser.id));
    }
    throw new Error('No tienes permisos para consultar asignaciones.');
  }

  async createAssignment(data, currentUser) {
    if (currentUser.role !== 'superadmin') {
      throw new Error('Solo el superusuario puede asignar clientes o tareas.');
    }
    if (!data.userId || !data.clientId) {
      throw new Error('Debes seleccionar un operario y un cliente.');
    }
    return await this.sheetsRepository.saveAssignment(data);
  }

  async deleteAssignment(assignmentId, currentUser) {
    if (currentUser.role !== 'superadmin') {
      throw new Error('Solo el superusuario puede eliminar asignaciones.');
    }
    return await this.sheetsRepository.deleteAssignment(assignmentId);
  }

  async getUsers(currentUser) {
    if (currentUser.role !== 'superadmin') {
      throw new Error('No tienes permisos para ver la lista de usuarios.');
    }
    const users = await this.sheetsRepository.getUsers();
    return users.map(u => ({
      id: u.id,
      username: u.username,
      role: u.role,
      clientId: u.clientId,
      name: u.name
    }));
  }
}
