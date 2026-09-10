# Invitación de boda - Gabriela & Murad

Aplicación React + Node con un enlace público único, RSVP, panel administrativo y correos de confirmación.

## Arquitectura

- **Frontend:** React 19 y Vite.
- **Backend:** Node.js (20 o superior) y Express 5.
- **Base de datos:** MySQL mediante `mysql2`.
- **Panel:** JWT en cookie `HttpOnly`.
- **Correos:** Resend desde el backend.
- **Producción:** Node sirve la API y el frontend compilado desde el mismo dominio.

## Desarrollo local

El modo rápido usa una base temporal en memoria; no necesita MySQL ni Docker.

```powershell
npm install
npm install --prefix server
npm run dev:full
```

- Invitación: `http://127.0.0.1:5174/`
- Panel: `http://127.0.0.1:5174/?admin=1`
- API: `http://127.0.0.1:4001/api/health`
- Usuario local: `admin@local.test`
- Contraseña local: `admin-demo-2026`

Para desarrollo persistente, crea `server/.env` desde `server/.env.example`, configura MySQL y ejecuta `npm run dev:api:persistent` junto con `npm run dev`.

## Variables del servidor

- `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`: acceso a MySQL.
- `MYSQL_CONNECTION_LIMIT`: conexiones simultáneas; `5` es suficiente para el hosting compartido.
- `JWT_SECRET`: secreto aleatorio de al menos 32 caracteres.
- `ADMIN_EMAIL`: correo permitido para el panel.
- `ADMIN_PASSWORD_HASH`: hash bcrypt recomendado para producción.
- `ADMIN_PASSWORD`: contraseña directa, solo para desarrollo.
- `COOKIE_SECURE=true`: obligatorio en producción con HTTPS.
- `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `COUPLE_EMAILS`: configuración de correo.
- `PUBLIC_SITE_URL`: `https://gabrielaymurad.site/`.
- `RSVP_DEADLINE`: fecha límite ISO.

La aplicación crea automáticamente las tablas `invitations` y `submissions` al iniciar. El usuario MySQL necesita permisos para crear y modificar tablas dentro de su propia base.

## Publicación en iFastNet/cPanel

1. En cPanel crea una base MySQL, un usuario y asígnale **todos los privilegios** sobre esa base.
2. En **Setup Node.js App**, crea una aplicación con Node 20 o 22, entorno `Production`, URL `gabrielaymurad.site/`, raíz `invitacion/server` y archivo de inicio `src/index.js`.
3. Sube y extrae `release/invitacion-ifastnet.zip` dentro de la carpeta de la cuenta. El ZIP crea la carpeta `invitacion`.
4. En las variables de la aplicación agrega las del archivo `server/.env.example`, usando las credenciales reales de MySQL y Resend.
5. Ejecuta **Run NPM Install** y reinicia la aplicación.
6. Comprueba `https://gabrielaymurad.site/api/health`; debe responder `{"ok":true,"database":"connected"}`.

Para preparar nuevamente el ZIP:

```powershell
npm run package:ifastnet
```

## Docker opcional

`docker compose up --build -d` levanta la aplicación y MySQL 8.4 en `http://localhost:8080/` para un VPS o pruebas locales.

## Pruebas

```powershell
npm test
npm run build:pages
```

## Seguridad

- Nunca subas `.env`, claves de Resend ni contraseñas al repositorio.
- Usa `COOKIE_SECURE=true`, una contraseña administrativa única y un `JWT_SECRET` aleatorio.
- Mantén respaldos periódicos de MySQL desde cPanel.
