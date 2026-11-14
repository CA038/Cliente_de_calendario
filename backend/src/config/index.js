import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carga .env desde la raíz del proyecto y, si existe, también desde backend/.env
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: process.env.PORT || 3001,
  googleScriptUrl: process.env.GOOGLE_SCRIPT_WEBAPP_URL || '',
  jwtSecret: process.env.JWT_SECRET || ''
};
