# Invitación de boda - Gabriela & Murad

Aplicación completa para gestionar invitaciones personalizadas y confirmaciones de boda.

## Arquitectura

- **Frontend:** React 19 y Vite.
- **Backend:** Node.js 22 y Express 5.
- **Base de datos:** MongoDB 8 mediante Mongoose.
- **Autenticación administrativa:** JWT almacenado en una cookie `HttpOnly`.
- **Correos:** API de Resend desde el servidor.
- **Actualización del panel:** Server-Sent Events y respaldo por consulta periódica.
- **Producción:** una imagen Docker sirve la API y el frontend; MongoDB se ejecuta como servicio separado.

## Funcionalidad

- Enlaces personalizados con tokens aleatorios.
- Cupos individuales por invitación.
- RSVP con nombres de acompañantes y correo de confirmación.
- Respuestas idempotentes, fecha límite y control de frecuencia.
- Panel privado para crear, editar, buscar, filtrar e importar invitados.
- Importación y exportación CSV.
- Reintento de correos con error.
- Español, inglés y árabe.

## Desarrollo local rápido

Requiere Node.js 22. El modo local crea una base MongoDB temporal automáticamente, por lo que no exige instalar MongoDB ni Docker.

```powershell
npm install
npm install --prefix server
Copy-Item .env.example .env.local
npm run dev:full
```

La invitación se abre en `http://127.0.0.1:5174/` y el panel en `http://127.0.0.1:5174/?admin=1`.

La API escucha en `http://127.0.0.1:4001/`; el estado se puede consultar en `/api/health`.

Credenciales exclusivas del modo local:

- Correo: `admin@local.test`
- Contraseña: `admin-demo-2026`

Los datos temporales se eliminan al detener el proceso. Para desarrollo con una base persistente, configura `server/.env` y ejecuta `npm run dev:api:persistent` junto con `npm run dev`.

## Variables del servidor

Configura `server/.env`:

- `MONGODB_URI`: conexión a MongoDB.
- `JWT_SECRET`: secreto aleatorio de al menos 32 caracteres.
- `ADMIN_EMAIL`: correo permitido para el panel.
- `ADMIN_PASSWORD_HASH`: hash bcrypt recomendado para producción.
- `ADMIN_PASSWORD`: contraseña directa, solamente para desarrollo local.
- `COOKIE_SECURE=true`: obligatorio detrás de HTTPS en producción.
- `RESEND_API_KEY`: clave de Resend.
- `COUPLE_EMAILS`: uno o más correos separados por comas.
- `EMAIL_FROM`: remitente verificado en Resend; para este proyecto se usará `Invitaciones Gabriela & Murad <invitaciones@gabrielaymurad.site>`.
- `EMAIL_REPLY_TO`: correo real en el que los novios recibirán las respuestas de los invitados.
- `PUBLIC_SITE_URL`: dominio público de la invitación.
- `RSVP_DEADLINE`: fecha límite en formato ISO.

Para crear un hash bcrypt sin guardar la contraseña en el historial:

```powershell
node -e "import('bcryptjs').then(async ({default:b}) => console.log(await b.hash(process.argv[1], 12)))" "CAMBIA_ESTA_CONTRASEÑA"
```

## Docker

1. Copia `server/.env.example` a `server/.env` y completa los valores.
2. Ejecuta:

```powershell
docker compose up --build -d
```

La aplicación queda disponible en `http://localhost:8080/`. En el servidor público se recomienda colocar Nginx, Caddy o el proxy del proveedor delante del puerto 4001 y activar HTTPS.

## Pruebas y compilación

```powershell
npm test
npm run build:pages
```

## Seguridad operativa

- No publiques archivos `.env`.
- Usa HTTPS y `COOKIE_SECURE=true`.
- Utiliza una contraseña administrativa única y un `JWT_SECRET` aleatorio.
- Restringe MongoDB a la red privada del servidor; no expongas el puerto 27017 a Internet.
- Mantén copias de seguridad periódicas de la base de datos.
