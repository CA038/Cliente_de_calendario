# Estado del Proyecto: Calendario de Post
**Cliente / Marca:** Adrian Reyes Creativo  
**Última actualización:** 2026-11-14

---

## 1. Resumen General
Sistema de gestión y aprobación de publicaciones para redes sociales con roles diferenciados, conectado a **Google Sheets en tiempo real** (mediante Google Apps Script Web App), diseño dashboard con **menú lateral (sidebar)** responsivo, autenticación con **JWT + hash scrypt**, respaldado en **GitHub** y desplegado en **Vercel**.

---

## 2. Repositorio Remoto, Despliegue y Variables de Entorno
- **GitHub:** [https://github.com/CA038/Cliente_de_calendario](https://github.com/CA038/Cliente_de_calendario)
- **Vercel URL:** [https://calendario-de-post.vercel.app](https://calendario-de-post.vercel.app)
- **Rama principal:** `main`
- **Frontend:** Estático puro en raíz (`index.html`, `css/`, `js/`), servido por Vercel Edge CDN.
- **Backend Serverless:** Manejado en `api/[...path].js` y `api/index.js` reutilizando `backend/src/app.js`.
- **Variables de Entorno Requeridas en Vercel / `.env`:**
  - `GOOGLE_SCRIPT_WEBAPP_URL`: URL de implementación del Web App de Google Apps Script.
  - `JWT_SECRET`: Clave secreta para firmar y verificar tokens de sesión.

---

## 3. Funcionalidades Implementadas
- [x] **Seguridad y Autenticación (JWT + scrypt):**
  - Login mediante JWT (`Authorization: Bearer <token>`) sin fallback inseguro.
  - Contraseñas hasheadas con `scrypt` + salt en `backend/src/utils/security.js` (con compatibilidad transitoria para contraseñas legadas en Sheets).
  - Accesos demo visibles únicamente en entorno local (`localhost` / `127.0.0.1` / `file:`).
- [x] **Gestión de Roles y Asignaciones Reales:**
  - **Superusuario (`superadmin`):** Control total de clientes, usuarios, metas, asignaciones y publicaciones.
  - **Operario (`operator`):** Acceso filtrado únicamente a los clientes y posts que tiene asignados en la hoja `Assignments`.
  - **Cliente (`client`):** Acceso exclusivo a su propio calendario para ver, aprobar o rechazar publicaciones.
  - **Pestaña Asignar Tareas:** Formulario funcional para asignar y quitar relaciones Operario ↔ Cliente con notas de tarea.
- [x] **CRUD Completo de Posts y Calendario Multimedia:**
  - Crear, ver detalle, **editar** (reenvía a `pending` y limpia rechazo previo) y **eliminar** publicaciones (`PUT` y `DELETE /api/posts/:id`).
  - Normalización de `scheduledDate` en `Code.gs` como texto `YYYY-MM-DDTHH:mm`.
- [x] **Flujo de Aprobación y Meta Mensual:**
  - Botones de Aprobado / Rechazado con motivo obligatorio.
  - Cálculo de `Posts Faltantes` excluyendo posts rechazados (`target - (approved + pending)`).
- [x] **UX y Responsive:**
  - Menú lateral deslizable en móvil/tablet, notificaciones toast, bloqueo de botones en envío y escape HTML contra XSS.

---

## 4. Base de Datos en Google Sheets (`google-apps-script/Code.gs`)
Hojas gestionadas automáticamente por `setupSheets()`:
- `Posts` (`id`, `clientId`, `title`, `caption`, `mediaType`, `mediaUrls`, `scheduledDate`, `status`, `rejectionReason`, `createdAt`)
- `Users` (`id`, `username`, `password`, `role`, `clientId`, `name`)
- `Clients` (`id`, `name`, `monthlyTarget`, `active`)
- `Assignments` (`id`, `userId`, `clientId`, `taskNote`, `createdAt`)
- `Settings` (`key`, `value`)
