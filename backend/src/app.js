import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

import { config } from './config/index.js';
import { verifyJwt } from './utils/security.js';
import { GoogleSheetsRepository } from './repositories/GoogleSheetsRepository.js';
import { PostService } from './services/PostService.js';
import { AuthService } from './services/AuthService.js';
import { PostController } from './controllers/PostController.js';
import { AuthController } from './controllers/AuthController.js';
import { createPostRoutes } from './routes/postRoutes.js';
import { createAuthRoutes } from './routes/authRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Secreto efímero solo para desarrollo local si no se define JWT_SECRET
const devFallbackSecret = crypto.randomBytes(32).toString('hex');

export function createApp() {
  const app = express();
  const jwtSecret = config.jwtSecret || devFallbackSecret;

  // Middlewares
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
  app.use(express.json());

  // Inyección de Dependencias (SOLID)
  const sheetsRepository = new GoogleSheetsRepository();
  const postService = new PostService(sheetsRepository);
  const authService = new AuthService(sheetsRepository, jwtSecret);
  const postController = new PostController(postService);
  const authController = new AuthController(authService);

  // Middleware de autenticación JWT para rutas protegidas
  const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const payload = verifyJwt(token, jwtSecret);

    if (!payload) {
      return res.status(401).json({ success: false, message: 'Sesión inválida o expirada. Inicia sesión nuevamente.' });
    }
    req.user = payload;
    next();
  };

  // Rutas públicas
  app.get(['/api/health', '/health'], (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Rutas de Autenticación (/login es pública dentro de authRoutes; el resto requiere JWT)
  app.use(['/api/auth', '/auth'], (req, res, next) => {
    if (req.path === '/login' && req.method === 'POST') return next();
    return requireAuth(req, res, next);
  }, createAuthRoutes(authController));

  // Rutas de Posts (todas protegidas por JWT)
  app.use(['/api/posts', '/posts'], requireAuth, createPostRoutes(postController));

  // Servir estáticos en desarrollo local
  const staticPath = path.resolve(__dirname, '../../');
  app.use(express.static(staticPath));

  // Manejador global de errores para Serverless
  app.use((err, req, res, next) => {
    console.error('API Error:', err);
    res.status(500).json({ success: false, message: err.message || 'Error interno del servidor' });
  });

  return app;
}
