# Modelo de datos — Chatio MVP

Versión 1.0 · Iteración 0 · 2026-09-29 · MongoDB 7 + Mongoose 8

---

## 1. Resolución de las entidades propuestas

| Entidad propuesta | Decisión | Motivo |
| :--- | :--- | :--- |
| `User` | **Se mantiene** | Cuenta de familiar/cuidador. Credenciales y sesión. |
| `Adult` | **Se mantiene** | Sujeto del cuidado. No tiene credenciales ni inicia sesión. |
| `CaregiverAccess` | **Se mantiene** | Tabla puente `User` ↔ `Adult` con rol. Habilita N:N sin acoplar. |
| — | **Se agrega `AuthSession`** | Sesión de refresh con el hash del token vigente (**D028**). Es lo que hace verificable la rotación y detectable la reutilización; `tokenVersion` por sí solo no puede. Ver §3.1.bis. |
| `Medication` | **Se mantiene** | Prescripción configurada por el cuidador. |
| `MedicationSchedule` | **Se fusiona dentro de `Medication`** | Un medicamento tiene *un* patrón (horas + días + vigencia). Una colección aparte agregaría un join en el camino crítico de Alexa sin ganar nada. Si más adelante hace falta pauta variable (ej. escalonada), se agrega un array `schedules[]` embebido, no una colección. |
| `MedicationOccurrence` | **Se mantiene — es el corazón del modelo** | Cada toma que debía suceder, con historial inmutable. |
| `Reminder` | **Se mantiene** | Sin ocurrencias asociadas en el MVP (§6). |
| `ActivityEvent` | **Se mantiene** | Timeline genérico append-only. |
| `HelpRequest` | **Se mantiene, separada de `ActivityEvent`** | Tiene ciclo de vida propio (abierta → atendida → resuelta). Un evento de timeline es inmutable; una solicitud de ayuda cambia de estado y se opera desde el panel. Además emite su propio `ActivityEvent`. |
| `AlexaAccountLink` | **Se mantiene, renombrada `AlexaLink`** | "AccountLink" se confundiría con el Account Linking de Amazon, que **no** usamos en el MVP (ver `ALEXA_SKILL.md` §7). |
| — | **Se agrega `AlexaPairingCode`** | Código de un uso para crear el vínculo. Documento efímero con TTL. |
| — | **Se agrega `AlexaReminderSync`** | Espejo del estado de los recordatorios proactivos en Alexa (**D021**). Es la **única** colección que conoce Alexa Reminders: `Medication` y `MedicationOccurrence` no reciben ni un campo de la integración. Ver `ALEXA_REMINDERS.md` §5. |

Total: **11 colecciones.**

### Convenciones transversales

- `_id`: `ObjectId` de Mongo. Se expone al cliente como string `id`.
- `timestamps: true` en todas las colecciones (`createdAt`, `updatedAt` UTC).
- Enums: **strings mayúsculas** con `enum` de Mongoose. Nunca números.
- **Soft delete:** ningún dato clínico ni histórico se borra físicamente.
  - `Medication`, `Reminder`: `isActive` (pausa reversible) + `deletedAt` (baja).
  - `Adult`, `User`: `status` (`ACTIVE` / `INACTIVE`).
  - `MedicationOccurrence`, `ActivityEvent`: **nunca se borran ni se editan**
    salvo la transición de estado propia de la ocurrencia.
  - Todo query de lectura filtra `deletedAt: null` por defecto (scope de query
    Mongoose reutilizable, no repetido a mano).
- Referencias por `ObjectId` + `ref`. **No** se usan subdocumentos para relaciones
  que crecen sin límite (ocurrencias, eventos).
- `adultId` está desnormalizado en `MedicationOccurrence`, `ActivityEvent` y
  `HelpRequest` aunque sea derivable: todas las consultas parten del adulto y así
  se evita un join en cada lectura.

---

## 2. Relaciones

```text
User ──< CaregiverAccess >── Adult
                               |
                               +──< Medication ──< MedicationOccurrence
                               |
                               +──< Reminder
                               |
                               +──< ActivityEvent
                               |
                               +──< HelpRequest
                               |
                               +──< AlexaLink
                               |
                               +──< AlexaPairingCode
                               |
                               +──< AlexaReminderSync
```

`User` ↔ `Adult` es **N:N** a través de `CaregiverAccess` (pendiente de
confirmación **D003**, pero el modelo N:N no cuesta más que el 1:N y evita una
migración cara si la respuesta es "sí"; un 1:N es un caso particular de este
modelo).

---

## 3. Colecciones

### 3.1 `users`

| Campo | Tipo | Notas |
| :--- | :--- | :--- |
| `email` | String | requerido, único, lowercase, trim |
| `passwordHash` | String | requerido, bcrypt cost 12. **`select: false`** |
| `firstName`, `lastName` | String | requeridos |
| `status` | Enum | `ACTIVE` \| `INACTIVE` — default `ACTIVE` |
| `isPlatformAdmin` | Boolean | default `false`. Solo para crear usuarios y soporte. No es rol de negocio. |
| `tokenVersion` | Number | default 0. Incrementar invalida **todo** lo emitido: los refresh (además se revocan sus sesiones) y los access tokens ya entregados, porque `requireAuth` compara este número contra el claim `tv` (**D029**). Se llamaba `refreshTokenVersion` en la versión previa de este documento; se renombró en **D028** porque también invalida los access. |
| `lastLoginAt` | Date | opcional |

Índices: `{ email: 1 }` único (lo crea `unique: true`; no se declara dos veces).

El campo `password` en texto plano **no existe en ningún punto del esquema**. El
hash se calcula en el servicio de auth, no en un hook del modelo, para que el
hasheo sea explícito y testeable.

El email se normaliza con `trim` + `lowercase` y nada más: **no** se intenta
canonicalización por proveedor (los puntos de Gmail, los sufijos `+algo`), porque esas
reglas son específicas de cada servicio, cambian sin aviso y llevarían a tratar como el
mismo usuario a dos personas distintas.

`toJSON` elimina `passwordHash`, `_id` y `__v`, y agrega `id`. Además existe
`toPublicJSON()`, que es la única proyección que la API devuelve: seis campos, sin
`tokenVersion` ni `lastLoginAt`.

### 3.1.bis `auth_sessions`

Sesión de refresh (**D028**). Un documento por sesión —una por login— que se **rota en el
lugar**.

| Campo | Tipo | Notas |
| :--- | :--- | :--- |
| `userId` | ObjectId → User | requerido |
| `tokenHash` | String | **`SHA-256` hex del refresh token vigente.** Único |
| `status` | Enum | `ACTIVE` \| `REVOKED` |
| `expiresAt` | Date | vencimiento de la sesión. **La aplicación compara contra este campo** |
| `rotationCount` | Number | cuántas veces rotó |
| `lastRotatedAt` | Date \| null | |
| `revokedAt` | Date \| null | |
| `revokedReason` | Enum \| null | `LOGOUT` \| `REUSE_DETECTED` \| `GLOBAL_LOGOUT` \| `ADMIN` |

Índices:

```js
{ tokenHash: 1 }              // ÚNICO — es el camino del refresh
{ userId: 1, status: 1 }      // revocar todas las sesiones de un usuario
{ expiresAt: 1 }              // TTL, expireAfterSeconds: 0
```

**Por qué existe esta colección y no alcanzaba `tokenVersion`.** La versión anterior de
este documento especificaba solo un contador en `User`, pero con eso la rotación no es
verificable: el token viejo y el nuevo llevan el mismo `tv`, así que **los dos siguen
siendo válidos** y la reutilización es indetectable. Subir el contador en cada rotación lo
resolvería para un dispositivo y rompería todos los demás. Guardar el hash del token
vigente es lo mínimo que hace ciertas las tres propiedades que el producto necesita:
rotación real, detección de replay y cierre de sesión por dispositivo.

**Por qué `SHA-256` y no bcrypt.** El refresh token es un secreto de **alta entropía**
generado por nosotros, no una contraseña elegida por una persona: no hay diccionario que
probar, así que un hash lento no agrega seguridad y sí costaría CPU en cada refresh.
Distinto es `passwordHash`, que sí va con bcrypt.

**Por qué el TTL no es un control de seguridad.** El índice TTL de MongoDB borra en
segundo plano —su tarea corre cada ~60 s— así que un documento vencido puede seguir
existiendo un rato. La aplicación **nunca** trata la ausencia del documento como el
criterio de expiración: compara contra `expiresAt`. El TTL es higiene de almacenamiento.

**Qué no se guarda.** Ni IP, ni user-agent, ni ubicación. Cuando exista una pantalla de
"sesiones activas" habrá que decidir qué mínimo mostrar; hasta entonces, minimización
(DATA_MODEL §7).

### 3.2 `adults`

| Campo | Tipo | Notas |
| :--- | :--- | :--- |
| `firstName`, `lastName` | String | requeridos |
| `birthDate` | Date | opcional (§7: minimización) |
| `timezone` | String | requerido, IANA validada. Default `America/Argentina/Buenos_Aires` |
| `status` | Enum | `ACTIVE` \| `INACTIVE` — default `ACTIVE` |
| `notes` | String | opcional, máx 1000. Información útil para la experiencia. **No es historia clínica.** |
| `contacts[]` | Array de subdoc | `{ name, relationship, phone, isPrimary }`. Máx 5. |
| `createdByUserId` | ObjectId → User | auditoría |
| `consentRecordedAt` | Date | cuándo el cuidador declaró contar con consentimiento o representación legal |
| `consentRecordedByUserId` | ObjectId → User | usuario que registró la declaración |
| `consentStatementVersion` | String | versión de la declaración mostrada; default `v1` |
| `deletedAt` | Date \| null | soft delete |

Índices: `{ status: 1 }`, `{ createdByUserId: 1 }`.

No se guardan: diagnósticos, obra social, DNI, dirección, historia clínica. Nada
de eso hace falta para que el MVP funcione.

### 3.3 `caregiver_accesses`

| Campo | Tipo | Notas |
| :--- | :--- | :--- |
| `userId` | ObjectId → User | requerido |
| `adultId` | ObjectId → Adult | requerido |
| `role` | Enum | `OWNER` \| `CAREGIVER` (**D004 pendiente**) |
| `status` | Enum | `ACTIVE` \| `REVOKED` — default `ACTIVE` |
| `grantedByUserId` | ObjectId → User | quién otorgó el acceso |
| `revokedAt` | Date \| null | |

Índices: `{ userId: 1, adultId: 1 }` **único**; `{ userId: 1, status: 1 }`;
`{ adultId: 1, status: 1 }`. El segundo índice permite listar los adultos accesibles
de un usuario sin recorrer accesos revocados.

Semántica de roles propuesta (a confirmar en D004):

| Acción | OWNER | CAREGIVER |
| :--- | :---: | :---: |
| Ver adulto, agenda, actividad, ayuda | sí | sí |
| Confirmar medicación desde el panel | sí | sí |
| Atender/resolver solicitudes de ayuda | sí | sí |
| Crear/editar/pausar medicamentos y recordatorios | sí | sí |
| Editar datos del adulto y contactos | sí | no |
| Invitar o revocar otros cuidadores | sí | no |
| Generar códigos de vinculación de Alexa | sí | no |
| Desactivar el adulto | sí | no |

Invariante: **todo adulto tiene al menos un `OWNER` activo.** El servicio impide
revocar o degradar el último OWNER.

### 3.4 `medications`

| Campo | Tipo | Notas |
| :--- | :--- | :--- |
| `adultId` | ObjectId → Adult | requerido |
| `name` | String | requerido, ej. `"Losartán"` |
| `dose` | Number | requerido, > 0, ej. `50` |
| `doseUnit` | Enum | `MG` \| `G` \| `ML` \| `MCG` \| `UI` \| `GOTAS` \| `OTRO` |
| `quantity` | Number | requerido, > 0, ej. `1` |
| `quantityUnit` | Enum | `COMPRIMIDO` \| `CAPSULA` \| `ML` \| `GOTAS` \| `SOBRE` \| `APLICACION` \| `OTRO` |
| `instructions` | String | opcional, máx 300, ej. `"Después del desayuno"` |
| `schedule` | Subdoc | ver abajo |
| `graceMinutes` | Number | default 180, rango 15–720. Ventana de confirmación. |
| `isActive` | Boolean | default `true`. Pausa sin perder historial. |
| `deletedAt` | Date \| null | soft delete |
| `createdByUserId` | ObjectId → User | |

`schedule` (embebido):

| Campo | Tipo | Notas |
| :--- | :--- | :--- |
| `times[]` | Array\<String\> | requerido, 1–6 entradas, formato `"HH:mm"` 24 h, hora **local del adulto**, ordenadas y sin repetir |
| `daysOfWeek[]` | Array\<Number\> | 0 = domingo … 6 = sábado. `[0..6]` = todos los días |
| `startDate` | String `YYYY-MM-DD` | requerido, fecha local del adulto |
| `endDate` | String \| null | opcional; si existe, ≥ `startDate` |

Índices: `{ adultId: 1, isActive: 1, deletedAt: 1 }`,
`{ isActive: 1, deletedAt: 1 }` (el materializador barre por acá).

Por qué `times` es `"HH:mm"` y no `Date`: es hora de pared. Ver `ARCHITECTURE.md` §4.

Por qué `startDate`/`endDate` son strings `YYYY-MM-DD` y no `Date`: son fechas de
calendario local, no instantes. Guardarlas como `Date` introduce un desfase de un
día según la zona horaria — un bug clásico y difícil de ver.

### 3.5 `medication_occurrences` — entidad central

Una toma que **debía** ocurrir. Se crea por el materializador, no por el usuario.

| Campo | Tipo | Notas |
| :--- | :--- | :--- |
| `adultId` | ObjectId → Adult | desnormalizado |
| `medicationId` | ObjectId → Medication | |
| `scheduledAt` | Date | **UTC.** Instante exacto en que debía tomarse |
| `localDate` | String `YYYY-MM-DD` | día local del adulto |
| `localTime` | String `HH:mm` | hora local del adulto |
| `timezone` | String | timezone vigente al materializar |
| `status` | Enum | `PENDING` \| `TAKEN` \| `SKIPPED` \| `MISSED` |
| `confirmedAt` | Date \| null | instante real de la confirmación |
| `source` | Enum \| null | `ALEXA` \| `WEB` \| `SYSTEM` |
| `confirmedByUserId` | ObjectId → User \| null | solo si `source = WEB` |
| `confirmedOutOfWindow` | Boolean | default `false` |
| `snapshot` | Subdoc | copia inmutable: `{ name, dose, doseUnit, quantity, quantityUnit, instructions }` |
| `graceMinutes` | Number | copiado del medicamento al materializar |
| `note` | String \| null | motivo opcional al omitir desde el panel |

Índices:

```js
{ medicationId: 1, scheduledAt: 1 }            // ÚNICO — idempotencia del job
{ adultId: 1, localDate: 1, localTime: 1 }     // agenda del día
{ adultId: 1, status: 1, scheduledAt: 1 }      // pendientes para Alexa
{ status: 1, scheduledAt: 1 }                  // sweeper
```

**Máquina de estados**

```text
                         confirm (voz o panel)
        PENDING ─────────────────────────────────► TAKEN
           │                                         │
           │ skip (solo desde el panel)              │ (terminal, no vuelve)
           ├───────────────────────────► SKIPPED
           │
           │ sweeper: scheduledAt + graceMinutes < ahora
           └───────────────────────────► MISSED
                                            │
                                            │ confirm tardía desde el panel
                                            └──► TAKEN (confirmedOutOfWindow=true)
```

- `TAKEN` y `SKIPPED` son terminales desde Alexa. El panel puede corregir un
  `MISSED` a `TAKEN` (el familiar sabe que sí lo tomó), y esa corrección queda
  registrada en el `ActivityEvent` con el usuario que la hizo.
- La confirmación es **idempotente**: confirmar una ocurrencia ya `TAKEN` no
  cambia `confirmedAt` ni duplica eventos; responde "ya lo tenía registrado".
- La transición se hace con `findOneAndUpdate({ _id, status: 'PENDING' }, ...)`
  para que dos confirmaciones concurrentes no generen dos eventos.

**Por qué `snapshot`.** Si el cuidador corrige la dosis de Losartán de 50 a 100 mg
en octubre, el historial de septiembre debe seguir diciendo 50 mg. Sin snapshot, el
historial miente retroactivamente — inaceptable en un producto que registra
medicación. Solo las ocurrencias **futuras** (`PENDING`) se re-materializan al
editar; las pasadas quedan intactas.

**Efecto de editar un medicamento:** el servicio borra las ocurrencias `PENDING`
futuras de ese medicamento y deja que el materializador las vuelva a crear con la
configuración nueva. Las ocurrencias pasadas o ya resueltas nunca se tocan.

### 3.6 `reminders`

| Campo | Tipo | Notas |
| :--- | :--- | :--- |
| `adultId` | ObjectId → Adult | requerido |
| `title` | String | requerido, máx 120, ej. `"Turno con el cardiólogo"` |
| `details` | String \| null | máx 300 |
| `category` | Enum | `APPOINTMENT` \| `HYDRATION` \| `CALL` \| `ACTIVITY` \| `BIRTHDAY` \| `OTHER` |
| `type` | Enum | `ONE_OFF` \| `RECURRING` |
| `date` | String `YYYY-MM-DD` \| null | requerido si `ONE_OFF` |
| `time` | String `HH:mm` | requerido, hora local |
| `daysOfWeek[]` | Array\<Number\> | requerido si `RECURRING` |
| `startDate` / `endDate` | String \| null | vigencia si `RECURRING` |
| `isActive` | Boolean | default `true` |
| `deletedAt` | Date \| null | |

Índices: `{ adultId: 1, isActive: 1, deletedAt: 1 }`, `{ adultId: 1, date: 1 }`.

Se soportan ambos tipos desde el MVP porque son casos de uso distintos y ya
pedidos: "turno médico" es único, "tomar agua" es recurrente. La complejidad extra
es un `if` en el cálculo de agenda. Lo que **no** entra: RRULE completo, cada N
días, "el tercer martes del mes", excepciones por fecha. Ver **D010**.

### 3.7 `activity_events`

Timeline append-only. **Nunca se edita ni se borra.**

| Campo | Tipo | Notas |
| :--- | :--- | :--- |
| `adultId` | ObjectId → Adult | requerido |
| `type` | Enum | ver tabla |
| `occurredAt` | Date | UTC. Cuándo pasó (no cuándo se guardó) |
| `source` | Enum | `ALEXA` \| `WEB` \| `SYSTEM` |
| `actorType` | Enum | `ADULT` \| `CAREGIVER` \| `SYSTEM` |
| `actorUserId` | ObjectId → User \| null | si `actorType = CAREGIVER` |
| `summary` | String | texto corto ya listo para mostrar, sin nombre, dosis ni indicaciones; ej. `"Confirmación declarada de toma registrada"` |
| `payload` | Mixed | datos mínimos del evento (ids, nombres). **Sin PII innecesaria** |
| `relatedId` | ObjectId \| null | ocurrencia / recordatorio / solicitud relacionada |
| `relatedModel` | String \| null | nombre del modelo de `relatedId` |

Tipos de evento del MVP:

```text
ALEXA_SESSION_STARTED      MEDICATION_QUERIED
MEDICATION_CONFIRMED       MEDICATION_MISSED
MEDICATION_SKIPPED         SCHEDULE_QUERIED
HELP_REQUESTED             HELP_ACKNOWLEDGED
HELP_RESOLVED              ALEXA_LINKED
ALEXA_UNLINKED             ALEXA_LINK_FAILED
MEDICATION_CREATED         MEDICATION_UPDATED
MEDICATION_ACTIVATED       MEDICATION_DEACTIVATED
REMINDER_CREATED
REMINDER_UPDATED           REMINDER_DEACTIVATED
CAREGIVER_GRANTED          CAREGIVER_REVOKED
CAREGIVER_ROLE_CHANGED     ADULT_UPDATED
```

Tipos agregados por la integración con Alexa Reminders (**D021**):

```text
ALEXA_REMINDER_SCHEDULED          ALEXA_REMINDER_UPDATED
ALEXA_REMINDER_REMOVED            ALEXA_REMINDER_SYNC_FAILED
ALEXA_REMINDER_PERMISSION_GRANTED ALEXA_REMINDER_PERMISSION_DENIED
ALEXA_REMINDER_PERMISSION_REVOKED ALEXA_REMINDER_FIRED
```

`ALEXA_REMINDER_SCHEDULED` significa *"el aviso quedó programado en Alexa"*, que es lo que
efectivamente sabemos. `ALEXA_REMINDER_FIRED` significa *"el aviso sonó"* y **solo se
emite si el evento `Reminders.ReminderStarted` realmente llega a nuestro endpoint HTTPS**,
lo cual está pendiente de verificación empírica (`ALEXA_REMINDERS.md` §4 y §7). Mientras
no esté verificado, la UI no afirma que el aviso sonó, porque no lo sabemos. Y en ningún
caso un evento de esta familia altera una `MedicationOccurrence`.

Índices: `{ adultId: 1, occurredAt: -1 }` (consulta principal),
`{ adultId: 1, type: 1, occurredAt: -1 }` (filtro por tipo).

`summary` se guarda pre-renderizado a propósito: el timeline se lee mucho más de lo
que se escribe, y así el frontend no necesita reconstruir texto ni el backend
resolver referencias borradas.

Este modelo cubre además la **auditoría** de acciones del cuidador
(`MEDICATION_UPDATED`, `CAREGIVER_REVOKED`, etc.), por lo que no hace falta una
colección de audit log aparte en el MVP. Las acciones de seguridad puras (login,
login fallido) van al log estructurado, no acá — no pertenecen al timeline del
adulto. Ver `SECURITY.md` §9.

### 3.8 `help_requests`

| Campo | Tipo | Notas |
| :--- | :--- | :--- |
| `adultId` | ObjectId → Adult | requerido |
| `status` | Enum | `OPEN` \| `ACKNOWLEDGED` \| `RESOLVED` |
| `source` | Enum | `ALEXA` \| `WEB` |
| `requestedAt` | Date | UTC |
| `attempts` | Number | default 1. Cuántas veces pidió ayuda dentro de la misma solicitud |
| `lastAttemptAt` | Date | |
| `acknowledgedAt` / `acknowledgedByUserId` | Date / ObjectId \| null | |
| `resolvedAt` / `resolvedByUserId` | Date / ObjectId \| null | |
| `resolutionNote` | String \| null | máx 500 |
| `notification` | Subdoc | `{ status: PENDING\|SENT\|FAILED, channel, sentAt, error, retries }` |

Índices: `{ adultId: 1, status: 1, requestedAt: -1 }`,
`{ status: 1, requestedAt: -1 }`, `{ 'notification.status': 1 }` (reintentos).

**Dedupe:** si el adulto pide ayuda varias veces, no se crean solicitudes
paralelas. Si existe una `OPEN` para ese adulto con `lastAttemptAt` dentro de los
últimos 15 minutos, se incrementa `attempts` y se actualiza `lastAttemptAt`. Se
notifica una sola vez por solicitud, salvo que `attempts` cruce un umbral (3), caso
en que se envía un aviso de escalamiento. Evita inundar el mail del familiar sin
perder la señal de insistencia.

### 3.9 `alexa_links`

| Campo | Tipo | Notas |
| :--- | :--- | :--- |
| `adultId` | ObjectId → Adult | requerido |
| `alexaUserIdHash` | String | requerido. **SHA-256 del `userId`**, no el valor crudo |
| `deviceIdHash` | String \| null | SHA-256 del `deviceId`. Requerido si el adulto comparte cuenta Alexa con otro adulto |
| `status` | Enum | `ACTIVE` \| `REVOKED` |
| `linkedAt` | Date | |
| `linkedByUserId` | ObjectId → User | quién generó el código usado |
| `lastSeenAt` | Date \| null | último request de Alexa recibido |
| `revokedAt` / `revokedByUserId` | Date / ObjectId \| null | |
| `reminderPermission` | Subdoc | `{ status, lastCheckedAt, grantedAt, revokedDetectedAt }` con `status` ∈ `UNKNOWN` \| `GRANTED` \| `DENIED` \| `REVOKED` \| `UNSUPPORTED_DEVICE`. Evita intentar llamadas condenadas a `401` y alimenta el aviso del panel (**D021**) |
| `apiEndpoint` | String \| null | último host regional visto en `context.System.apiEndpoint`; no se hardcodea la región |

Índices: `{ alexaUserIdHash: 1, deviceIdHash: 1, status: 1 }` **único parcial**
(`status: 'ACTIVE'`); `{ adultId: 1, status: 1 }`.

Por qué se hashea: el `userId` de Alexa es un identificador persistente de una
persona real. Guardar su hash permite resolver el vínculo (búsqueda por igualdad)
sin almacenar el identificador en claro, y hace que un dump de la base no sea
correlacionable con cuentas de Amazon.

**Resolución del adulto en cada request** (ver `ALEXA_SKILL.md` §7):

1. Buscar `AlexaLink` activo por `{ alexaUserIdHash, deviceIdHash }` (match exacto
   de dispositivo).
2. Si no hay, buscar por `{ alexaUserIdHash, deviceIdHash: null }`.
3. Si hay **exactamente uno**, ese es el adulto.
4. Si hay **más de uno**, es ambigüedad de configuración: se responde pidiendo
   completar la vinculación por dispositivo en el panel y se registra
   `ALEXA_LINK_FAILED`. No se adivina, y no se le pide al adulto mayor que elija.

### 3.10 `alexa_pairing_codes`

| Campo | Tipo | Notas |
| :--- | :--- | :--- |
| `adultId` | ObjectId → Adult | requerido |
| `codeHash` | String | SHA-256 del código. **El código en claro no se guarda** |
| `createdByUserId` | ObjectId → User | |
| `expiresAt` | Date | requerido. TTL 15 minutos |
| `usedAt` | Date \| null | un solo uso |
| `attempts` | Number | intentos fallidos contra este código |

Índices: `{ codeHash: 1 }` único; `{ expiresAt: 1 }` con
`expireAfterSeconds: 0` (Mongo borra el documento solo).

El código es de **4 dígitos**, generado con `crypto.randomInt`, y se dicta dígito
por dígito ("cuatro, siete, dos, tres"). Se muestra **una sola vez** en el panel.
La longitud la impone el ASR, no la criptografía: `AMAZON.FOUR_DIGIT_NUMBER` es el
único slot type que captura secuencias de dígitos de forma confiable en `es-*`. Los
controles compensatorios (TTL 15 min, un solo uso, 5 intentos/hora por usuario de
Alexa, aviso por email al `OWNER` al crearse un vínculo, revocación en un clic)
están en `ALEXA_SKILL.md` §7 y el riesgo residual es **R07**.

### 3.11 `alexa_reminder_syncs`

Espejo del estado de los recordatorios proactivos de Alexa: **estado deseado calculado
por Chatio + estado observado en Alexa.** Un documento por **franja horaria** de un
adulto, no por medicamento (**D022**, ver `ALEXA_REMINDERS.md` §5.2).

| Campo | Tipo | Notas |
| :--- | :--- | :--- |
| `adultId` | ObjectId → Adult | requerido |
| `alexaUserIdHash` | String | los reminders pertenecen al usuario de Alexa, no al adulto |
| `slotKey` | String | identidad de la franja: `"09:00\|0123456"` (hora local + días ordenados) |
| `localTime` | String `HH:mm` | hora de pared del aviso |
| `daysOfWeek[]` | Array\<Number\> | 0–6 |
| `timezone` | String | zona IANA del adulto al calcular el estado deseado |
| `startDate` / `endDate` | String \| null | vigencia, derivada de los medicamentos de la franja |
| `text` | String | texto hablado. **Genérico, sin datos de salud** (**D023**) |
| `desiredHash` | String | hash del estado deseado; comparación O(1) para saber si hay que sincronizar |
| `desired` | Boolean | `false` cuando la franja ya no debe existir (pendiente de borrado) |
| `alertToken` | String \| null | identificador que devuelve Alexa; `null` hasta que se crea |
| `apiEndpoint` | String \| null | host regional con el que se creó |
| `status` | Enum | `PENDING_CREATE` \| `PENDING_UPDATE` \| `PENDING_DELETE` \| `SYNCED` \| `FAILED` |
| `lastSyncedAt` | Date \| null | última sincronización efectiva |
| `lastAttemptAt` | Date \| null | último intento (para el backoff) |
| `attempts` | Number | intentos consecutivos fallidos; a los 5 pasa a `FAILED` |
| `lastError` | Subdoc \| null | `{ httpStatus, code, message, at }` — código de Alexa, sin tokens |
| `medicationIds[]` | Array\<ObjectId\> | qué medicamentos caen en esta franja. **Informativo**, para el panel; no es una relación de dominio |

Índices:

```js
{ adultId: 1, slotKey: 1 }                  // ÚNICO — idempotencia del reconciliador
{ adultId: 1, status: 1 }                   // pendientes de un adulto
{ alexaUserIdHash: 1, status: 1 }           // reconciliación en sesión
{ alertToken: 1 }                           // sparse; resolución inversa desde Alexa
```

**Máquina de estados**

```text
                       reconciliación en sesión (POST)
   PENDING_CREATE ──────────────────────────────────────► SYNCED
         │                                                  │
         │ 5 fallos                             cambia la franja
         ▼                                                  ▼
       FAILED ◄───── 5 fallos ───────────────────── PENDING_UPDATE
         ▲                                                  │
         │                                          (PUT) ► SYNCED
         │                        el medicamento se pausa o se borra
         └──── 5 fallos ────────── PENDING_DELETE ──(DELETE)──► documento eliminado

   Deriva detectada por GET /v1/alerts/reminders:
     alertToken que Alexa ya no conoce (404)  -> PENDING_CREATE, alertToken = null
     reminder en Alexa sin documento local    -> DELETE (huérfano de un sync fallido)
```

**Por qué una colección y no campos en `Medication`.** La programación de la medicación es
del dominio de Chatio y su fuente de verdad; el reminder es un efecto en un sistema
externo que puede fallar, desaparecer o ser borrado por el usuario desde la app Alexa.
Mezclarlos metería `alertToken`, `status`, `attempts` y `lastError` dentro de
`Medication`, que es justamente el documento que el cuidador edita, y volvería el dominio
dependiente de una integración. Con esta separación, quitar Alexa del producto es borrar
una colección y un servicio.

**Por qué el estado deseado se recalcula y no se edita.** `AlexaReminderSync` es
**derivado** de los `Medication` activos del adulto: nadie lo escribe a mano, ni desde el
panel ni desde la skill. Cualquier divergencia se corrige recalculando, lo que hace al
sistema autocurativo y evita un "estado de sincronización" que se pueda corromper por una
escritura parcial.

**Invariante crítico, con test dedicado (`D021`):** ninguna operación de esta colección
—ni la creación, ni la actualización, ni la emisión de un reminder— puede modificar el
`status` de una `MedicationOccurrence`. **Un recordatorio emitido no es una toma
confirmada.** La ocurrencia solo pasa a `TAKEN` por una declaración explícita del adulto
(por voz) o del cuidador (en el panel).

---

## 4. Resolución de ambigüedad al confirmar por voz

El caso "el adulto dice *ya tomé mi medicamento* y hay dos pendientes" se resuelve
así, en orden:

1. Si el intent trajo slot de medicamento y matchea (sin acentos, case-insensitive,
   por prefijo) **una sola** ocurrencia confirmable → esa.
2. Si la sesión tiene `awaitingConfirmation` (Chatio acaba de nombrar un
   medicamento) → esa.
3. Si hay **exactamente una** ocurrencia confirmable en la ventana → esa.
4. Si hay varias, se prioriza la que tenga el `scheduledAt` más cercano a la hora
   actual; si dos empatan dentro de ±15 minutos, **no se elige**: se pregunta
   nombrando los dos medicamentos.
5. Si no hay ninguna confirmable pero hay una `MISSED` de hoy, se ofrece
   registrarla como tomada fuera de horario.
6. Si no hay nada, se responde que no hay nada pendiente. No se inventa.

"Confirmable" = `status: PENDING` y
`scheduledAt − 60 min ≤ ahora ≤ scheduledAt + graceMinutes`.

---

## 5. Cálculo de la agenda del día

`GET /api/v1/adults/:adultId/today` y el `LaunchRequest` usan el mismo servicio:

1. Determinar `localDate` del adulto con su `timezone`.
2. Traer `MedicationOccurrence` con `{ adultId, localDate }` — una consulta, un
   índice, sin conversión de fechas en la query.
3. Calcular los `Reminder` del día al vuelo: los `ONE_OFF` con `date = localDate`,
   más los `RECURRING` activos cuyo `daysOfWeek` incluye el día de la semana y
   cuya vigencia cubre la fecha.
4. Mezclar y ordenar por hora local.
5. La respuesta de Alexa toma de esta lista los ítems **desde la hora actual en
   adelante**, más los pendientes vencidos del día, y los verbaliza con hora en
   lenguaje natural.

Costo: 2 consultas indexadas. Compatible con el presupuesto de 8 s.

---

## 6. Por qué los recordatorios no tienen ocurrencias

Un recordatorio del MVP no se confirma: se informa. Sin confirmación no hay estado
que persistir por instancia, así que materializarlos solo agregaría documentos y un
job más. Se calculan al vuelo (§5).

Si en el futuro se quiere "¿ya llamaste a tu hija?", se agrega
`ReminderOccurrence` con la misma forma que `MedicationOccurrence`. El diseño
actual no lo impide. Ver **D010**.

---

## 7. Minimización de datos

Se guarda lo que el producto necesita para funcionar y nada más:

- **No** se guardan diagnósticos, historia clínica, obra social, DNI ni dirección.
- `birthDate` es opcional; solo sirve si después se quiere mostrar la edad.
- `notes` del adulto es texto libre para la experiencia de voz, y así se
  documenta en la UI ("información útil para conversar, no datos médicos").
- **No** se guarda audio ni transcripciones libres de lo que dice el adulto. Del
  request de Alexa se persiste únicamente el intent resuelto y los slots
  necesarios. Chatio no es un grabador.
- Los identificadores de Amazon se guardan hasheados (§3.9).

---

## 8. Documentos de ejemplo

```json
// medications
{
  "_id": "66f1a0000000000000000101",
  "adultId": "66f1a0000000000000000001",
  "name": "Losartán",
  "dose": 50, "doseUnit": "MG",
  "quantity": 1, "quantityUnit": "COMPRIMIDO",
  "instructions": "Después del desayuno",
  "schedule": {
    "times": ["09:00"],
    "daysOfWeek": [0,1,2,3,4,5,6],
    "startDate": "2026-09-01",
    "endDate": null
  },
  "graceMinutes": 180,
  "isActive": true,
  "deletedAt": null
}
```

```json
// medication_occurrences
{
  "_id": "66f1a0000000000000000201",
  "adultId": "66f1a0000000000000000001",
  "medicationId": "66f1a0000000000000000101",
  "scheduledAt": "2026-09-29T12:00:00.000Z",
  "localDate": "2026-09-29",
  "localTime": "09:00",
  "timezone": "America/Argentina/Buenos_Aires",
  "status": "TAKEN",
  "confirmedAt": "2026-09-29T12:02:31.000Z",
  "source": "ALEXA",
  "confirmedByUserId": null,
  "confirmedOutOfWindow": false,
  "graceMinutes": 180,
  "snapshot": {
    "name": "Losartán", "dose": 50, "doseUnit": "MG",
    "quantity": 1, "quantityUnit": "COMPRIMIDO",
    "instructions": "Después del desayuno"
  }
}
```

```json
// activity_events
{
  "adultId": "66f1a0000000000000000001",
  "type": "MEDICATION_CONFIRMED",
  "occurredAt": "2026-09-29T12:02:31.000Z",
  "source": "ALEXA",
  "actorType": "ADULT",
  "actorUserId": null,
  "summary": "Medicamento confirmado — Losartán 50 mg",
  "relatedId": "66f1a0000000000000000201",
  "relatedModel": "MedicationOccurrence",
  "payload": { "medicationName": "Losartán", "scheduledLocalTime": "09:00" }
}
```

---

## 9. Decisiones de modelado registradas

Todas están en el *Registro de decisiones* de `ROADMAP.md`:

`D002` no hay registro público de usuarios · `D003` relación N:N cuidador/adulto ·
`D004` roles OWNER/CAREGIVER · `D005` ocurrencias materializadas con snapshot ·
`D006` scheduler en proceso · `D007` `HelpRequest` separada de `ActivityEvent` ·
`D010` recordatorios sin ocurrencias · `D012` identificadores de Alexa hasheados ·
`D013` zonas horarias · `D014` soft delete selectivo · `D021` Reminders API en el MVP con
`AlexaReminderSync` desacoplada del dominio · `D022` un reminder por franja horaria ·
`D023` texto del aviso sin datos de salud · `D024` reconciliación solo en sesión.
