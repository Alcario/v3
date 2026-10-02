# Estrategia de pruebas — Chatio MVP

Versión 1.0 · Iteración 0 · 2026-09-29

Los tests son la única puerta que permite marcar una tarea como COMPLETADA. No hay
"lo probé a mano y funciona" en el `ROADMAP.md`.

---

## 1. Herramientas

| Ámbito | Herramientas | Por qué |
| :--- | :--- | :--- |
| Backend unit + integración | **Vitest** + **Supertest** + **mongodb-memory-server** | Vitest es el mismo runner que el frontend (una sola sintaxis, un solo mental model) y es rápido. `mongodb-memory-server` corre un Mongo real en memoria: los índices únicos, los TTL y los operadores se comportan de verdad, cosa que un mock de Mongoose no puede garantizar |
| Frontend | **Vitest** + **@testing-library/react** + **MSW** | Testing Library empuja a testear lo que ve el usuario. MSW intercepta a nivel de red, así que se prueba el `apiClient` real y no un mock de `fetch` |
| Alexa | **Vitest** con `HandlerInput` construido por fábricas + Supertest sobre `/alexa/skill` | No se necesita el simulador para la lógica; el simulador y un Echo real cubren lo que ningún test cubre (ASR) |
| Fechas | Reloj fijo con `vi.setSystemTime` | Nada de horarios dependientes de cuándo corre la suite |

Desde la Iteración 3, `mongodb-memory-server` se levanta como replica set de un nodo para
probar las transacciones de Adult + OWNER y sus carreras de autorización.

Los servicios de ocurrencias reciben `now` explícitamente; los tests de materialización,
sweeper y confirmación usan ese reloj inyectado en lugar de depender de la hora del
proceso. Los jobs solo coordinan el servicio y también se prueban con un reloj fijo.

Se descarta Jest (más lento, doble configuración con Vite) y se descartan
frameworks E2E (Playwright/Cypress) en el MVP: el costo de mantenimiento no se
justifica todavía. Los flujos completos se cubren con tests de integración de API +
tests de componentes. Registrado como deuda técnica **DT05**.

---

## 2. Reglas transversales

1. **Un test falla por una sola razón.** Nombre en español, descriptivo, con la
   forma "hace X cuando Y".
2. **Fábricas, no fixtures compartidos.** `tests/factories/` con
   `makeUser`, `makeAdult`, `makeMedication`, `makeOccurrence`, `makeAlexaRequest`,
   cada una con overrides. Nada de una base semilla global que acopla tests entre
   sí.
3. **Base limpia entre tests.** `beforeEach` borra las colecciones; el servidor
   Mongo en memoria se levanta una vez por archivo.
4. **Tiempo congelado** en todo test que toque horarios, ocurrencias, ventanas o
   TTL.
5. **Sin red.** Email y cualquier proveedor externo van detrás de una interfaz y se
   stubbean. Un test que falla porque no hay internet es un test roto.
6. **Los tests de autorización son obligatorios**, no opcionales: por cada endpoint
   nuevo, un test sin token, uno con un cuidador ajeno y —si aplica— uno con rol
   insuficiente. Si el endpoint no tiene esos tres tests, la tarea no está
   terminada.
7. **Cobertura**: objetivo ≥ 85 % en servicios y ≥ 70 % global. La cobertura es un
   indicador, no la meta; un servicio de dominio sin tests de reglas no se aprueba
   aunque el número cierre.

---

## 3. Backend

### 3.1 Unitarios de servicios

Es donde vive la mayor parte del valor. Sin HTTP, sin Express; se llama al servicio
directamente.

**`occurrenceService` — el más crítico del sistema:**

- Materializa correctamente un medicamento diario de un horario en 48 h.
- Materializa varios horarios por día (`["09:00","21:00"]`).
- Respeta `daysOfWeek` (un medicamento de lunes a viernes no genera sábado).
- Respeta `startDate` y `endDate` (no genera antes ni después).
- No genera nada para un medicamento `isActive: false` ni con `deletedAt`.
- **Es idempotente**: correrlo dos veces no duplica (verifica el índice único).
- Convierte bien la hora local a UTC con la timezone del adulto.
- **Cambio de horario de verano**: un adulto en una zona con DST mantiene la hora de
  pared (09:00 local sigue siendo 09:00 después del cambio; el UTC se corre).
- Adultos en zonas distintas generan instantes distintos para el mismo `"09:00"`.
- `confirm` de una `PENDING` en ventana → `TAKEN` con `confirmedAt` y `source`.
- `confirm` de una ya `TAKEN` → **idempotente**: no cambia `confirmedAt`, no emite
  un segundo `ActivityEvent`.
- `confirm` fuera de ventana → `confirmedOutOfWindow: true`.
- `confirm` de una `SKIPPED` → error de estado.
- `skip` desde `PENDING` y desde `MISSED`; `skip` de una `TAKEN` → error.
- El sweeper pasa a `MISSED` solo lo vencido por `graceMinutes` y emite eventos.
- El sweeper no toca `TAKEN` ni `SKIPPED`.
- Dos `confirm` concurrentes producen **un solo** evento (se testea llamando dos
  veces en paralelo con `Promise.all`).
- `snapshot` inmutable: editar el medicamento no altera las ocurrencias pasadas.
- Editar un medicamento borra las `PENDING` futuras y re-materializa; no toca las
  resueltas.

**`agendaService`:** mezcla y ordena medicación y recordatorios; calcula el día
local correcto para un adulto en otra zona horaria; incluye los `ONE_OFF` de la
fecha y los `RECURRING` vigentes; excluye recordatorios fuera de vigencia; agenda
vacía; `summary` con los contadores correctos.

**`medicationService`:** validación de horarios y rangos; unicidad razonable;
pausa/reactivación; soft delete que conserva historial; emisión de
`ActivityEvent`.

**`reminderService`:** validación condicional `ONE_OFF` vs `RECURRING`; cálculo de
ocurrencia del día; vigencia.

**`helpService`:** crea una solicitud y notifica; **dedupe** dentro de 15 min
incrementando `attempts` sin re-notificar; escalamiento al cruzar el umbral;
transiciones `acknowledge`/`resolve` y su idempotencia; fallo de notificación que
queda `FAILED` sin romper la creación.

**`alexaLinkService`:** genera código y guarda solo el hash; canje válido crea el
vínculo; código vencido, ya usado o inexistente falla igual (sin filtrar cuál de
los tres); límite de intentos; resolución por `deviceIdHash`; vínculo ambiguo
detectado; revocación.

**`authService`** (implementado en la Iteración 2, 80 tests en 5 archivos):

- **Usuario**: email normalizado (`trim` + `lowercase`) y único, incluso con otra
  capitalización; la contraseña **nunca** aparece en el documento crudo de Mongo; el hash
  verifica; dos usuarios con la misma contraseña tienen hashes distintos; `passwordHash`
  no sale ni pidiéndolo explícitamente; `toPublicJSON` expone exactamente seis campos.
- **Política de contraseñas**: mínimo 10 caracteres, rechazo de las más comunes, y una
  frase larga sin símbolos es válida.
- **Login**: credenciales correctas; email inexistente y contraseña incorrecta devuelven
  **la misma** respuesta; usuario inactivo idem; no se crea sesión al fallar; el access
  token lleva solo `sub` y `tv`; el refresh token **no** aparece en el cuerpo; la cookie
  tiene `httpOnly`, `SameSite=Strict`, `Path` acotado, y `Secure` solo en producción.
- **Access token / requireAuth**: válido; ausente; esquema distinto de Bearer; expirado;
  firma de otro secreto; `alg: none`; refresh token usado como access; sin `tv`; `tv`
  desactualizado; usuario desactivado **después** de emitir el token; usuario borrado;
  `sub` que no es un ObjectId.
- **Refresh y rotación**: rota el token y conserva la sesión; guarda el hash nuevo y
  descarta el viejo; cadena de cuatro rotaciones; `jti` distinto en cada una; sin cookie;
  token de otra audiencia; expirado; sesión revocada; **sesión vencida con el documento
  todavía presente** (TTL diferido); usuario inactivo; `tv` desactualizado; `sid` que no es
  ObjectId; `sub` que no coincide con el dueño de la sesión.
- **Reutilización (D028)**: reusar R1 después de rotar a R2 → 401; la sesión queda
  revocada con `REUSE_DETECTED` y **R2 también deja de servir**; las sesiones de otros
  dispositivos **no** se tocan; se borra la cookie; se registra `AUTH_REFRESH_REUSE` con
  nivel `error`; **dos refresh simultáneos con el mismo token**: uno rota y el otro se
  rechaza.
- **Logout**: revoca la sesión y borra la cookie; el refresh deja de servir; idempotente
  (dos veces → 204 y un solo documento); sin cookie → 204; cookie basura → 204; no cierra
  la sesión del otro dispositivo.
- **Logout global**: revoca todas las sesiones, sube `tokenVersion` e invalida **al
  instante** los access tokens ya emitidos.
- **`/me`**: autenticado; no autenticado; sin campos sensibles; **la identidad sale del
  token y no de un parámetro de la URL**.
- **Alta administrativa**: un `isPlatformAdmin` crea un usuario que después puede entrar;
  sin token → 401; usuario común → 403; contraseña débil → 400; email duplicado → 409;
  `isPlatformAdmin: true` en el body no sirve para autopromoverse; **no existe ningún
  endpoint público de bootstrap** (se verifica que tres rutas plausibles dan 404).
- **Ciclo completo** (`auth.cycle.test.js`): login → API autenticada → **expiración real
  del access token** → refresh → rotación → nuevo access → logout → refresh inválido. Y en
  un test aparte: R1 → R2 → replay de R1 → rechazado y sesión revocada.

**`activityService`:** los eventos son append-only; `summary` bien formado;
paginación por cursor estable.

**`reminderSyncService`** (avisos proactivos, `ALEXA_REMINDERS.md` §5):

- Agrupa correctamente los horarios en franjas: dos medicamentos a las 09:00 producen
  **un** solo aviso, no dos.
- Agregar un tercer medicamento en una franja **ya existente** no genera ningún cambio
  pendiente (el `desiredHash` no cambia).
- Agregar una franja nueva genera exactamente un `PENDING_CREATE`.
- Pausar o borrar el último medicamento de una franja genera `PENDING_DELETE`.
- Cambiar los días o la hora genera `PENDING_UPDATE`, no un borrado más una creación.
- Mapeo a RRULE: `[0..6]` → `FREQ=DAILY;...;INTERVAL=1`; `[1..5]` →
  `FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;...`.
- `scheduledTime` se emite como hora local sin offset, con el `timeZoneId` del adulto.
- La reconciliación es **idempotente**: la segunda corrida seguida no hace llamadas.
- Respeta el presupuesto: con 20 franjas pendientes, hace como máximo 6 operaciones y deja
  el resto pendiente.
- `permissionStatus != GRANTED` → **no hace ninguna llamada** a Alexa.
- `401 UNAUTHORIZED` → `permissionStatus: REVOKED` + evento; no reintenta en bucle.
- `404` sobre un `alertToken` → vuelve a `PENDING_CREATE` con `alertToken: null`.
- `429` → backoff, no reintento inmediato.
- 5 fallos consecutivos → `FAILED`, y deja de intentar hasta un cambio o un resync.
- Un reminder presente en Alexa sin documento local se borra (huérfano).
- **Invariante crítico:** ninguna operación del servicio modifica el `status`, el
  `confirmedAt` ni el `source` de ninguna `MedicationOccurrence`. Se testea ejecutando una
  reconciliación completa y comparando el estado de las ocurrencias antes y después.
- El texto generado **no contiene** el nombre del medicamento ni la dosis (test sobre el
  generador de texto, con un medicamento de nombre reconocible).

### 3.2 Integración de API (Supertest)

Por cada recurso: happy path de cada método, validación (400 con `details`),
autorización (401 / 403 / 404), y el efecto real en la base.

Tests de autorización que se repiten en **todos** los recursos anidados:

```text
sin Authorization                                        -> 401
token expirado                                           -> 401
token de un cuidador sin acceso a ese adulto             -> 404
CAREGIVER en una ruta que exige OWNER                    -> 403
id de otro adulto con acceso válido al propio            -> 404
adultId con formato inválido                             -> 400
```

Reglas de negocio que se testean vía API: no se puede revocar el último `OWNER`;
no se puede crear un acceso duplicado; el `source` del body se ignora y lo fija el
servidor; una propiedad desconocida en el body devuelve 400; `limit=1000` se
recorta a 100.

**Test estructural obligatorio:** recorrer el router de Express y fallar si existe
alguna ruta bajo `/api/v1/adults/:adultId` que no tenga `requireAdultAccess` en su
cadena de middlewares. Es el test que evita el olvido humano dentro de seis meses.

### 3.3 Jobs

Se testean como funciones puras invocables, no esperando al cron: `node-cron` solo
se verifica en que registra la expresión correcta.

---

## 4. Frontend

Se testea lo que rompe de verdad, no cada botón.

**Formularios (lo más valioso):**

- Medicamento: campos requeridos, dosis > 0, horarios `HH:mm` válidos, al menos un
  horario, al menos un día, `endDate ≥ startDate`, y que el payload enviado sea el
  esperado.
- Recordatorio: `ONE_OFF` pide fecha, `RECURRING` pide días, y el formulario cambia
  según el tipo.
- Login: validación, error de credenciales visible y accesible, estado de carga que
  deshabilita el submit (sin doble envío).

**Estados de carga y error:** cada pantalla de datos tiene test de *loading*,
*error* con reintento, y *vacío* con mensaje útil (no una tabla vacía muda).

**Flujos críticos:**

- Login → dashboard → selector de adulto persiste la elección.
- 401 en una request dispara refresh y reintenta; si el refresh falla, redirige a
  login sin bucle infinito.
- Confirmar una toma desde el dashboard invalida las queries correctas y la UI
  refleja el cambio.
- Atender una solicitud de ayuda la saca del badge global.

**Componentes compartidos:** tabla vacía, badge de estado por cada valor de enum,
formateo de fecha/hora **en la zona del adulto** (test explícito con un adulto en
otra zona que el "navegador").

**Accesibilidad:** en los formularios y la navegación, `getByLabelText` y
`getByRole` en lugar de selectores de clase — si el test no encuentra el campo por
su etiqueta, el usuario de lector de pantalla tampoco.

---

## 5. Alexa

### 5.1 Unitarios de handlers

Fábrica `makeAlexaRequest({ type, intent, slots, sessionAttributes, userId, deviceId })`.
Cada test assertea `outputSpeech`, `reprompt`, `shouldEndSession` y
`sessionAttributes`, con los servicios stubbeados.

### 5.2 Integración

`POST /alexa/skill` con requests ASK completos (JSON capturado del simulador), firma
deshabilitada por env, base en memoria: se verifica la respuesta hablada **y** el
efecto en Mongo (ocurrencia confirmada, `ActivityEvent` creado, `HelpRequest`
abierta).

Seguridad del endpoint: firma inválida → 400; `applicationId` ajeno → 400;
`ALEXA_VERIFY_SIGNATURE=false` con `NODE_ENV=production` → el arranque falla.

### 5.3 Casos borde obligatorios

Los del brief, más los que aparecieron al diseñar. Cada fila es un test con nombre
propio:

| # | Caso | Assert |
| :--- | :--- | :--- |
| 1 | Confirma una medicación **dos veces** | 2ª respuesta *"ya lo tenía registrado"*; `confirmedAt` sin cambios; **un solo** `ActivityEvent`; sin ocurrencia nueva |
| 2 | Pregunta qué tomar con **dos pendientes** | Nombra los dos y pregunta cuál; no confirma nada; sesión abierta |
| 3 | Confirma **fuera de horario** | `TAKEN` con `confirmedOutOfWindow: true`; respuesta sin reproche |
| 4 | **No hay pendientes** | *"No tenés nada pendiente"* + próximo horario si existe; sin escritura |
| 5 | Dice *"necesito ayuda"* **tres veces** | Una `HelpRequest` con `attempts: 3`; una notificación + una de escalamiento; nunca tres solicitudes |
| 6 | **Sin vínculo** de Alexa | Guion de vinculación; cero acceso a datos; `ALEXA_LINK_FAILED` |
| 7 | *"Sí"* sin contexto | Pide aclaración; no confirma nada |
| 8 | Vínculo **ambiguo** (2 adultos, mismo `userId`, sin `deviceId`) | Pide completar la configuración; no elige adulto |
| 9 | Adulto **inactivo** | Mensaje neutro, cierra, sin datos ni nombres |
| 10 | **Mongo caído** | Mensaje amable; HTTP **200** con respuesta hablada; nunca 5xx |
| 11 | Código de vinculación **vencido / usado / inexistente** | Misma respuesta en los tres casos; `attempts` incrementado |
| 12 | Slot de medicamento **que no matchea** | No inventa; ofrece decir lo que toca ahora |
| 13 | **Dos confirmaciones concurrentes** de la misma ocurrencia | Un solo `ActivityEvent` (`Promise.all` sobre dos requests) |
| 14 | `FallbackIntent` **dos veces seguidas** | Segunda respuesta cierra la sesión con cortesía |
| 15 | `AMAZON.HelpIntent` | Menciona explícitamente cómo pedir ayuda |
| 16 | Confirma una toma de **otro adulto** (id manipulado en sesión) | Rechazado: el adulto se resuelve del vínculo, no de la sesión |
| 17 | Adulto en **otra timezone** consulta su agenda | Devuelve su día local, no el del servidor |
| 18 | Latencia: el handler tarda > 5 s | El timeout interno dispara la respuesta de fallback |

El caso 16 es el test de seguridad más importante de la skill: prueba que los
`sessionAttributes` no son fuente de autoridad.

### 5.4 Avisos proactivos (Reminders)

- Consentimiento por voz: `ACCEPTED`, `DENIED` y `NOT_ANSWERED`, cada uno con su efecto en
  `permissionStatus` y su `ActivityEvent`.
- `DENIED` no vuelve a pedir el permiso por voz; `NOT_ANSWERED` sí, con el límite de una
  vez por semana.
- El interceptor de reconciliación **no** retrasa ni cambia la respuesta hablada: test con
  un cliente de Reminders artificialmente lento que verifica que la respuesta sale igual.
- La sesión de vinculación con `ACCEPTED` crea los avisos y la respuesta menciona los
  horarios.
- Un fallo de la Reminders API no produce ninguna mención al adulto.

### 5.5 Manual (no automatizable)

Antes de cerrar las iteraciones 11 a 15, en un **Echo físico**:

- Reconocimiento del invocation name por una persona mayor real, no por quien
  desarrolla.
- Nombres de medicamentos dichos en voz alta (es donde el ASR falla, y ningún test
  lo detecta).
- Velocidad y claridad del TTS: ¿se entiende la respuesta a la primera?
- Que la sesión no muera antes de que la persona alcance a contestar.
- **Que el aviso proactivo suene de verdad**, en `es-MX`, a la hora correcta, y que se
  entienda. Es la verificación más importante de la Iteración 16 (**R15**) y no hay test
  automatizado que la sustituya.
- Cómo verbaliza Alexa en español un recordatorio creado por una skill (si antepone algo).
- Si los eventos de skill (`Reminders.ReminderStarted`) llegan al endpoint HTTPS.

Resultados de estas pruebas → bitácora del `ROADMAP.md`.

---

## 6. Comandos

Definitivos a partir de la Iteración 1:

```powershell
# Backend (desde backend/)
npm test                  # Vitest, una sola pasada
npm run test:watch
npm run test:coverage
npm test -- occurrence    # filtrado por nombre de archivo

# Frontend (desde frontend/)
npm test
npm run test:coverage
```

---

## 7. Integración continua

GitHub Actions desde la Iteración 1 (ver **D017**): en cada push y PR, backend y
frontend en paralelo — `npm ci`, `npm test`, `npm audit --audit-level=high`, y
`npm run build` del frontend. Sin deploy automático en el MVP: el deploy se dispara
a mano (Iteración 19).

Regla: **rama en rojo, iteración no cerrada.**

---

## 8. Qué NO se testea en el MVP

Declarado para que no parezca un olvido:

- La plataforma Alexa en sí (ASR, TTS, enrutamiento de intents). Es de Amazon.
- Tests de carga o performance. El volumen esperado es de decenas de adultos.
- Tests E2E de navegador (**DT05**).
- Tests de penetración externos. La Iteración 17 hace revisión manual con checklist.
- Compatibilidad con navegadores viejos. Objetivo: las dos últimas versiones de
  Chrome, Firefox, Safari y Edge.
