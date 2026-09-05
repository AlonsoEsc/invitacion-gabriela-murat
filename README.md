# Invitación de boda - Gabriela & Murad

Invitación digital trilingüe con enlaces personalizados, RSVP persistente, nombres de acompañantes, panel administrativo en tiempo real y confirmaciones por correo.

## Arquitectura

- **Frontend:** React 19 y Vite, publicado en GitHub Pages.
- **Base de datos:** Cloud Firestore.
- **API pública y administrativa:** Firebase Cloud Functions callable.
- **Acceso administrativo:** Firebase Authentication con correo y contraseña.
- **Correo transaccional:** Resend desde Cloud Functions.
- **Tiempo real:** listener de Firestore en el panel administrativo.

La invitación pública nunca escribe directamente en Firestore. El token se envía a una función que valida la invitación, cupos, acompañantes, correo y fecha límite. Las reglas de Firestore solo permiten lectura administrativa autenticada.

## Flujo para invitados

Cada enlace utiliza un token aleatorio:

```text
https://alonsoesc.github.io/invitacion-gabriela-murat/?inv=TOKEN&lang=es
```

El invitado puede:

1. Ver su nombre dentro de la invitación.
2. Consultar la cantidad máxima de cupos asignada.
3. Indicar si asistirá o no.
4. Registrar el nombre de cada acompañante.
5. Agregar un mensaje opcional.
6. Recibir una confirmación por correo.
7. Volver a abrir el enlace y actualizar su respuesta antes de la fecha límite.

La novia recibe simultáneamente un correo con la respuesta y puede consultarla en el panel.

## Panel administrativo

El panel se abre en:

```text
https://alonsoesc.github.io/invitacion-gabriela-murat/?admin=1
```

Incluye:

- Personas confirmadas y capacidad total.
- Invitaciones aceptadas, rechazadas y pendientes.
- Actualización automática sin recargar la página.
- Buscador y filtros.
- Nombres de acompañantes y mensajes.
- Estado de entrega de correo y reintento cuando falle.
- Creación individual de invitaciones.
- Edición de nombre, correo, idioma, grupo y cupos sin cambiar el enlace.
- Importación de hasta 500 filas por CSV.
- Descarga automática de los enlaces creados.
- Exportación de respuestas a CSV.

## Datos requeridos

La plantilla está en [`templates/invitados-ejemplo.csv`](templates/invitados-ejemplo.csv). Las columnas son:

| Columna | Obligatoria | Descripción |
|---|---:|---|
| `name` | Sí | Nombre de la persona o familia que verá el invitado. |
| `email` | Recomendado | Destino del comprobante. Si falta, se solicitará en el formulario. |
| `maxAttendees` | Sí | Cupos autorizados, entre 1 y 20. |
| `language` | No | `es`, `en` o `ar`. El valor predeterminado es `es`. |
| `group` | No | Familia, amigos, trabajo u otra categoría. |
| `notes` | No | Información interna que no se muestra al invitado. |

No se debe importar la lista definitiva más de una vez. Antes de una segunda carga se debe verificar y depurar el archivo para evitar registros duplicados.

## Desarrollo local

```powershell
npm.cmd install
Copy-Item .env.example .env.local
npm.cmd run dev -- --host 127.0.0.1 --port 5174
```

Completa `.env.local` con la configuración web de Firebase. La configuración pública identifica el proyecto, pero no concede permisos por sí sola; la seguridad depende de Authentication, las reglas y las Cloud Functions.

Para probar el backend con emuladores:

```powershell
npm.cmd install --prefix functions
npx.cmd firebase-tools emulators:start
```

En `.env.local`, establece `VITE_USE_FIREBASE_EMULATORS=true`.

## Configuración de Firebase

1. Crear un proyecto de Firebase y registrar una aplicación web.
2. Activar **Authentication > Email/Password**.
3. Crear la base de datos Firestore en una región cercana.
4. Crear el usuario administrador de la novia en Authentication.
5. Crear manualmente `admins/{UID}` en Firestore con `{ "active": true }`.
6. Copiar `.env.example` a `.env.local` y completar los valores web.
7. Crear `functions/.env.<project-id>` a partir de `functions/.env.example`.
8. Configurar el secreto de Resend:

```powershell
npx.cmd firebase-tools functions:secrets:set RESEND_API_KEY --project <project-id>
```

9. Verificar un dominio en Resend y configurar `EMAIL_FROM` con una dirección de ese dominio.
10. Publicar reglas y funciones:

```powershell
npx.cmd firebase-tools deploy --project <project-id> --only functions,firestore:rules,firestore:indexes
```

El proyecto debe usar el plan Blaze para desplegar Cloud Functions. Se recomienda configurar alertas y presupuesto en Google Cloud antes del despliegue.

## Variables de GitHub

La publicación del frontend lee estas variables del repositorio:

- `FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

El workflow del backend requiere:

- Secreto `FIREBASE_SERVICE_ACCOUNT`.
- Secreto `COUPLE_EMAILS`.
- Variable `EMAIL_FROM`.
- Secreto de Firebase `RESEND_API_KEY` creado en Secret Manager.

## Pruebas

```powershell
npm.cmd test
npm.cmd run build:pages
```

Las pruebas cubren validación de cupos, nombres de asistentes, correos, tokens, generación de enlaces y procesamiento de CSV.

## Controles operativos recomendados

- Activar Firebase App Check antes de distribuir enlaces masivamente.
- Definir presupuesto y alertas de consumo.
- Crear una cuenta administrativa individual para cada persona autorizada.
- Exportar un respaldo de confirmaciones al menos una vez por semana.
- Revisar el panel de correos fallidos.
- Cerrar la edición automáticamente después del 1 de diciembre de 2026.
- Conservar únicamente los datos necesarios y eliminarlos después del evento según lo acordado con los novios.
