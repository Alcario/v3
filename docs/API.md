# API — Chatio MVP

Versión 1.0 · Iteración 0 · 2026-09-29

Contrato de la API. Es normativo: si la implementación necesita apartarse de acá,
primero se actualiza este documento y se registra la decisión en `ROADMAP.md`.

---

## 1. Decisión de fondo: Alexa no consume la API REST

Pregunta del brief: ¿la interfaz de Alexa comparte endpoints con el frontend o
tiene los suyos?

**Ninguna de las dos.** Alexa no consume REST en absoluto. La skill se sirve en
`POST /alexa/skill`, dentro de la misma aplicación Express, y sus handlers llaman
**directamente a la capa de servicios** como funciones de JavaScript.

Motivos:

- Compartir los endpoints del panel obligaría a inventar una identidad JWT para el
  adulto (que no tiene cuenta), o a que la skill tenga una credencial de servicio
  con permisos amplios — un agujero de autorización.
- Endpoints REST paralelos "para Alexa" serían un segundo contrato que duplica
  reglas, se desincroniza y consume presupuesto del timeout de 8 s con un salto de
  red innecesario contra sí misma.
- Llamar a los servicios en proceso mantiene una sola implementación de las reglas
  y hace los tests de intents triviales.

Consecuencia: existen **dos superficies HTTP** con modelos de autenticación
distintos y ninguna dependencia entre ellas.

| Superficie | Ruta | Autenticación | Consumidor |
| :--- | :--- | :--- | :--- |
| API del panel | `/api/v1/**` | JWT (Bearer) + refresh cookie | SPA React |
| Endpoint de la skill | `/alexa/skill` | Firma ASK + `applicationId` | Alexa Cloud |
| Salud | `/health`, `/ready` | ninguna | monitoreo y reverse proxy |

Ver decisión **D008**.

---

## 2. Convenciones

- Base: `/api/v1`. El prefijo de versión existe desde el día uno; es gratis y
  evita romper la SPA en producción más adelante.
- `Content-Type: application/json`. UTF-8.
- Los `_id` de Mongo se exponen como `id` (string). Nunca se expone `__v` ni
  `passwordHash`.
- Fechas/instantes: ISO 8601 en **UTC** con `Z` (ej. `2026-09-29T12:00:00.000Z`).
- Fechas de calendario: `YYYY-MM-DD`. Horas de pared: `HH:mm`. Ambas en la zona
  horaria del adulto, y cada respuesta que las contiene incluye `timezone`.
- Métodos: `POST` crea, `PATCH` modifica parcialmente (no se usa `PUT`), `DELETE`
  hace soft delete. Las transiciones de estado son `POST` a un sub-recurso verbo
  (`/confirm`, `/skip`, `/acknowledge`, `/resolve`) porque no son un `PATCH` de un
  campo: tienen reglas y efectos propios.
- Todas las rutas de datos de un adulto están anidadas bajo
  `/adults/:adultId/...`. El `adultId` **siempre** viaja en la URL y nunca en el
  body: así un único middleware (`requireAdultAccess`) autoriza todo el árbol.

### Envoltorios de respuesta

Éxito de un recurso:

```json
{ "data": { "id": "...", "...": "..." } }
```

Éxito de una colección:

```json
{
  "data": [ { "id": "..." } ],
  "meta": { "total": 42, "limit": 20, "nextCursor": "66f1a000..." }
}
```

Error — **siempre** esta forma, para un solo handler en el frontend:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "El horario debe tener formato HH:mm.",
    "details": [ { "path": "schedule.times.0", "message": "Formato inválido" } ],
    "requestId": "01J8Z9..."
  }
}
```

`message` es apto para mostrarse al usuario, en español. `details` solo aparece en
errores de validación. `requestId` correlaciona con los logs del servidor.

### Códigos de error

| HTTP | `code` | Cuándo |
| :--- | :--- | :--- |
| 400 | `VALIDATION_ERROR` | Body, query o params inválidos (Zod) |
| 401 | `UNAUTHENTICATED` | Sin token, token inválido o expirado |
| 401 | `INVALID_CREDENTIALS` | Login fallido (mensaje genérico a propósito) |
| 403 | `FORBIDDEN` | Autenticado pero sin acceso a ese adulto, o rol insuficiente |
| 404 | `NOT_FOUND` | El recurso no existe **o** no es visible para el usuario |
| 409 | `CONFLICT` | Email ya registrado, acceso duplicado, vínculo Alexa existente |
| 409 | `INVALID_STATE` | Transición no permitida (ej. confirmar una `SKIPPED`) |
| 413 | `PAYLOAD_TOO_LARGE` | El body excede `BODY_LIMIT` (32 kb por defecto) |
| 422 | `BUSINESS_RULE` | Regla de dominio (ej. revocar el último `OWNER`) |
| 429 | `RATE_LIMITED` | Límite excedido; incluye header `Retry-After` |
| 500 | `INTERNAL_ERROR` | Fallo no previsto. **Nunca** expone stack ni detalles |

Regla de privacidad: un recurso de un adulto al que el usuario no tiene acceso
devuelve **404**, no 403. Un 403 confirmaría que ese id existe.

### Paginación

Colecciones cronológicas grandes (actividad, ocurrencias) usan **cursor**:
`?limit=20&cursor=<id>`, orden descendente por fecha. `meta.nextCursor` es `null`
cuando no hay más. `limit` máximo 100, default 20.

Las colecciones acotadas (adultos, medicamentos, recordatorios, cuidadores) se
devuelven completas sin paginar, con `meta.total`.

---

## 3. Autenticación

Esquema (**D001**, extendido por **D028** y **D029**): access token JWT de vida corta +
refresh token rotativo en cookie `httpOnly`, respaldado por una **sesión persistida**.

- **Access token**: JWT firmado HS256, TTL **15 minutos**, claims `{ sub, tv }` más los
  estándar (`iat`, `exp`, `iss: chatio`, `aud: chatio-web`). **Sin email, sin nombre y sin
  rol** (**D028**): un bearer token viaja en cada request y aparece en cualquier log
  intermedio, así que no lleva datos personales. Va en `Authorization: Bearer <token>`, y
  el frontend lo guarda **en memoria**, nunca en `localStorage`.
- **Refresh token**: JWT con `aud: chatio-refresh`, TTL **7 días**, claims
  `{ sub, sid, tv, jti }`, entregado en cookie `chatio_rt` con
  `httpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`. **Nunca aparece en el cuerpo de
  una respuesta.**
- **Sesión persistida** (`auth_sessions`, **D028**): el servidor guarda el `SHA-256` del
  refresh token vigente. Rotar es reemplazar ese hash, así que el token anterior deja de
  existir. Es lo que hace verificable la rotación y detectable la reutilización.
- **Detección de reutilización**: un refresh token con firma válida, sin expirar y que
  apunta a una sesión activa pero **cuyo hash no es el vigente** es un token replayado. Se
  revoca **la sesión entera** (`revokedReason: REUSE_DETECTED`), se responde `401` y se
  borra la cookie. Las demás sesiones del usuario no se tocan.
- **Revocación por sesión**: `logout` revoca solo la sesión de ese dispositivo.
- **Logout global**: se revocan todas las sesiones del usuario y se incrementa
  `user.tokenVersion`, que `requireAuth` compara contra el claim `tv` en cada request
  (**D029**). Efecto inmediato también sobre los access tokens ya emitidos.

Justificación en `SECURITY.md` §3. El costo es un interceptor de refresh en el
frontend; la ganancia es que un XSS no se lleva una sesión de larga duración, y eso
importa cuando el dato de fondo es medicación.

**Tres requisitos que el frontend tiene que cumplir** (Iteración 8), consecuencia de este
diseño:

1. **Refresh en vuelo único.** Si dos requests fallan con 401 a la vez, debe dispararse
   **un solo** `/auth/refresh` y las demás esperar su resultado. Dos refresh concurrentes
   con el mismo token son indistinguibles de un replay: uno rota y el otro recibe 401, lo
   que cierra la sesión. El patrón correcto es una única promesa compartida.
2. **`credentials: 'include'`** en todas las llamadas, para que la cookie viaje.
3. **El panel se sirve desde el mismo sitio que la API.** `SameSite=Strict` es la
   protección CSRF (**D030**); si el panel viviera en otro dominio, el navegador no
   enviaría la cookie y habría que cambiar a `SameSite=None` más tokens CSRF.

### `POST /api/v1/auth/login`

```json
// request
{ "email": "ana@ejemplo.com", "password": "..." }
// 200
{ "data": {
  "accessToken": "eyJ...",
  "expiresIn": 900,
  "user": { "id": "...", "email": "ana@ejemplo.com",
            "firstName": "Ana", "lastName": "Pérez" }
} }
```

Setea la cookie de refresh. Rate limit: 5 intentos / 15 min por IP + email.
Credenciales incorrectas → `401 INVALID_CREDENTIALS`, siempre el mismo mensaje y
con tiempo de respuesta uniforme (no se revela si el email existe).

### `POST /api/v1/auth/refresh`

Sin body; usa la cookie. Devuelve un `accessToken` nuevo y rota la cookie.

```json
// 200
{ "data": { "accessToken": "eyJ...", "expiresIn": 900 } }
```

Devuelve `401 UNAUTHENTICATED` **y borra la cookie** en todos estos casos, con el mismo
cuerpo y sin distinguirlos: cookie ausente, firma inválida, token expirado, token de otra
audiencia (por ejemplo un access token), `sid` inexistente, sesión revocada, sesión
vencida, usuario inactivo, `tv` desactualizado y **token reusado**. El motivo interno se
registra en el log de seguridad, nunca en la respuesta.

Rate limit: 30 / 15 min por IP.

### `POST /api/v1/auth/logout`

Revoca la sesión del refresh presentado y borra la cookie. **`204` siempre**: es
idempotente, así que cerrar sesión dos veces, sin cookie o con una cookie inválida
devuelve lo mismo y deja al cliente sin sesión. No revoca las sesiones de otros
dispositivos.

### `GET /api/v1/auth/me`

Devuelve el usuario y **sus adultos accesibles con el rol en cada uno** — es lo que
el frontend necesita al arrancar para armar el selector de adulto:

```json
{ "data": {
  "user": { "id": "...", "firstName": "Ana", "lastName": "Pérez",
            "email": "ana@ejemplo.com" },
  "adults": [
    { "id": "66f1...001", "firstName": "Rosa", "lastName": "Gómez",
      "timezone": "America/Argentina/Buenos_Aires", "status": "ACTIVE",
      "role": "OWNER", "hasAlexaLink": true, "openHelpRequests": 0 }
  ]
} }
```

Desde la Iteración 3, `adults` contiene los adultos con `CaregiverAccess` activo y el rol
por adulto. `hasAlexaLink` y `openHelpRequests` quedan en `false` y `0` hasta que esas
colecciones se incorporen en iteraciones posteriores; la forma de la respuesta ya es la
definitiva, para que el frontend no tenga que cambiar.

No hay registro público (**D002**). Los usuarios los crea un
`isPlatformAdmin` vía `POST /api/v1/admin/users`, o se los invita a un adulto
existente (§5). El **primer** administrador se crea con `npm run seed:admin` en el
servidor: deliberadamente no existe ningún endpoint público de bootstrap. Motivos: el
producto no se autogestiona todavía, el alta implica verificación de identidad del
cuidador, y quitar el registro elimina de un golpe enumeración de emails, verificación por
mail y spam de cuentas.

### `POST /api/v1/admin/users`

Requiere `requireAuth` + `isPlatformAdmin`. Sin token → `401`; con token de un usuario
común → `403`.

```json
// request
{ "email": "carlos@ejemplo.com", "password": "...",
  "firstName": "Carlos", "lastName": "Gómez", "isPlatformAdmin": false }
// 201
{ "data": { "id": "...", "email": "carlos@ejemplo.com", "firstName": "Carlos",
            "lastName": "Gómez", "status": "ACTIVE", "isPlatformAdmin": false } }
```

Email duplicado → `409 CONFLICT`. La contraseña se valida contra la política de
`SECURITY.md` §3 y nunca vuelve en la respuesta, en ninguna forma.

---

## 4. Adultos

| Método | Ruta | Rol | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/adults` | cualquiera | Adultos accesibles por el usuario, con su rol |
| `POST` | `/adults` | autenticado | Crea el adulto; el creador queda `OWNER` |
| `GET` | `/adults/:adultId` | acceso | Detalle con contactos |
| `PATCH` | `/adults/:adultId` | `OWNER` | Datos básicos, timezone, notas, contactos |
| `POST` | `/adults/:adultId/deactivate` | `OWNER` | `status: INACTIVE`; Alexa deja de responder |
| `POST` | `/adults/:adultId/activate` | `OWNER` | Reactiva |

```json
// POST /adults — request
{
  "firstName": "Rosa", "lastName": "Gómez",
  "birthDate": "1944-03-12",
  "timezone": "America/Argentina/Buenos_Aires",
  "notes": "Le gusta que le hablen despacio.",
  "consentConfirmed": true,
  "contacts": [
    { "name": "Ana Pérez", "relationship": "Hija",
      "phone": "+5491122223333", "isPrimary": true }
  ]
}
```

Validaciones: `timezone` debe ser una zona IANA válida (se verifica con Luxon);
`consentConfirmed` debe ser `true`; `birthDate` opcional y no futura; máximo 5 contactos,
uno solo `isPrimary`.

Cambiar el `timezone` de un adulto re-materializa sus ocurrencias `PENDING`
futuras y deja las pasadas intactas.

No hay `DELETE` de adultos en el MVP: se desactivan. Borrarlo destruiría historial
de medicación.

---

## 5. Cuidadores

| Método | Ruta | Rol | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/adults/:adultId/caregivers` | acceso | Lista de accesos activos |
| `POST` | `/adults/:adultId/caregivers` | `OWNER` | Otorga acceso por email de un usuario existente |
| `PATCH` | `/adults/:adultId/caregivers/:accessId` | `OWNER` | Cambia el rol |
| `DELETE` | `/adults/:adultId/caregivers/:accessId` | `OWNER` | Revoca (`status: REVOKED`) |

```json
// POST — request
{ "email": "carlos@ejemplo.com", "role": "CAREGIVER" }
```

Reglas: el email debe corresponder a un usuario existente y activo (si no,
`404 NOT_FOUND`, sin revelar si el email está registrado en la plataforma); acceso
duplicado → `409 CONFLICT`; no se puede revocar ni degradar el **último `OWNER`
activo** → `422 BUSINESS_RULE`; nadie puede revocarse a sí mismo el propio rol
`OWNER` si es el único.

Si el usuario tuvo un acceso `REVOKED`, un nuevo `POST` lo reactiva y actualiza el rol
conservando el mismo documento; solo un acceso `ACTIVE` duplicado devuelve `409`.

Toda alta o baja emite `CAREGIVER_GRANTED` / `CAREGIVER_REVOKED` en el timeline; un
cambio de rol emite `CAREGIVER_ROLE_CHANGED`.

---

## 6. Medicamentos

| Método | Ruta | Descripción |
| :--- | :--- | :--- |
| `GET` | `/adults/:adultId/medications?includeInactive=false` | Lista |
| `POST` | `/adults/:adultId/medications` | Crea la configuración del medicamento |
| `GET` | `/adults/:adultId/medications/:medicationId` | Detalle |
| `PATCH` | `/adults/:adultId/medications/:medicationId` | Modifica la configuración |
| `POST` | `/adults/:adultId/medications/:medicationId/deactivate` | Pausa el medicamento |
| `POST` | `/adults/:adultId/medications/:medicationId/activate` | Reactiva el medicamento |
| `DELETE` | `/adults/:adultId/medications/:medicationId` | Soft delete; el historial sobrevive |

```json
// POST — request
{
  "name": "Losartán",
  "dose": 50, "doseUnit": "MG",
  "quantity": 1, "quantityUnit": "COMPRIMIDO",
  "instructions": "Después del desayuno",
  "schedule": {
    "times": ["09:00"],
    "daysOfWeek": [0,1,2,3,4,5,6],
    "startDate": "2026-09-29",
    "endDate": null
  },
  "graceMinutes": 180
}
```

Validaciones: `name` 2–120 caracteres; `dose` y `quantity` > 0; `times` 1 a 6
entradas `HH:mm` válidas, sin duplicados, ordenadas por el servidor;
`daysOfWeek` subconjunto no vacío de 0–6; `endDate ≥ startDate`;
`graceMinutes` 15–720. Toda escritura emite el `ActivityEvent` correspondiente.

La respuesta incluye `nextOccurrenceAt` (UTC) y `nextOccurrenceLocal`, para que el
panel no tenga que calcularlo. `nextOccurrenceLocal` tiene la forma
`{ "date": "YYYY-MM-DD", "time": "HH:mm", "timezone": "Area/Location" }`.

En la Iteración 4 todavía no se crea `MedicationOccurrence`: la próxima ocurrencia es
una vista calculada de la agenda. La materialización del historial y sus transiciones
queda para la Iteración 5.

La integración con Alexa Reminders no se ejecuta en esta iteración. La respuesta conserva
`remindersPendingSync: false` como valor neutro hasta que exista `AlexaReminderSync` en la
Iteración 16; ningún campo de Alexa se persiste en `Medication`.

Mientras el adulto está `INACTIVE`, los cuidadores con acceso activo pueden consultar sus
medicamentos, pero crear, editar, pausar, reactivar o dar de baja devuelve `422 BUSINESS_RULE`.

---

## 7. Ocurrencias de medicación

| Método | Ruta | Descripción |
| :--- | :--- | :--- |
| `GET` | `/adults/:adultId/medication-occurrences` | Histórico filtrable y paginado |
| `POST` | `/adults/:adultId/medication-occurrences/:occurrenceId/confirm` | Registra una confirmación declarada |
| `POST` | `/adults/:adultId/medication-occurrences/:occurrenceId/skip` | Registra una omisión declarada con motivo |

Query de `GET`: `from`, `to` (`YYYY-MM-DD`, local del adulto), `status`
(repetible), `medicationId`, `limit`, `cursor`. Sin `from`/`to`, devuelve los
últimos 7 días.

```json
// GET — 200
{ "data": [
  { "id": "66f1...201",
    "medicationId": "66f1...101",
    "scheduledAt": "2026-09-29T12:00:00.000Z",
    "localDate": "2026-09-29", "localTime": "09:00",
    "timezone": "America/Argentina/Buenos_Aires",
    "status": "TAKEN",
    "confirmedAt": "2026-09-29T12:02:31.000Z",
    "source": "ALEXA",
    "confirmedOutOfWindow": false,
    "medication": { "name": "Losartán", "dose": 50, "doseUnit": "MG",
                    "quantity": 1, "quantityUnit": "COMPRIMIDO" } }
], "meta": { "limit": 20, "nextCursor": null } }
```

`medication` sale del `snapshot` de la ocurrencia, no de la colección de
medicamentos: refleja lo que estaba prescrito **ese día**.

`POST /confirm` — body opcional `{ "note": "..." }`. La operación registra únicamente
una declaración del adulto/cuidador; no verifica que el medicamento haya sido ingerido.
`source` se fija a `WEB` y
`confirmedByUserId` al usuario del token; el cliente **no** puede elegir el
`source`. Comportamiento:

- `PENDING` en ventana → `TAKEN`, `200`.
- `PENDING` fuera de ventana, o `MISSED` → `TAKEN` con
  `confirmedOutOfWindow: true`, `200`. El familiar puede corregir el pasado; queda
  auditado.
- Ya `TAKEN` → `200` **idempotente**, sin cambiar `confirmedAt` ni duplicar
  eventos.
- `SKIPPED` → `409 INVALID_STATE`.

`POST /skip` — body `{ "note": "Le cayó mal el estómago" }`. Solo desde
`PENDING` o `MISSED`. Alexa **no** puede omitir tomas: decidir no medicar es una
decisión del cuidador, no un comando de voz suelto.

Los estados `TAKEN` y `MISSED` describen respectivamente una confirmación declarada y
la ausencia de confirmación dentro de la ventana; ninguno prueba ni afirma la ingesta
física del medicamento. OWNER y CAREGIVER pueden confirmar u omitir desde el panel.

---

## 8. Recordatorios

| Método | Ruta | Descripción |
| :--- | :--- | :--- |
| `GET` | `/adults/:adultId/reminders?includeInactive=false` | Lista |
| `POST` | `/adults/:adultId/reminders` | Crea |
| `GET` | `/adults/:adultId/reminders/:reminderId` | Detalle |
| `PATCH` | `/adults/:adultId/reminders/:reminderId` | Modifica |
| `POST` | `/adults/:adultId/reminders/:reminderId/deactivate` | Pausa |
| `DELETE` | `/adults/:adultId/reminders/:reminderId` | Soft delete |

```json
// ONE_OFF
{ "title": "Turno con el cardiólogo", "category": "APPOINTMENT",
  "type": "ONE_OFF", "date": "2026-10-02", "time": "10:30",
  "details": "Llevar los últimos análisis" }

// RECURRING
{ "title": "Tomar agua", "category": "HYDRATION",
  "type": "RECURRING", "time": "16:00", "daysOfWeek": [1,2,3,4,5],
  "startDate": "2026-09-29", "endDate": null }
```

Validación condicional (Zod discriminated union): `ONE_OFF` exige `date` y
rechaza `daysOfWeek`; `RECURRING` exige `daysOfWeek` y rechaza `date`. Un
`ONE_OFF` con fecha pasada se acepta al editar pero se advierte en la UI.

---

## 9. Agenda del día

### `GET /api/v1/adults/:adultId/today?date=YYYY-MM-DD`

Sin `date`, usa el día local del adulto. Es el mismo servicio que consume el
`LaunchRequest` de Alexa.

```json
{ "data": {
  "adultId": "66f1...001",
  "localDate": "2026-09-29",
  "timezone": "America/Argentina/Buenos_Aires",
  "items": [
    { "kind": "MEDICATION", "id": "66f1...201", "localTime": "09:00",
      "scheduledAt": "2026-09-29T12:00:00.000Z",
      "title": "Losartán 50 mg", "detail": "1 comprimido, después del desayuno",
      "status": "TAKEN", "confirmable": false },
    { "kind": "REMINDER", "id": "66f1...301", "localTime": "10:30",
      "title": "Turno con el cardiólogo",
      "detail": "Llevar los últimos análisis",
      "category": "APPOINTMENT" }
  ],
  "summary": { "medicationsTotal": 2, "medicationsTaken": 1,
               "medicationsPending": 1, "medicationsMissed": 0,
               "remindersTotal": 1 }
} }
```

`items` viene ordenado por `localTime`. `kind` discrimina el tipo y permite sumar
tipos nuevos sin romper clientes.

---

## 10. Actividad

### `GET /api/v1/adults/:adultId/activity?limit=20&cursor=&type=&from=&to=`

Timeline descendente por `occurredAt`. `type` es repetible.

```json
{ "data": [
  { "id": "66f1...401", "type": "MEDICATION_CONFIRMED",
    "occurredAt": "2026-09-29T12:02:31.000Z",
    "localDate": "2026-09-29", "localTime": "09:02",
    "source": "ALEXA", "actorType": "ADULT",
    "summary": "Medicamento confirmado — Losartán 50 mg",
    "relatedId": "66f1...201", "relatedModel": "MedicationOccurrence" }
], "meta": { "limit": 20, "nextCursor": "66f1...399" } }
```

Solo lectura: no hay `POST`, `PATCH` ni `DELETE`. Los eventos los crea el dominio.
El agrupado por día lo hace el frontend a partir de `localDate`.

---

## 11. Solicitudes de ayuda

| Método | Ruta | Descripción |
| :--- | :--- | :--- |
| `GET` | `/help-requests?status=OPEN` | **Todos** los adultos accesibles. Alimenta el badge global |
| `GET` | `/adults/:adultId/help-requests?status=&limit=&cursor=` | Por adulto |
| `POST` | `/adults/:adultId/help-requests/:id/acknowledge` | "La estoy atendiendo" |
| `POST` | `/adults/:adultId/help-requests/:id/resolve` | Cierra, con nota |

No existe `POST` para crear una solicitud desde el panel en el MVP: las crea el
adulto por voz. (Quedaría trivial agregarlo si aparece el caso "el cuidador
registra un pedido recibido por teléfono".)

```json
// GET /adults/:adultId/help-requests — 200
{ "data": [
  { "id": "66f1...501", "status": "OPEN", "source": "ALEXA",
    "requestedAt": "2026-09-29T00:17:44.000Z",
    "localDate": "2026-09-28", "localTime": "21:17",
    "attempts": 2, "lastAttemptAt": "2026-09-29T00:19:02.000Z",
    "notification": { "status": "SENT", "channel": "EMAIL",
                      "sentAt": "2026-09-29T00:17:46.000Z" } }
] }
```

`acknowledge` solo desde `OPEN`; `resolve` desde `OPEN` o `ACKNOWLEDGED`; repetir
la misma transición es idempotente (`200`). Cada transición emite su
`ActivityEvent` con el usuario que la hizo.

---

## 12. Vinculación con Alexa

| Método | Ruta | Rol | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/adults/:adultId/alexa-link` | acceso | Estado del vínculo |
| `POST` | `/adults/:adultId/alexa-link/codes` | `OWNER` | Genera un código de un uso |
| `DELETE` | `/adults/:adultId/alexa-link/:linkId` | `OWNER` | Revoca el vínculo |

```json
// POST /codes — 201
{ "data": { "code": "4723", "expiresAt": "2026-09-29T13:15:00.000Z",
            "ttlSeconds": 900 } }
```

El código en claro se devuelve **una sola vez** y no se persiste (solo su hash).
Rate limit: 5 códigos por adulto por hora. Nunca aparece en logs.

```json
// GET — 200
{ "data": { "status": "ACTIVE", "linkId": "66f1...601",
            "linkedAt": "2026-09-20T18:03:00.000Z",
            "lastSeenAt": "2026-09-29T12:02:00.000Z",
            "deviceScoped": false } }
```

Sin vínculo: `{ "data": { "status": "NOT_LINKED" } }`.

Con vínculo, la respuesta incluye el estado del permiso de recordatorios:

```json
{ "data": { "status": "ACTIVE", "linkId": "66f1...601",
            "linkedAt": "2026-09-20T18:03:00.000Z",
            "lastSeenAt": "2026-09-29T12:02:00.000Z",
            "deviceScoped": false,
            "reminderPermission": { "status": "GRANTED",
                                    "grantedAt": "2026-09-20T18:04:00.000Z",
                                    "lastCheckedAt": "2026-09-29T12:02:00.000Z" } } }
```

`reminderPermission.status` ∈ `UNKNOWN` | `GRANTED` | `DENIED` | `REVOKED` |
`UNSUPPORTED_DEVICE`. El panel usa este campo para mostrarle al cuidador si los avisos
proactivos están activos y, si no, cómo activarlos.

---

## 12.bis Avisos proactivos (Alexa Reminders)

Estado de la sincronización de los avisos. **Solo lectura, más una acción para forzar la
reconciliación.** El estado deseado lo calcula Chatio a partir de los medicamentos: no hay
endpoint para crear o editar un aviso a mano, porque no es un recurso que el usuario
autore (ver `ALEXA_REMINDERS.md` §5.1).

| Método | Ruta | Rol | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/adults/:adultId/alexa-reminders` | acceso | Estado de cada franja horaria |
| `POST` | `/adults/:adultId/alexa-reminders/resync` | `OWNER` | Marca todo para reconciliar en la próxima sesión y limpia los `FAILED` |

```json
// GET — 200
{ "data": {
  "permissionStatus": "GRANTED",
  "timezone": "America/Argentina/Buenos_Aires",
  "slots": [
    { "id": "66f1...701", "localTime": "09:00", "daysOfWeek": [0,1,2,3,4,5,6],
      "status": "SYNCED", "lastSyncedAt": "2026-09-29T12:02:31.000Z",
      "medications": ["Losartán", "Metformina"] },
    { "id": "66f1...702", "localTime": "21:00", "daysOfWeek": [0,1,2,3,4,5,6],
      "status": "PENDING_CREATE", "lastSyncedAt": null,
      "medications": ["Metformina"] }
  ],
  "pendingCount": 1,
  "failedCount": 0
} }
```

`status` ∈ `PENDING_CREATE` | `PENDING_UPDATE` | `PENDING_DELETE` | `SYNCED` | `FAILED`.
La respuesta **no** expone el `alertToken` ni el `alexaUserIdHash`: son identificadores
internos de la integración y el panel no los necesita.

`POST /resync` devuelve `202` con `{ "data": { "marked": 2 } }`. Deja constancia de que la
aplicación efectiva ocurre en la próxima sesión del adulto con la skill — el endpoint
**no** llama a Alexa, porque fuera de sesión no se pueden crear avisos
(`ALEXA_REMINDERS.md` §1). El panel comunica exactamente eso.

Rate limit: 5 resync por adulto por hora.

---

## 13. Endpoint de la skill

### `POST /alexa/skill`

No forma parte de `/api/v1` y no es parte del contrato público: su forma la define
Alexa Skills Kit. Requisitos de la implementación:

1. Body **crudo** disponible para verificar la firma (se monta antes del parser
   JSON global).
2. Verificación obligatoria de `Signature`, `SignatureCertChainUrl` y del
   `timestamp` (tolerancia 150 s) vía `ask-sdk-express-adapter`. Falla →
   `400`, sin cuerpo informativo.
3. Verificación de `context.System.application.applicationId` contra
   `ALEXA_SKILL_ID`. No coincide → `400`.
4. Nunca devuelve 4xx/5xx por errores de dominio: un error de negocio se traduce a
   una respuesta hablada amable. Un 5xx hace que Alexa diga "hubo un problema con
   la skill solicitada", que es la peor experiencia posible para un adulto mayor.
5. Objetivo de latencia: p95 < 1,5 s; techo duro 8 s.

Los intents, utterances y respuestas están en `ALEXA_SKILL.md`.

---

## 14. Rate limiting

`express-rate-limit`, por IP y —donde aplica— por identidad:

| Alcance | Límite |
| :--- | :--- |
| `POST /auth/login` | 5 / 15 min por IP + email |
| `POST /auth/refresh` | 30 / 15 min por IP |
| `POST /adults/:id/alexa-link/codes` | 5 / hora por adulto |
| Resto de `/api/v1` (autenticado) | 300 / 15 min por usuario |
| `/alexa/skill` | 60 / min por `alexaUserIdHash` |
| Canje de código de vinculación | 5 intentos por `alexaUserIdHash` / hora |
| `POST /adults/:id/alexa-reminders/resync` | 5 / hora por adulto |

El límite de `/alexa/skill` se aplica **después** de verificar la firma, para que
un atacante sin firma válida no consuma la cuota de un usuario legítimo.
`429` incluye `Retry-After`.

---

## 15. Validación

Zod en el borde, en un middleware `validate({ params, query, body })`. Reglas
transversales:

- `strict()` en todos los schemas de body: una propiedad desconocida es
  `400 VALIDATION_ERROR`, no se ignora en silencio.
- `params` valida que los ids sean `ObjectId` bien formados antes de tocar Mongo.
- El resultado validado queda en **`req.validated`** (`{ params, query, body }`) y no se
  mezcla con `req.body`: un controlador que lee `req.validated.body` no puede colarse
  datos sin validar. `req.body` queda como lo dejó el parser y no se usa.
- Una propiedad desconocida produce un detalle **por cada clave sobrante**, con su nombre
  en `path` (`body.isAdmin`) y el mensaje `propiedad no reconocida`, para que el frontend
  pueda señalar el campo exacto.
- Nunca se pasa el body del request a Mongoose. Se construye un objeto explícito
  con los campos permitidos (previene *mass assignment* de `status`, `adultId`,
  `source`, `confirmedByUserId`, `isPlatformAdmin`).
- Los campos derivados del servidor (`source`, `confirmedByUserId`, `adultId`,
  `createdByUserId`) se rechazan si vienen en el body.
- Strings: `trim` y límite de longitud siempre. Texto libre normalizado y
  escapado al renderizar (React ya escapa; nada de `dangerouslySetInnerHTML`).

---

## 16. Salud

**Rutas sin versionar** (decisión **D025**): son infraestructura, no recursos de la API.
Las consume el monitoreo externo y el reverse proxy, y no deben romperse al versionar la
API.

```text
GET /health   -> 200 { "status": "ok" }
GET /ready    -> 200 { "status": "ok", "checks": { "db": "up" } }
              -> 503 { "status": "unavailable", "checks": { "db": "down" } }
```

`/health` es **liveness**: dice que el proceso responde y no mira dependencias. Sirve
200 incluso con MongoDB caído, a propósito: si devolviera error, un orquestador
reiniciaría un proceso que está perfectamente sano.

`/ready` es **readiness**: hace un `ping` real contra MongoDB —no mira solo el estado del
socket— y devuelve 503 mientras la dependencia crítica no responda.

Únicas dos respuestas de toda la API exentas del envoltorio `{ data }` / `{ error }`: un
monitor espera un documento de estado plano, no un recurso. Sin autenticación, y con rate
limit propio para que no sirvan de canal de sondeo (SECURITY.md §16).

**No exponen** versión, uptime, hostname, nombre de la base, URI de conexión ni detalle del
error: un healthcheck es público y no tiene que contar nada del sistema.
