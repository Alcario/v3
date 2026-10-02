# CLAUDE.md

Guía para Claude Code (claude.ai/code) al trabajar en este repositorio.

## Flujo de trabajo (obligatorio)

`ROADMAP.md` es la **fuente de verdad del progreso** y sus *Reglas para futuras
sesiones* tienen precedencia sobre cualquier criterio propio. El ciclo:

1. Leer `ROADMAP.md` completo.
2. Identificar la **iteración activa** y la **primera tarea sin marcar** dentro de
   ella.
3. Implementar **solo esa tarea**.
4. Escribir o actualizar sus tests.
5. Ejecutar los tests y verificar los criterios de aceptación.
6. Actualizar `ROADMAP.md` (tarea, estado, bitácora con el resultado real).
7. **Detenerse y reportar.** No avanzar a la siguiente tarea sin autorización
   explícita del usuario.

Una tarea implementada **no** es una tarea completada: se completa cuando pasa sus
criterios de aceptación y sus tests. Una iteración no se marca COMPLETADA si queda
un criterio sin verificar.

Las ambigüedades no se inventan: se registran como `DECISIÓN PENDIENTE` en
`ROADMAP.md` y se pregunta. Si bloquean la tarea, la tarea queda `BLOQUEADA`.

## Estado actual

Iteraciones **0, 1, 2, 3, 4 y 5 COMPLETADAS** (2026-10-02). Existe `backend/` con:

- Infraestructura: configuración validada, logging con redacción, errores centralizados,
  healthchecks.
- **Autenticación**: `User`, `AuthSession`, login, refresh con rotación y detección de
  reutilización, logout idempotente, `/auth/me`, `POST /admin/users`, `requireAuth`,
  `requirePlatformAdmin`, `npm run seed:admin`.
- **Dominio de adultos y cuidadores**: `Adult`, `CaregiverAccess`, `requireAdultAccess`,
  `requireRole`, CRUD de adultos, accesos OWNER/CAREGIVER, revocación inmediata y
  auditoría mínima.
- **Medicamentos y horarios**: `Medication` con `schedule` embebido, CRUD protegido,
  soft delete, pausa/reactivación, cálculo de próxima ocurrencia local/UTC y utilidades
  de Luxon con pruebas de DST.
- 235 tests en verde; cobertura global actual: 87,50 % de sentencias y 79,34 % de ramas.

**Ocurrencias y confirmaciones:** `MedicationOccurrence`, materializador, sweeper,
confirmaciones, omisiones y endpoints del historial están implementados.
No hay frontend ni integración con Alexa.

**La Iteración 6 — Recordatorios y agenda no comienza sin autorización explícita del
usuario.**

**No hay decisiones pendientes.** Las cinco bloqueantes se cerraron el 2026-09-29: D003
(N:N), D004 (`OWNER`/`CAREGIVER`), D009 (código de 4 dígitos, sin Account Linking), D011
(email + panel) y D015 (**VPS propio**: Nginx + Let's Encrypt, MongoDB en `localhost`,
backups cifrados fuera del servidor).

El alcance de la proactividad también se cerró: **D021 supersede a D018** e incorpora la
**Alexa Reminders API** al MVP, con la **Iteración 16** dedicada. D018 se conserva en el
roadmap por trazabilidad y **no debe implementarse**. Lo único abierto son verificaciones
empíricas de plataforma, todas dentro de la Iteración 16.

## Documentos normativos

Antes de implementar, leer el documento que corresponda; son el contrato que las
tareas implementan, no material de referencia opcional:

- `docs/ARCHITECTURE.md` — capas, reglas estructurales, scheduler, zonas horarias,
  límites reales de Alexa.
- `docs/DATA_MODEL.md` — colecciones, campos, enums, índices, estados.
- `docs/API.md` — contratos REST.
- `docs/ALEXA_SKILL.md` — intents, utterances, respuestas, vinculación.
- `docs/ALEXA_REMINDERS.md` — avisos proactivos: permisos, consentimiento, límites, errores
  y sincronización. Distingue lo **verificado** contra documentación oficial de lo que falta
  verificar; no convertir un ítem sin verificar en un supuesto.
- `docs/SECURITY.md` — autenticación, autorización, logs, secretos.
- `docs/TESTING.md` — qué se testea y cómo.
- `docs/FRONTEND.md` — pantallas, diseño, accesibilidad.

Cambiar un contrato exige actualizar su documento **en el mismo cambio** y registrar
la decisión en `ROADMAP.md`.

## Reglas estructurales que no se negocian

- La lógica de negocio vive **solo** en `src/modules/*/*.service.js`. Los
  controladores REST y los handlers de Alexa son adaptadores delgados: sin `if` de
  negocio, sin Mongoose.
- Un servicio nunca conoce `req`, `res` ni el `HandlerInput` de Alexa.
- El `adultId` viaja **siempre** en la URL, nunca en el body, y todo endpoint bajo
  `/api/v1/adults/:adultId` pasa por `requireAdultAccess`, que verifica el acceso
  **contra la base** en cada request.
- Nunca `Model.create(req.body)` ni `Object.assign(doc, req.body)`. Se construye el
  objeto a persistir con los campos permitidos, explícitamente.
- Los campos que fija el servidor (`source`, `confirmedByUserId`, `createdByUserId`,
  `status`, `role`) se rechazan si vienen en el body.
- Un recurso inaccesible responde **404**, no 403.
- Todo schema de body con `.strict()`.
- El endpoint de Alexa **nunca** devuelve 5xx: los errores se traducen a una
  respuesta hablada amable.
- La skill es de solo lectura + confirmación de tomas. No crea, edita ni borra
  medicamentos, recordatorios ni accesos.
- Las ocurrencias de medicación y los eventos de actividad no se editan ni se
  borran; las ocurrencias solo cambian de estado según su máquina de estados.
- **Un recordatorio de Alexa emitido no es una toma confirmada.** Ninguna operación de
  `reminderSync` puede alterar el `status`, el `confirmedAt` ni el `source` de una
  `MedicationOccurrence`. Es un invariante con test dedicado.
- El texto de los avisos de Alexa **no lleva nombre de medicamento, dosis ni indicación**
  (**D023**): Amazon lo almacena y el Echo es compartido.
- La UI nunca dice "Medicamento tomado": dice *"María confirmó que tomó Losartán 50 mg"*.
  El vocabulario obligatorio está en `docs/FRONTEND.md` §1.
- Todo el acoplamiento con Alexa Reminders vive en `AlexaReminderSync` y su servicio.
  `Medication` y `MedicationOccurrence` no tienen campos de Alexa, y no deben tenerlos.
- El `apiAccessToken` de Alexa se usa dentro del request y **no se persiste ni se loguea**.
- Nunca se loguean tokens, cookies, contraseñas, códigos de vinculación ni
  identificadores completos de Alexa.

## Idioma

Código, nombres y commits en **inglés**; documentación, UI y textos de voz en
**español** (decisión **D019**). Los enums son constantes en inglés (`TAKEN`) con
etiquetas en español mapeadas en un solo lugar.

## Comandos

Desde `backend/`:

```bash
npm run dev            # node --watch src/server.js (necesita MONGODB_URI accesible)
npm test               # vitest run — 214 tests
npm run seed:admin     # primer administrador; ver .env.example para las variables
npm run test:coverage  # objetivo global 70%; hoy 89,62% de sentencias
npm run lint           # eslint
npm run format:check   # prettier
```

El `.env` vive en la **raíz del repositorio**, no en `backend/`. Ver `.env.example`.

Los tests levantan un MongoDB real en memoria (`mongodb-memory-server`); la primera corrida
descarga el binario.

## Convenciones que ya están fijadas en el código

- **ESM** (`"type": "module"`) y dependencias con versión **exacta** (**D027**).
- `src/app.js` es una **fábrica** `createApp({ env, logger })`: no lee `process.env` ni crea
  su propio logger. `src/server.js` es el proceso; el cierre ordenado vive en
  `src/lifecycle.js` para poder testearse.
- Nada de `console.*`: el lint lo prohíbe. El único canal es el logger, salvo
  `process.stderr` en el arranque, antes de que el logger exista.
- Los datos validados viven en **`req.validated`**, nunca en `req.body`. Los esquemas de
  body se declaran con `z.strictObject(...)`.
- Un endpoint nuevo bajo `/api/v1` se monta en el punto marcado con un comentario en
  `app.js`. El endpoint de Alexa va **antes** del parser JSON (necesita el body crudo).
- El entorno se amplía **por iteración** (**D026**): agregar una variable implica sumarla a
  `env.js`, a `.env.example` y a sus tests.
- Los healthchecks son `/health` y `/ready`, **sin** `/api/v1` y sin envoltorio
  (**D025**).
- El código de vinculación se llama **`pairingCode`**, nunca `code`: `code` es el campo del
  código de error de la API y redactarlo dejaría los logs ciegos.
- La identidad autenticada vive en **`req.actor`** (`{ userId, isPlatformAdmin, user }`) y es
  la única fuente de identidad: **nunca** tomar el id del usuario del body, del query ni de
  la URL.
- `requireAuth` valida contra la base en cada request (**D029**): un usuario desactivado o
  un logout global surten efecto de inmediato.
- Un refresh token **reusado** revoca la sesión entera (**D028**). No agregar ventanas de
  gracia: debilitan la detección de replay. El frontend resuelve la concurrencia con un
  refresh de vuelo único.
- El refresh token **nunca** va en el cuerpo de una respuesta, solo en la cookie
  `chatio_rt` con `httpOnly; SameSite=Strict; Path=/api/v1/auth`.
- Los eventos de seguridad van a `logSecurityEvent`, al log estructurado, **no** al timeline
  de actividad del adulto.
