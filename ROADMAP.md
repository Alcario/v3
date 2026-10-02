# ROADMAP — Chatio

**Fuente de verdad del progreso del desarrollo.** Toda sesión de trabajo empieza
leyendo este archivo y termina actualizándolo.

Última actualización: 2026-10-02 · Iteraciones 0, 1, 2, 3, 4 y 5 **COMPLETADAS** · Próxima
iteración: **6**

---

## Índice

1. [Estado general](#estado-general)
2. [Reglas para futuras sesiones](#reglas-para-futuras-sesiones)
3. [Iteraciones](#iteraciones)
4. [Registro de decisiones](#registro-de-decisiones)
5. [Decisiones pendientes](#decisiones-pendientes)
6. [Riesgos](#riesgos)
7. [Deuda técnica](#deuda-técnica)
8. [Backlog futuro](#backlog-futuro)
9. [Bitácora de desarrollo](#bitácora-de-desarrollo)

---

## Estado general

| # | Iteración | Estado |
| :--- | :--- | :--- |
| 0 | Arquitectura y documentación | **COMPLETADA** |
| 1 | Base del backend | **COMPLETADA** |
| 2 | Autenticación y autorización | **COMPLETADA** |
| 3 | Adultos y cuidadores | **COMPLETADA** |
| 4 | Medicamentos | **COMPLETADA** |
| 5 | Ocurrencias y confirmaciones | **COMPLETADA** |
| 6 | Recordatorios y agenda diaria | PENDIENTE |
| 7 | Historial de actividad y solicitudes de ayuda | PENDIENTE |
| 8 | Frontend base | PENDIENTE |
| 9 | Dashboard | PENDIENTE |
| 10 | Pantallas de gestión | PENDIENTE |
| 11 | Alexa Skill base | PENDIENTE |
| 12 | Vinculación Alexa ↔ Chatio | PENDIENTE |
| 13 | Medicación mediante Alexa | PENDIENTE |
| 14 | Agenda mediante Alexa | PENDIENTE |
| 15 | Solicitud de ayuda y notificaciones | PENDIENTE |
| 16 | **Recordatorios proactivos (Alexa Reminders API)** | PENDIENTE |
| 17 | Seguridad y hardening | PENDIENTE |
| 18 | Testing integral | PENDIENTE |
| 19 | Deploy MVP | PENDIENTE |
| 20 | Validación con usuarios | PENDIENTE |

Cambios respecto de la propuesta inicial de 19 iteraciones, y por qué:

- **Se agrega la Iteración 16 — Recordatorios proactivos**, y las siguientes se corren un
  número. Es consecuencia de **D021**: la Reminders API entra al alcance del MVP y necesita
  su propia iteración, antes de la validación con usuarios. Va después de las iteraciones
  de Alexa (11 a 15) porque depende de la skill funcionando y de la vinculación, y antes de
  seguridad y testing para que el hardening y la cobertura la incluyan.

- La iteración de frontend "Dashboard y gestión" se partió en **9** y **10**: era
  demasiado grande para una sola tanda verificable (seis pantallas y cuatro
  formularios).
- "Solicitud de ayuda" (15) absorbe las notificaciones por email, que no tenían
  iteración propia y no son triviales.
- El modelo y la API de `HelpRequest` se adelantan a la **7**, junto con el
  timeline, porque comparten el mismo servicio de actividad. La **15** agrega el
  intent de voz y la notificación.
- Las iteraciones 13 y 14 se mantienen separadas (medicación / agenda) porque la
  primera escribe y la segunda solo lee: el riesgo es muy distinto.

---

## Reglas para futuras sesiones

1. **Antes de modificar código, leer este archivo completo.**
2. Identificar la **iteración activa** y, dentro de ella, la **primera tarea sin
   marcar**. Trabajar solo esa.
3. No implementar tareas de iteraciones futuras salvo necesidad técnica
   justificada, y en ese caso documentarla en la bitácora.
4. No modificar contratos existentes (`docs/API.md`, `docs/DATA_MODEL.md`) sin
   actualizar el documento **en el mismo cambio** y registrar la decisión.
5. Toda decisión relevante va al *Registro de decisiones* con id `Dxxx`.
6. Los tests se escriben junto con la funcionalidad, nunca después.
7. Ejecutar los tests relevantes antes de cerrar cualquier tarea, y pegar el
   resultado real en la bitácora.
8. Actualizar este archivo al terminar cada sesión, incluso si la sesión no cerró
   nada.
9. **Una iteración no se marca COMPLETADA si queda un solo criterio de aceptación
   sin verificar.** Implementar no es completar.
10. Si aparece una necesidad nueva, primero se incorpora al roadmap y después se
    desarrolla.
11. Todo atajo consciente va a *Deuda técnica* con su id `DTxx`.
12. No sobrearquitecturar. Ante la duda entre dos diseños, gana el más simple que
    cumpla los criterios de aceptación.
13. Las ambigüedades **no se inventan**: se registran en *Decisiones pendientes*, y
    si bloquean la tarea, la tarea queda `BLOQUEADA` y se pregunta.
14. Código, nombres de variables y commits en **inglés**; documentación, UI y
    mensajes al usuario en **español** (**D019**).

---

## Iteraciones

### Iteración 0 — Arquitectura y documentación

#### Objetivo

Definir producto, alcance, arquitectura, modelo de datos, contratos y estrategia de
pruebas antes de escribir una línea de código, y dejar este roadmap como fuente de
verdad.

#### Alcance

Análisis y documentación. **Sin scaffolding, sin dependencias instaladas, sin
código de aplicación.**

#### Tareas

- [x] Inspeccionar el repositorio y detectar código existente
- [x] Analizar el prototipo previo (`../chatio`, ONIET) y decidir qué se reutiliza
- [x] Revisar la arquitectura propuesta y proponer mejoras concretas
- [x] Verificar las capacidades reales de Alexa contra lo que el producto asume
- [x] Definir el modelo conceptual de datos y resolver las 10 entidades propuestas
- [x] Diseñar los contratos de la API REST
- [x] Diseñar el modelo de interacción de la skill
- [x] Analizar Account Linking frente a un mecanismo propio de vinculación
- [x] Analizar la **Alexa Reminders API** contra documentación oficial vigente y diseñar la
      integración sin acoplar el dominio (**D021**–**D024**)
- [x] Definir el modelo de seguridad y privacidad
- [x] Definir la estrategia de testing
- [x] Definir la estructura del proyecto
- [x] Escribir `README.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`,
      `docs/API.md`, `docs/ALEXA_SKILL.md`, `docs/ALEXA_REMINDERS.md`,
      `docs/SECURITY.md`, `docs/TESTING.md`, `docs/FRONTEND.md`
- [x] Escribir `ROADMAP.md` con iteraciones, decisiones, riesgos y bitácora
- [x] Identificar y registrar las decisiones pendientes
- [x] Obtener respuesta a D003, D004, D009, D011 y D015
- [x] Incorporar el cambio de alcance de proactividad y propagarlo a toda la documentación
- [x] Revisar consistencia y referencias cruzadas entre los diez documentos
- [x] Cerrar la bitácora de la Iteración 0

#### Criterios de aceptación

- Los diez documentos existen y contienen decisiones concretas del proyecto, no
  texto genérico.
- Cada entidad propuesta en el brief tiene un veredicto explícito y justificado.
- La proactividad está resuelta con la Reminders API, con su limitación de plataforma
  documentada y su impacto en el producto explícito (**D021**).
- Cada afirmación sobre el comportamiento de Alexa está marcada como verificada contra
  documentación oficial o como pendiente de verificación empírica; ninguna se asume.
- Toda pregunta abierta está registrada como decisión pendiente, con recomendación,
  en lugar de resuelta por invención.
- No hay código de aplicación en el repositorio.

#### Tests requeridos

Ninguno (no hay código). Verificación: revisión manual de coherencia entre
documentos — los enums, nombres de campos, rutas y estados deben coincidir entre
`DATA_MODEL.md`, `API.md` y `ALEXA_SKILL.md`.

#### Dependencias

Ninguna.

#### Riesgos

Ninguno pendiente de planificación: todas las decisiones están cerradas y ninguna
iteración arranca con una dependencia abierta. El riesgo de producto se desplazó: ya no es
la ausencia de avisos (**R01**, resuelto por D021) sino que la Reminders API no se comporte
en `es-MX` como la documentación sugiere (**R15**), motivo por el cual la Iteración 16
empieza verificando la plataforma antes de construir sobre ella.

#### Decisiones tomadas

Las veinticuatro: D001 a D024. Las cinco que quedaban abiertas (D003, D004, D009, D011,
D015) fueron respondidas por el usuario el 2026-09-29. El alcance de la proactividad
—única decisión que seguía abierta— se resolvió con **D021**, que supersede a **D018** e
incorpora la Reminders API al MVP, junto con D022, D023 y D024. **No queda ninguna decisión
pendiente.**

#### Archivos/componentes afectados

`README.md` · `ROADMAP.md` · `docs/*.md`

#### Estado

**COMPLETADA** — los diez documentos existen con decisiones concretas, las cinco decisiones
bloqueantes están resueltas, el cambio de alcance de proactividad está incorporado y
propagado, y la consistencia entre documentos está verificada. No queda ningún criterio de
aceptación pendiente.

La Iteración 1 **no** comienza sin autorización explícita del usuario.

Fecha de inicio: 2026-09-29 · Fecha de finalización: 2026-09-29

---

### Iteración 1 — Base del backend

#### Objetivo

Un servidor Express que arranca, se conecta a MongoDB, valida su configuración,
loguea de forma estructurada y responde healthchecks, con tests corriendo.

#### Alcance

Esqueleto de infraestructura. **Sin modelos de dominio, sin endpoints de negocio.**

#### Tareas

- [x] `git init`, `.gitignore` (node, env, coverage, editor, SO)
- [x] `backend/package.json` con scripts `dev`, `start`, `test`, `test:coverage`, `lint`
- [x] Instalar dependencias mínimas (ver **D020**) con versiones fijadas (exactas, sin `^`)
- [x] `src/config/env.js`: carga y **valida** el entorno con Zod; falla el arranque
      si falta algo o un secreto es corto
- [x] `.env.example` con todas las variables, sin valores reales
- [x] `src/config/db.js`: conexión Mongoose con reintento, `sanitizeFilter`, y cierre
      ordenado
- [x] `src/config/logger.js`: pino con `redact` de la lista de `SECURITY.md` §8
- [x] `src/middleware/requestId.js` y `pino-http`
- [x] `src/middleware/error.js`: envoltorio único de error + clase `AppError` con
      `code` y `httpStatus`
- [x] `src/middleware/notFound.js`
- [x] `src/middleware/validate.js`: middleware genérico de Zod para
      `params`/`query`/`body`
- [x] `src/app.js`: helmet, cors con allowlist, `express.json({ limit: '32kb' })`,
      rate limit global, montaje de rutas
- [~] `cookie-parser` **movido a la Iteración 2**: sin autenticación no parsea nada útil,
      y agregarlo ahora sería una dependencia sin uso. Documentado en la bitácora
- [x] `src/server.js`: arranque, `SIGTERM`/`SIGINT` con cierre ordenado
      (+ `src/lifecycle.js`, extraído para poder testear el cierre)
- [x] `GET /health` y `GET /ready` — **sin versionar** (**D025**, corrige la
      contradicción que tenía este roadmap con su propio criterio de aceptación)
- [x] ESLint + Prettier con la configuración del proyecto
- [x] Infra de tests: Vitest + `mongodb-memory-server` + helper `createTestApp()`
- [x] GitHub Actions: backend (`npm ci`, lint, formato, `npm test`, `npm audit`)

#### Criterios de aceptación

- [x] La API levanta y se conecta a Mongo (verificado contra un Mongo en memoria; no hay
      `mongod` instalado en esta máquina).
- [x] Quitar una variable obligatoria **impide el arranque** con `exit 1` y un mensaje que
      nombra la variable y **no revela ningún valor**.
- [x] `GET /health` responde 200 incluso con Mongo caído; `GET /ready` responde 503 con
      Mongo caído y 200 con Mongo disponible.
- [x] Un error no manejado devuelve el envoltorio estándar con `requestId`, **sin stack** y
      sin el mensaje interno del error.
- [x] Una ruta inexistente devuelve 404 con el envoltorio estándar, sin reflejar la ruta.
- [x] Un body con propiedad desconocida devuelve 400 con un `details` por clave sobrante.
- [x] El logger no emite `Authorization`, cookies, tokens, contraseñas, códigos, datos de
      salud ni el query string (10 tests de redacción).
- [x] Lint, formato, 92 tests y `npm audit --audit-level=high` en verde localmente. La CI
      quedó definida y no se pudo ejecutar todavía: el repositorio no tiene remoto
      (no se hicieron operaciones remotas, por indicación del usuario).

#### Tests requeridos

Carga de configuración (defaults, override, falta de variable obligatoria, secreto
corto) · healthchecks · 404 · formato del envoltorio de error · redacción del logger
· CORS con origen permitido y con origen no permitido · rate limit global.

**Resultado: 92 tests en 8 archivos, todos en verde.** Cobertura 95,5 % de sentencias y
90,8 % de ramas (objetivo global del proyecto: 70 %).

| Archivo | Tests | Cubre |
| :--- | ---: | :--- |
| `config.env.test.js` | 22 | defaults, overrides, faltantes, reglas de producción, `secretSchema`, `loadEnvOrExit` |
| `db.test.js` | 8 | conexión real, `sanitizeFilter`, reintento con backoff, no loguear la URI, ping |
| `errors.test.js` | 12 | `AppError`, envoltorio, 500 sin filtrado, 404, JSON inválido, 413 |
| `health.test.js` | 7 | `/health` con y sin Mongo, `/ready` 200/503, sin datos internos |
| `lifecycle.test.js` | 9 | cierre ordenado, orden, idempotencia, fallos, timeout |
| `logger.test.js` | 14 | redacción completa y log de acceso sin body ni query |
| `middleware.test.js` | 10 | `requestId` (incluida inyección), `validate` en las 3 fuentes |
| `security.test.js` | 10 | cabeceras helmet, CORS permitido/denegado, rate limit |

#### Dependencias

Iteración 0 aprobada. Node 20 LTS y una instancia de MongoDB accesible.

#### Riesgos

`bcrypt` es un módulo nativo y puede fallar al compilar en Windows; si pasa, se usa
`bcryptjs` y se registra en la bitácora (la iteración 2 es la que lo necesita). **No se
materializó todavía**: `bcrypt` no se instaló en esta iteración.

Riesgo que sí apareció: el cierre ordenado **no se puede verificar en Windows**, porque el
sistema no entrega SIGTERM a un proceso hijo (lo termina forzosamente). Mitigado
extrayendo la lógica a `src/lifecycle.js` y testeándola como unidad; la entrega real de la
señal queda por verificar en Linux (**DT14**).

#### Decisiones tomadas

D016, D017, D019, D020 (aplicadas) · **D025**, **D026**, **D027** (nuevas).

#### Archivos/componentes afectados

`backend/**` (22 archivos) · `.gitignore` · `.env.example` · `.github/workflows/ci.yml` ·
`README.md` · `docs/API.md` · `docs/ARCHITECTURE.md` · `docs/SECURITY.md`

#### Estado

**COMPLETADA** · Inicio: 2026-09-29 · Fin: 2026-09-29

---

### Iteración 2 — Autenticación y autorización

#### Objetivo

Un cuidador puede iniciar y cerrar sesión; existen los middlewares de
autenticación y de autorización que usarán todas las iteraciones siguientes.

#### Alcance

Modelo `User`, modelo `AuthSession`, login, refresh con rotación y detección de
reutilización, logout, `/auth/me`, creación administrativa de usuarios, seed del primer
administrador, `requireAuth` y `requirePlatformAdmin`.

**`requireAdultAccess` y `requireRole` se movieron a la Iteración 3** (ver *Tareas*): no se
pueden implementar ni testear sin `Adult` y `CaregiverAccess`, y un middleware de
autorización que no consulta nada real no autoriza nada.

#### Tareas

- [x] Modelo `User` (`passwordHash` con `select: false`, `toJSON` que lo elimina,
      `toPublicJSON`)
- [x] **Modelo `AuthSession`** con el hash del token vigente, TTL e índices (**D028**,
      tarea nueva: sin ella la rotación no es verificable)
- [x] `authService`: hash bcrypt, verificación en tiempo constante, emisión y rotación
- [x] `POST /auth/login` con rate limit por IP + email y respuesta uniforme ante error
- [x] `POST /auth/refresh` con rotación, control de `tokenVersion` y **detección de
      reutilización**
- [x] `POST /auth/logout` idempotente
- [x] `GET /auth/me` (con `adults: []` hasta la 3)
- [x] `middleware/auth.js` → `requireAuth` (+ `requirePlatformAdmin`)
- [~] `middleware/authorize.js` → `requireAdultAccess`, `requireRole`
      → **MOVIDO A LA ITERACIÓN 3.** Qué falta: `Adult` y `CaregiverAccess`, que son las
      entidades contra las que el middleware consulta. Implementarlo ahora obligaría a
      inventar un modelo ficticio o a simular una autorización no verificable, y las dos
      cosas son peores que no tenerlo. El patrón que va a usar quedó documentado en
      `SECURITY.md` §4, y el principio —la identidad sale del token, nunca de la URL— ya
      está testeado sobre los endpoints que existen
- [x] `POST /admin/users` restringido a `isPlatformAdmin`
- [x] Script `npm run seed:admin` para crear el primer usuario, idempotente y con
      `--generate-password`
- [x] Cookie de refresh con `httpOnly; Secure; SameSite=Strict; Path`
- [x] `cookie-parser`, que venía diferido de la Iteración 1
- [x] Log de eventos de seguridad (`AUTH_LOGIN_SUCCESS`, `AUTH_LOGIN_FAILURE`,
      `AUTH_REFRESH`, `AUTH_REFRESH_REUSE`, `AUTH_LOGOUT`, `AUTH_ACCESS_DENIED`,
      `AUTH_USER_CREATED`), tarea nueva derivada de SECURITY.md §9
- [x] Análisis de CSRF con decisión registrada (**D030**)

#### Criterios de aceptación

- [x] Login correcto devuelve `accessToken` y setea la cookie de refresh, con
      `httpOnly`, `SameSite=Strict`, `Path=/api/v1/auth` y `Secure` en producción.
- [x] Credenciales incorrectas, email inexistente y usuario inactivo devuelven **la
      misma** respuesta, con el mismo código y el mismo mensaje.
- [x] El access token expira y `/auth/me` responde 401 después. Verificado con
      **expiración real** (TTL de 1 s), no simulada.
- [x] El refresh rota y **reusar el anterior devuelve 401 y borra la cookie**. Además la
      sesión entera queda revocada, así que el token nuevo tampoco sirve.
- [x] Incrementar `tokenVersion` invalida los refresh **y** los access tokens ya
      emitidos, de inmediato (**D029**).
- [x] El `passwordHash` no aparece en ninguna respuesta ni en los logs, ni siquiera
      pidiéndolo explícitamente.
- [x] Un usuario `INACTIVE` no puede iniciar sesión, y si se lo desactiva con sesión
      abierta su access token deja de servir en el request siguiente.
- [x] 6 intentos de login en 15 minutos → 429 con `Retry-After`; la cuota es por
      IP + email, así que agotar la de una cuenta no bloquea a otra.
- [x] El ciclo completo del criterio fundamental (§30 del pedido) está demostrado en un
      test dedicado, y también el replay de R1.

#### Tests requeridos

Todos los de `TESTING.md` §3.1 (`authService`) y §3.2 para `/auth/*`, más: la
cookie tiene los flags correctos; el token firmado con otro secreto se rechaza; un
token sin `tv` o con `tv` viejo se rechaza; un hash de bcrypt nunca se compara con
`===`.

**Resultado: 96 tests nuevos en 5 archivos; 188 en total, todos en verde.** Cobertura
94,6 % de sentencias y 86,8 % de ramas. El detalle por bloque está en `TESTING.md` §3.1.

| Archivo | Tests | Cubre |
| :--- | ---: | :--- |
| `auth.user.test.js` | 16 | modelo `User`, normalización de email, unicidad, bcrypt, no exposición del hash, política de contraseñas |
| `auth.login.test.js` | 22 | login, claims del token, cookie y sus flags, respuestas uniformes, validación, rate limit, eventos de seguridad |
| `auth.refresh.test.js` | 23 | rotación, cadena, **detección de reutilización**, concurrencia, y 11 formas de rechazo |
| `auth.session.test.js` | 32 | logout idempotente, `/me`, `requireAuth` (12 rechazos), logout global, `/admin/users` |
| `auth.cycle.test.js` | 3 | ciclo completo con expiración real, replay de R1, y ausencia de filtraciones |

#### Dependencias

Iteración 1.

#### Riesgos

Que el frontend termine guardando el access token en `localStorage` por comodidad,
anulando la decisión D001. Se previene documentándolo en `FRONTEND.md` y con un
test de la iteración 8.

Riesgo nuevo que apareció al implementar: **dos refresh concurrentes son indistinguibles
de un replay**, así que un frontend que dispare dos `/auth/refresh` a la vez cerrará la
sesión del usuario. No se resuelve en el backend —cualquier ventana de gracia debilitaría
la detección de replay— sino con un refresh de vuelo único en el cliente. Documentado como
requisito del frontend en `API.md` §3 y anotado como **DT17**.

Riesgo nuevo **R18**: `SameSite=Strict` es la protección CSRF (**D030**) y depende de que
el panel se sirva desde el mismo sitio que la API.

#### Decisiones tomadas

D001, D002 (aplicadas) · **D028**, **D029**, **D030** (nuevas).

#### Archivos/componentes afectados

`src/models/user.model.js` · `src/models/authSession.model.js` · `src/modules/auth/**`
(6 archivos) · `src/modules/admin/admin.routes.js` · `src/middleware/auth.js` ·
`src/middleware/rateLimit.js` · `src/lib/securityLog.js` · `src/lib/cookies.js` ·
`src/routes.js` · `src/app.js` · `src/config/env.js` · `scripts/seedAdmin.js` ·
`.env.example` · 5 archivos de tests + 1 helper

#### Estado

**COMPLETADA** · Inicio: 2026-09-29 · Fin: 2026-09-29

---

### Iteración 3 — Adultos y cuidadores

#### Objetivo

Un cuidador puede crear y administrar adultos, y compartir el acceso con otros
cuidadores con roles diferenciados.

#### Alcance

Modelos `Adult` y `CaregiverAccess`, su CRUD, el registro de consentimiento, y
`requireAdultAccess` funcionando de verdad.

#### Tareas

- [x] Modelo `Adult` (contactos embebidos, timezone IANA validada, soft delete)
- [x] Modelo `CaregiverAccess` (índice único `userId + adultId`)
- [x] `adultService` + `caregiverService`
- [x] `GET/POST /adults`, `GET/PATCH /adults/:adultId`, activate/deactivate
- [x] `GET/POST/PATCH/DELETE /adults/:adultId/caregivers`
- [x] Al crear un adulto, el creador queda `OWNER` en la misma operación
- [x] Invariante: **no se puede revocar ni degradar el último `OWNER`**
- [x] Registro de consentimiento en el alta (`SECURITY.md` §1)
- [x] Completar `GET /auth/me` con los adultos accesibles y el rol en cada uno
- [x] `ActivityEvent` de `ADULT_UPDATED`, `CAREGIVER_GRANTED`, `CAREGIVER_REVOKED`
      (el servicio de actividad mínimo se adelanta acá; la API del timeline es la 7)

#### Criterios de aceptación

- [x] Un cuidador solo ve los adultos a los que tiene acceso activo.
- [x] Un acceso revocado deja de funcionar **de inmediato**, sin esperar a que expire
  el token.
- [x] Un `CAREGIVER` no puede editar el adulto ni gestionar cuidadores (403).
- [x] Un `adultId` de otro cuidador devuelve **404**, no 403.
- [x] Revocar el último `OWNER` devuelve 422.
- [x] Una timezone inválida devuelve 400.
- [x] Cambiar la timezone del adulto queda registrado en el timeline.

#### Tests requeridos

`TESTING.md` §3.2, bloque completo de autorización, en todos los endpoints. Más: el
test estructural que recorre el router y falla si alguna ruta bajo
`/adults/:adultId` no tiene `requireAdultAccess`.

#### Dependencias

Iteración 2. Sin bloqueos: **D003** (N:N) y **D004** (`OWNER`/`CAREGIVER`) quedaron
confirmadas el 2026-09-29.

#### Riesgos

Que la matriz de permisos se disperse por los controladores en lugar de estar en un
solo lugar. Mitigación: `requireRole` declarativo en la definición de cada ruta.

#### Decisiones tomadas

D003, D004, D014, D031, D032, D033.

#### Archivos/componentes afectados

`src/models/adult.model.js` · `src/models/caregiverAccess.model.js` ·
`src/modules/adults/**` · `src/modules/caregivers/**` · `src/modules/activity/activity.service.js`

#### Estado

**COMPLETADA** · Inicio: 2026-10-02 · Fin: 2026-10-02

---

### Iteración 4 — Medicamentos

#### Objetivo

Un cuidador puede registrar, editar, pausar y dar de baja medicamentos con sus
horarios.

#### Alcance

Modelo `Medication` con `schedule` embebido y su CRUD. **Todavía no genera
ocurrencias** (eso es la 5).

#### Tareas

- [x] Modelo `Medication` con `schedule` embebido, enums de unidades, `graceMinutes`
- [ ] Validación Zod: horarios `HH:mm`, sin duplicados, 1–6; `daysOfWeek` 0–6;
      `endDate ≥ startDate`; `dose`/`quantity` > 0
- [x] `medicationService` con CRUD, pausa/reactivación y soft delete
- [x] `GET/POST /adults/:adultId/medications`
- [x] `GET/PATCH/DELETE /adults/:adultId/medications/:medicationId`
- [x] `POST .../activate` y `.../deactivate`
- [x] `ActivityEvent` de creación, edición, activación y desactivación
- [x] `lib/time.js`: utilidades de Luxon (hora local ↔ UTC, día local del adulto,
      validación de zona) **con sus tests**

#### Criterios de aceptación

- [x] Se puede crear el ejemplo del brief (Losartán 50 mg, 1 comprimido, 09:00, todos
  los días, después del desayuno) y la respuesta incluye `nextOccurrenceAt`.
- [x] Los horarios se guardan ordenados y sin duplicados.
- [x] Un horario `"25:00"` o `"9:00"` devuelve 400.
- [x] El soft delete conserva el documento y lo excluye de los listados.
- [x] `includeInactive=true` devuelve también los pausados.
- [x] Un `medicationId` de otro adulto devuelve 404.

#### Tests requeridos

`TESTING.md` §3.1 (`medicationService`) y §3.2 del recurso, más los tests de
`lib/time.js`: conversión con DST, zonas distintas, día local en el límite de la
medianoche.

#### Dependencias

Iteración 3.

#### Riesgos

Modelar mal las unidades y tener que migrar después. Mitigación: enums cerrados con
`OTRO` como escape, y `instructions` en texto libre para lo que no encaje.

#### Decisiones tomadas

D013 (implementación), decisión de fusionar `MedicationSchedule` en `Medication`, D034.

#### Archivos/componentes afectados

`src/models/medication.model.js` · `src/modules/medications/**` · `src/lib/time.js`

#### Estado

**COMPLETADA** · Inicio: 2026-10-02 · Fin: 2026-10-02

---

### Iteración 5 — Ocurrencias y confirmaciones

#### Objetivo

El sistema sabe qué tomas debían ocurrir, cuáles se confirmaron y cuáles no.
**Es la iteración más importante del backend.**

#### Alcance

Modelo `MedicationOccurrence`, materializador, sweeper, confirmación y omisión
desde el panel.

#### Tareas

- [x] Modelo `MedicationOccurrence` con `snapshot` y los 4 índices de
      `DATA_MODEL.md` §3.5
- [x] Índice **único** `{ medicationId, scheduledAt }`
- [x] `occurrenceService.materialize(medicationId, from, to)` idempotente con upsert
- [x] `occurrenceService.materializeAll(horizonHours)` para el job
- [x] `occurrenceService.sweep()` → `PENDING` vencidas a `MISSED` + eventos
- [x] `occurrenceService.confirm()` con transición condicional por estado
      (`findOneAndUpdate` sobre `status: 'PENDING'`), idempotente y con
      `confirmedOutOfWindow`
- [x] `occurrenceService.skip()`
- [x] `occurrenceService.findConfirmable(adultId, now)` con la ventana
      `[−60 min, +graceMinutes]`
- [x] Re-materialización al crear, editar, pausar o reactivar un medicamento, y al
      cambiar la timezone del adulto (solo `PENDING` futuras)
- [x] `jobs/materializeOccurrences.js` y `jobs/sweepOccurrences.js` con `node-cron`,
      invocables como funciones puras
- [x] `GET /adults/:adultId/medication-occurrences` con filtros y cursor
- [x] `POST .../:occurrenceId/confirm` y `.../skip`
- [x] `ActivityEvent` de confirmación, omisión y no confirmación

#### Criterios de aceptación

- [x] Un medicamento diario de 09:00 genera exactamente una ocurrencia por día en el
  horizonte, en el UTC correcto para la timezone del adulto.
- [x] Correr el materializador dos veces seguidas **no duplica** nada.
- [x] Un medicamento de lunes a viernes no genera ocurrencias el fin de semana.
- [x] El sweeper marca `MISSED` solo lo vencido por `graceMinutes` y nunca toca
  `TAKEN`/`SKIPPED`.
- [x] Confirmar dos veces no cambia `confirmedAt` ni duplica eventos.
- [x] Confirmar fuera de ventana marca `confirmedOutOfWindow: true`.
- [x] Editar la dosis **no** altera el `snapshot` de las ocurrencias pasadas.
- [x] El `source` y el `confirmedByUserId` los fija el servidor, no el body.
- [x] Dos confirmaciones concurrentes generan un solo `ActivityEvent`.

#### Tests requeridos

Todo el bloque `occurrenceService` de `TESTING.md` §3.1 (es la lista más larga del
proyecto, y es obligatoria completa), más los de API del recurso, con reloj
congelado.

#### Dependencias

Iteración 4.

#### Riesgos

Errores de zona horaria y de DST que produzcan tomas a la hora equivocada —
**riesgo de daño real al usuario final**. Mitigación: tests explícitos de DST en
`America/Argentina/Buenos_Aires` (sin DST actualmente) y en una zona con DST
(`America/Santiago` o `Europe/Madrid`) para no depender de una sola geografía.

#### Decisiones tomadas

D005, D006, D013, D035.

#### Archivos/componentes afectados

`src/models/medicationOccurrence.model.js` · `src/modules/occurrences/**` ·
`src/jobs/**`

#### Estado

**COMPLETADA** · Inicio: 2026-10-02 · Fin: 2026-10-02

---

### Iteración 6 — Recordatorios y agenda diaria

#### Objetivo

Existen recordatorios no farmacológicos y un endpoint único que devuelve el día
del adulto, que después consumirán el panel y Alexa.

#### Alcance

Modelo `Reminder` con su CRUD y `agendaService`.

#### Tareas

- [ ] Modelo `Reminder` (`ONE_OFF` / `RECURRING`, categorías, vigencia)
- [ ] Validación Zod con unión discriminada por `type`
- [ ] `reminderService` con CRUD, cálculo de ocurrencia del día y vigencia
- [ ] `GET/POST/PATCH/DELETE /adults/:adultId/reminders` + `deactivate`
- [ ] `agendaService.getToday(adultId, date?)` mezclando medicación y recordatorios
- [ ] `GET /adults/:adultId/today` con `items`, `summary` y `timezone`
- [ ] `ActivityEvent` de creación, edición y desactivación de recordatorios

#### Criterios de aceptación

- Un `ONE_OFF` sin `date` devuelve 400; un `RECURRING` sin `daysOfWeek`, 400.
- Un `RECURRING` con `daysOfWeek: [1,2,3,4,5]` no aparece el domingo.
- `/today` devuelve los ítems ordenados por hora local y con `kind` correcto.
- `/today` de un adulto en otra zona horaria devuelve **su** día, no el del
  servidor.
- `summary` cuenta bien total, tomados, pendientes y no confirmados.
- `/today?date=` acepta una fecha pasada y devuelve el histórico de ese día.
- La consulta se resuelve en **2 consultas indexadas** (verificado con `explain` en
  un test o, si no, revisado a mano y anotado en la bitácora).

#### Tests requeridos

`TESTING.md` §3.1 (`agendaService`, `reminderService`) y los de API del recurso.

#### Dependencias

Iteración 5.

#### Riesgos

Que la agenda se vuelva lenta al crecer el historial. Mitigación: la consulta va
siempre por `{ adultId, localDate }`, que está indexado y es de cardinalidad baja
por día.

#### Decisiones tomadas

D010.

#### Archivos/componentes afectados

`src/models/reminder.model.js` · `src/modules/reminders/**` ·
`src/modules/agenda/**`

#### Estado

PENDIENTE · Inicio: — · Fin: —

---

### Iteración 7 — Historial de actividad y solicitudes de ayuda

#### Objetivo

Existe un timeline consultable de todo lo relevante que pasó, y el modelo de
solicitudes de ayuda con su ciclo de vida.

#### Alcance

Modelo `ActivityEvent` (consolidando el servicio mínimo de la 3), modelo
`HelpRequest` y sus endpoints de lectura y transición. **El intent de voz y la
notificación son la 15.**

#### Tareas

- [ ] Modelo `ActivityEvent` con todos los tipos de `DATA_MODEL.md` §3.7
- [ ] `activityService.record()` como **único** punto de escritura de eventos
- [ ] Auditoría de que todas las escrituras de las iteraciones 3 a 6 emiten su
      evento (revisión y tests faltantes)
- [ ] `GET /adults/:adultId/activity` con cursor y filtro por tipo y fecha
- [ ] Modelo `HelpRequest` con dedupe, `attempts` y subdocumento `notification`
- [ ] `helpService` con `create`, `acknowledge`, `resolve` y la lógica de dedupe
- [ ] `GET /help-requests?status=OPEN` (todos los adultos accesibles)
- [ ] `GET /adults/:adultId/help-requests`
- [ ] `POST .../acknowledge` y `.../resolve`

#### Criterios de aceptación

- El timeline devuelve los eventos en orden descendente, paginados por cursor
  estable (sin repetir ni saltear al paginar).
- El `summary` de cada evento es legible sin resolver referencias.
- No existe ningún endpoint que permita editar o borrar eventos.
- `GET /help-requests` solo devuelve solicitudes de adultos accesibles.
- `acknowledge` sobre una ya atendida es idempotente (200).
- Dos pedidos de ayuda en 5 minutos producen **una** solicitud con `attempts: 2`.
- Cada transición queda registrada con el usuario que la hizo.

#### Tests requeridos

`TESTING.md` §3.1 (`activityService`, `helpService`) y los de API, incluido el test
de paginación con inserciones concurrentes.

#### Dependencias

Iteración 6.

#### Riesgos

Que el timeline crezca sin control. Mitigación: se mide en la validación; si hace
falta, TTL por antigüedad configurable — **no** en el MVP (borrar historial de
medicación es una decisión de producto, no técnica).

#### Decisiones tomadas

D007.

#### Archivos/componentes afectados

`src/models/activityEvent.model.js` · `src/models/helpRequest.model.js` ·
`src/modules/activity/**` · `src/modules/help/**`

#### Estado

PENDIENTE · Inicio: — · Fin: —

---

### Iteración 8 — Frontend base

#### Objetivo

Una SPA que autentica, mantiene la sesión y navega, con el cliente de API y el
sistema de diseño resueltos.

#### Alcance

Scaffolding de Vite, Tailwind, router, TanStack Query, cliente de API con refresh
automático, layout y pantalla de login. **Sin pantallas de datos.**

#### Tareas

- [ ] `frontend/` con Vite + React + Tailwind y las dependencias de **D020**
- [ ] Tokens de diseño en Tailwind (`FRONTEND.md` §3): tipografía grande, contraste
      alto, espaciado generoso
- [ ] `lib/apiClient.js`: `fetch` con `credentials: 'include'`, envoltorio de
      errores e interceptor de 401 → refresh → reintento **una sola vez**
- [ ] `AuthProvider`: access token **en memoria**, refresh al montar, logout
- [ ] `queryClient` con `staleTime`, reintentos y manejo global de errores
- [ ] Router con rutas públicas y privadas (`RequireAuth`)
- [ ] `AppLayout`: header, selector de adulto, navegación, badge de ayuda pendiente
- [ ] `AdultProvider`: adulto seleccionado, persistido en `localStorage` (solo el
      id, que no es sensible)
- [ ] Componentes base: `Button`, `Input`, `Select`, `Card`, `Badge`, `Modal`,
      `EmptyState`, `ErrorState`, `Spinner`, `TimeDisplay`
- [ ] Pantalla de Login
- [ ] `ErrorBoundary` global
- [ ] CI del frontend (`npm ci`, `test`, `build`)

#### Criterios de aceptación

- Login válido navega al dashboard; inválido muestra el error de forma accesible.
- El access token **no** está en `localStorage` ni en `sessionStorage`
  (verificado por test).
- Al expirar el access token, la siguiente request refresca y reintenta sin que el
  usuario note nada.
- Si el refresh falla, se redirige a login **sin bucle** de reintentos.
- Recargar la página mantiene la sesión (vía cookie de refresh).
- El layout es usable a 360 px de ancho y no tiene scroll horizontal.
- Navegación por teclado completa y foco visible en todos los controles.

#### Tests requeridos

`TESTING.md` §4: login, interceptor de 401, no persistencia del token, render del
layout, navegación protegida.

#### Dependencias

Iteración 2 (auth funcionando).

#### Riesgos

Sumar dependencias por comodidad y engordar el frontend. Mitigación: **D020** es
una lista cerrada; agregar una dependencia exige registrar una decisión.

#### Decisiones tomadas

D020.

#### Archivos/componentes afectados

`frontend/**`

#### Estado

PENDIENTE · Inicio: — · Fin: —

---

### Iteración 9 — Dashboard

#### Objetivo

El familiar entra y entiende en cinco segundos cómo está el adulto hoy.

#### Alcance

Pantalla de dashboard y selector de adulto (`FRONTEND.md` §4.2).

#### Tareas

- [ ] Selector de adulto funcional con datos de `/auth/me`
- [ ] Tarjeta de estado general del día (tomados / pendientes / no confirmados)
- [ ] Próxima medicación con hora local del adulto y acción de confirmar
- [ ] Próximos recordatorios del día
- [ ] Últimas actividades (5 ítems, con enlace al timeline completo)
- [ ] Solicitudes de ayuda pendientes, destacadas arriba, con acciones atender y
      resolver
- [ ] Polling de `/help-requests` cada 30 s con `refetchInterval`
- [ ] Estados de carga (skeleton), error con reintento y vacío con mensaje útil
- [ ] Invalidación de queries correcta al confirmar una toma

#### Criterios de aceptación

- El dashboard usa `/today`, `/activity` y `/help-requests`, sin componer datos a
  mano desde varios endpoints de bajo nivel.
- Todas las horas se muestran en la zona del adulto, con la zona visible si difiere
  de la del navegador.
- Confirmar una toma actualiza la UI sin recargar la página.
- Una solicitud de ayuda abierta es visible **sin scrollear**, en color de alerta y
  con texto (no solo color).
- Con datos vacíos no hay tablas mudas ni pantallas en blanco.

#### Tests requeridos

`TESTING.md` §4: estados de carga/error/vacío; confirmación que invalida queries;
formateo de hora con adulto en otra zona; atender una ayuda la saca del badge.

#### Dependencias

Iteraciones 6, 7 y 8.

#### Riesgos

Sobrecargar la pantalla. Mitigación: máximo 5 bloques, jerarquía visual explícita y
lo urgente siempre arriba.

#### Decisiones tomadas

—

#### Archivos/componentes afectados

`frontend/src/features/dashboard/**` · `features/help/**`

#### Estado

PENDIENTE · Inicio: — · Fin: —

---

### Iteración 10 — Pantallas de gestión

#### Objetivo

El familiar puede administrar todo desde el panel: adultos, medicación,
recordatorios, actividad y configuración.

#### Alcance

Cinco secciones con sus formularios (`FRONTEND.md` §4.3 a §4.7).

#### Tareas

- [ ] Adultos: listado, alta, edición, contactos, activar/desactivar
- [ ] Medicación: listado con estado, alta, edición, pausa, baja; editor de horarios
- [ ] Recordatorios: listado, alta, edición, baja, con formulario condicional por
      tipo
- [ ] Actividad: timeline agrupado por día, filtros por tipo y rango, scroll
      infinito por cursor
- [ ] Configuración: cuidadores (alta, cambio de rol, revocación), vinculación de
      Alexa (placeholder hasta la 12), datos básicos del adulto
- [ ] Formularios con `react-hook-form` + esquemas Zod **compartidos** con el
      backend donde sea posible
- [ ] Confirmación explícita antes de toda acción destructiva

#### Criterios de aceptación

- Se puede dar de alta el medicamento del ejemplo del brief de punta a punta y verlo
  en `/today`.
- Los errores de validación del backend se muestran en el campo correspondiente,
  usando `details`.
- El editor de horarios impide duplicados y formatos inválidos antes de enviar.
- El formulario de recordatorio cambia de campos según `ONE_OFF` / `RECURRING`.
- Un `CAREGIVER` no ve las acciones que no puede ejecutar (y el backend igual las
  rechaza: la UI no es el control de acceso).
- El timeline pagina sin repetir ni saltear ítems.
- Todos los formularios son operables solo con teclado y tienen `label` asociada.

#### Tests requeridos

`TESTING.md` §4 completo, con foco en los formularios de medicamento y
recordatorio, y en el mapeo de errores del backend a los campos.

#### Dependencias

Iteración 9.

#### Riesgos

Que el editor de horarios quede confuso y el familiar cargue mal la medicación —
que es la fuente de todos los errores posteriores. Mitigación: vista previa en
lenguaje natural ("Todos los días a las 09:00, desde el 29/9") antes de guardar.

#### Decisiones tomadas

—

#### Archivos/componentes afectados

`frontend/src/features/adults/**` · `medications/**` · `reminders/**` ·
`activity/**` · `settings/**`

#### Estado

PENDIENTE · Inicio: — · Fin: —

---

### Iteración 11 — Alexa Skill base

#### Objetivo

La skill responde en un Echo real: se abre, saluda, ayuda y cierra, con el endpoint
verificando firma.

#### Alcance

Endpoint, verificación, `LaunchRequest`, `Help`, `Stop`, `Cancel`,
`NavigateHome`, `Fallback`, `SessionEnded`, `ErrorHandler`, modelo de interacción
publicado en la consola de Alexa. **Sin acceso a datos del adulto todavía.**

#### Tareas

- [ ] Crear la skill en la consola de Alexa (es-MX, es-US, es-ES) y obtener el
      `skillId`
- [ ] Publicar el modelo de interacción de `ALEXA_SKILL.md` §2 con todos los intents
- [ ] `POST /alexa/skill` montado **antes** del parser JSON global, con body crudo
- [ ] Verificación de firma con `ask-sdk-express-adapter` + `applicationId`
- [ ] `src/alexa/skill.js` con el `SkillBuilder` y los handlers genéricos
- [ ] `src/alexa/copy.es.js` con todos los textos centralizados
- [ ] `ErrorHandler` global que nunca deja pasar un 5xx
- [ ] Request/Response interceptors para logging con `alexaUserIdHash` truncado
- [ ] Rate limit del endpoint por `alexaUserIdHash`, aplicado post-firma
- [ ] Timeout interno de 5 s en las llamadas a servicios
- [ ] **Prueba en un Echo físico** del invocation name y del audio

#### Criterios de aceptación

- "Alexa, abre chatio" obtiene respuesta en el simulador **y** en un Echo real.
- Firma inválida → 400 sin cuerpo informativo.
- `applicationId` ajeno → 400.
- Una excepción en un servicio produce voz amable y HTTP **200**, nunca 5xx.
- `ALEXA_VERIFY_SIGNATURE=false` con `NODE_ENV=production` impide el arranque.
- Dos `Fallback` seguidos cierran la sesión con cortesía.
- Ningún texto hablado está incrustado en un handler.
- p95 de latencia del endpoint < 1,5 s medido en el log.

#### Tests requeridos

`TESTING.md` §5.1 y §5.2, más los casos 10, 14, 15 y 18 de §5.3. El golden file del
modelo de interacción.

#### Dependencias

Iteración 1 (para el endpoint). Cuenta de desarrollador de Amazon y un Echo o la app
Alexa. **Necesita un endpoint HTTPS accesible**: durante el desarrollo, un túnel
(ngrok/cloudflared); el deploy definitivo es la 19.

#### Riesgos

**R05** (invocation name) y **R09** (cold start del túnel o del hosting). Si el
invocation name de una palabra falla en el Echo real, se cambia acá, no después.

#### Decisiones tomadas

D008, D018.

#### Archivos/componentes afectados

`src/alexa/**` · `src/app.js` · `alexa/interactionModel.es-MX.json`

#### Estado

PENDIENTE · Inicio: — · Fin: —

---

### Iteración 12 — Vinculación Alexa ↔ Chatio

#### Objetivo

Un Echo queda vinculado a un adulto concreto, de forma segura, revocable y
auditada.

#### Alcance

`AlexaLink`, `AlexaPairingCode`, `LinkDeviceIntent`, resolución del adulto en cada
request y la UI de vinculación.

#### Tareas

- [ ] Modelo `AlexaLink` (hashes, índice único parcial por `status: ACTIVE`)
- [ ] Modelo `AlexaPairingCode` con índice TTL sobre `expiresAt`
- [ ] `alexaLinkService`: generar código (solo hash), canjear, resolver, revocar
- [ ] `POST /adults/:adultId/alexa-link/codes` (solo `OWNER`, rate limit 5/hora)
- [ ] `GET /adults/:adultId/alexa-link` y `DELETE .../:linkId`
- [ ] `LinkDeviceIntent` con `AMAZON.FOUR_DIGIT_NUMBER`
- [ ] `RequestInterceptor` que resuelve el adulto en **cada** request de Alexa
- [ ] Detección de vínculo ambiguo y su respuesta
- [ ] Vinculación por dispositivo cuando hay más de un adulto en la misma cuenta
- [ ] Email al `OWNER` al crearse un vínculo nuevo
- [ ] `ActivityEvent`: `ALEXA_LINKED`, `ALEXA_UNLINKED`, `ALEXA_LINK_FAILED`
- [ ] UI de Configuración → Alexa: generar código, ver estado, revocar

Nota de alcance: el pedido del **permiso de recordatorios** dentro de la sesión de
vinculación (`ALEXA_SKILL.md` §7, paso 5) se implementa en la **Iteración 16**, no acá. En
esta iteración la vinculación termina con el mensaje corto ("Listo, ya estoy vinculado").

#### Criterios de aceptación

- El código en claro se muestra una vez, no se persiste y no aparece en logs.
- Un código vencido, usado o inexistente produce **la misma** respuesta.
- 6 intentos en una hora desde el mismo usuario de Alexa → rechazo.
- Tras vincular, `LaunchRequest` ya saluda con la agenda del adulto.
- Revocar el vínculo hace que Alexa vuelva al guion de vinculación de inmediato.
- Dos adultos en la misma cuenta de Amazon exigen vinculación por dispositivo, y sin
  ella el resultado es el mensaje de ambigüedad, **nunca** un adulto elegido al
  azar.
- El `adultId` de los `sessionAttributes` **no** se usa como fuente de autoridad
  (test del caso 16).

#### Tests requeridos

`TESTING.md` §5.3 casos 6, 8, 11 y **16**; `alexaLinkService` completo; el TTL de
Mongo verificado; la UI de vinculación.

#### Dependencias

Iteración 11. Sin bloqueos: **D009** quedó confirmada el 2026-09-29 (código de 4
dígitos, sin Account Linking, tampoco como paso previo a una publicación pública).

#### Riesgos

**R07** (4 dígitos) y **R02** (dos adultos, un Echo). Ambos aceptados y mitigados.

#### Decisiones tomadas

D009, D012.

#### Archivos/componentes afectados

`src/models/alexaLink.model.js` · `src/models/alexaPairingCode.model.js` ·
`src/modules/alexaLink/**` · `src/alexa/handlers/linkDevice.js` ·
`frontend/src/features/settings/**`

#### Estado

PENDIENTE · Inicio: — · Fin: —

---

### Iteración 13 — Medicación mediante Alexa

#### Objetivo

El adulto puede preguntar qué medicamento le toca y confirmar que lo tomó, y el
familiar lo ve en el panel.

#### Alcance

`GetMedicationIntent`, `ConfirmMedicationIntent`, `AMAZON.YesIntent`,
`AMAZON.NoIntent`, matcheo de nombres y resolución de ambigüedad.

#### Tareas

- [ ] `GetMedicationIntent` con las 7 situaciones de `ALEXA_SKILL.md` §4
- [ ] `ConfirmMedicationIntent` con la cadena de resolución de 6 pasos
- [ ] `AMAZON.YesIntent` / `NoIntent` ligados a `awaitingConfirmationOccurrenceId`
- [ ] `lib/matchMedicationName.js`: normalización + prefijo + Levenshtein con umbral
- [ ] Catálogo semilla del slot `MedicationName` en el modelo de interacción
- [ ] Verbalización de dosis y horas en lenguaje natural ("cincuenta miligramos",
      "a las nueve")
- [ ] `ActivityEvent`: `MEDICATION_QUERIED`, `MEDICATION_CONFIRMED`
- [ ] **Prueba en un Echo real** con nombres de medicamentos dichos en voz alta

#### Criterios de aceptación

- Los 13 casos borde de `TESTING.md` §5.3 relacionados con medicación pasan.
- Confirmar dos veces no duplica ni cambia `confirmedAt`.
- Con dos pendientes, la skill nombra las dos y no elige.
- Un nombre que no matchea no se inventa: se ofrece lo que toca ahora.
- La confirmación por voz aparece en el timeline del panel con `source: ALEXA`.
- La skill **no puede** crear, editar ni omitir medicamentos (verificado: no hay
  handler que lo permita).
- Ningún intent tarda más de 5 s ni devuelve 5xx.

#### Tests requeridos

`TESTING.md` §5.1, §5.2 y §5.3 casos 1, 2, 3, 4, 7, 12, 13, 16 y 17.

#### Dependencias

Iteraciones 5 y 12.

#### Riesgos

**R06** (ASR de nombres de fármacos). Mitigación ya en el diseño: el camino
principal no depende del nombre. Si en el Echo real el matcheo falla seguido, se
retira el slot y se deja solo el flujo por contexto — decisión a registrar.

#### Decisiones tomadas

—

#### Archivos/componentes afectados

`src/alexa/handlers/getMedication.js` · `confirmMedication.js` · `yesNo.js` ·
`src/lib/matchMedicationName.js`

#### Estado

PENDIENTE · Inicio: — · Fin: —

---

### Iteración 14 — Agenda mediante Alexa

#### Objetivo

El adulto puede preguntar qué tiene que hacer hoy y recibir una respuesta breve y
clara.

#### Alcance

`GetTodayScheduleIntent` y el resumen del `LaunchRequest`, sobre `agendaService`.

#### Tareas

- [ ] `GetTodayScheduleIntent` consumiendo `agendaService.getToday()`
- [ ] Verbalización: máximo 3 ítems, prioriza lo que viene, menciona lo vencido
- [ ] Resumen del `LaunchRequest` con la misma lógica (una sola implementación)
- [ ] Manejo de agenda vacía
- [ ] `ActivityEvent`: `SCHEDULE_QUERIED`
- [ ] Prueba en un Echo real de la longitud y el ritmo de la respuesta

#### Criterios de aceptación

- Responde el ejemplo del brief: *"Hoy tenés que tomar Losartán a las nueve y tenés
  turno con el cardiólogo a las diez y media."*
- Con más de 3 ítems resume y ofrece el detalle en lugar de recitar.
- La hora se dice en lenguaje natural, nunca "cero nueve cero cero".
- El día es el del adulto, no el del servidor (test con otra timezone).
- La respuesta no supera ~20 segundos de audio.

#### Tests requeridos

`TESTING.md` §5.1 y §5.3 caso 17, más un test de longitud máxima del texto de
respuesta.

#### Dependencias

Iteraciones 6 y 12.

#### Riesgos

Respuestas largas que el adulto no retiene. Mitigación: límite duro de 3 ítems y
verificación con usuarios reales en la 20.

#### Decisiones tomadas

—

#### Archivos/componentes afectados

`src/alexa/handlers/getTodaySchedule.js` · `launch.js` · `src/alexa/speech.js`

#### Estado

PENDIENTE · Inicio: — · Fin: —

---

### Iteración 15 — Solicitud de ayuda y notificaciones

#### Objetivo

El adulto dice "necesito ayuda", el familiar recibe un aviso y lo atiende desde el
panel.

#### Alcance

`RequestHelpIntent`, servicio de notificaciones por email, reintentos y el circuito
completo hasta el panel.

#### Tareas

- [ ] `notifier` con interfaz `send({ to, template, data })` y un solo proveedor
- [ ] Plantilla de email de solicitud de ayuda (texto plano + HTML simple, sin datos
      de salud más allá de lo necesario)
- [ ] Plantilla de escalamiento al cruzar el umbral de intentos
- [ ] Plantilla de aviso de vínculo nuevo de Alexa (de la 12, si quedó pendiente)
- [ ] `RequestHelpIntent`: crea o deduplica, responde de inmediato y notifica
      **sin bloquear**
- [ ] Reintento de notificaciones `FAILED` desde el sweeper
- [ ] Respuesta honesta si falla el registro ("no pude avisarle a tu familia")
- [ ] Disclaimer de no-emergencia en la respuesta hablada
- [ ] UI: atender y resolver con nota; badge global
- [ ] `ActivityEvent`: `HELP_REQUESTED`, `HELP_ACKNOWLEDGED`, `HELP_RESOLVED`

#### Criterios de aceptación

- Pedir ayuda genera una `HelpRequest` y envía **un** email a todos los cuidadores
  activos.
- Tres pedidos en 15 minutos → una solicitud con `attempts: 3`, un email inicial y
  uno de escalamiento.
- El email no bloquea la respuesta de voz (test con proveedor lento).
- Si el proveedor falla, la solicitud queda creada con `notification.status: FAILED`
  y se reintenta.
- Si falla la escritura en base, la skill **no** dice que avisó.
- La respuesta hablada menciona el 911.
- El panel muestra la solicitud en menos de 30 s (polling) y permite atenderla.

#### Tests requeridos

`TESTING.md` §3.1 (`helpService`), §5.3 caso 5, la UI de atención, y un test de que
el notifier está stubbeado (nada de red en la suite).

#### Dependencias

Iteraciones 7 y 12. Sin bloqueos: **D011** quedó confirmada el 2026-09-29 (email +
aviso en el panel). La elección del proveedor de email es un detalle de
implementación de esta iteración; el requisito es dominio propio con SPF/DKIM.

#### Riesgos

Que el email caiga en spam y el familiar no se entere — **riesgo de seguridad del
usuario final**. Mitigación: dominio verificado con SPF/DKIM en el proveedor, asunto
claro, y en la validación con usuarios se prueba la entrega real. Queda en el
backlog el canal push/WhatsApp, que es el que realmente interrumpe.

#### Decisiones tomadas

D011.

#### Archivos/componentes afectados

`src/lib/notifier/**` · `src/modules/help/**` ·
`src/alexa/handlers/requestHelp.js` · `frontend/src/features/help/**`

#### Estado

PENDIENTE · Inicio: — · Fin: —

---

### Iteración 16 — Recordatorios proactivos (Alexa Reminders API)

#### Objetivo

Que el adulto **reciba un aviso a la hora de la toma sin tener que acordarse de consultar
a Chatio**, y que ese aviso nunca se confunda con una toma confirmada.

#### Alcance

Permiso de recordatorios (consentimiento por voz y fallback por tarjeta), colección
`AlexaReminderSync`, cálculo del estado deseado, reconciliación en sesión, manejo de
revocación y fallos, estado visible en el panel, y verificación empírica de la API en
`es-MX`.

Fuera de alcance, explícitamente: token de usuario fuera de sesión
(`Alexa.Authorization.Grant` + refresh de credenciales de terceros), porque **no habilita
la creación** de reminders y solo mejoraría la latencia del borrado (**D024**, backlog).

#### Tareas

**Verificación previa — antes de escribir código de integración**

- [ ] Verificar en un **Echo real en `es-MX`** que la Reminders API crea un aviso, suena a
      la hora correcta y se entiende el texto en español (**R15**)
- [ ] Verificar si el consentimiento por voz (`Connections.StartConnection`) está
      disponible en `es-MX`; si no, documentar el fallback por tarjeta
- [ ] Documentar cómo verbaliza Alexa en español un aviso creado por una skill
- [ ] Verificar si los eventos de skill (`Reminders.ReminderStarted`,
      `AlexaSkillEvent.SkillPermissionChanged`) llegan a un **endpoint HTTPS propio** o
      exigen Lambda
- [ ] Registrar los resultados de las cuatro verificaciones en la bitácora. **Si la API no
      funciona en `es-MX`, detenerse y reportar antes de seguir**

**Permiso y consentimiento**

- [ ] Declarar `alexa::alerts:reminders:skill:readwrite` en el manifiesto de la skill
- [ ] Directiva `Connections.StartConnection` hacia
      `connection://AMAZON.AskForPermissionsConsent/2`
- [ ] Handler de `SessionResumedRequest` para `ACCEPTED` / `DENIED` / `NOT_ANSWERED`
- [ ] `reminderPermission` en `AlexaLink` con sus estados y transiciones
- [ ] No volver a pedir el permiso por voz tras un `DENIED`; reintentar como máximo una vez
      por semana tras un `NOT_ANSWERED`
- [ ] Fallback documentado: tarjeta `AskForPermissionsConsent` completada por el cuidador

**Modelo y estado deseado**

- [ ] Modelo `AlexaReminderSync` con el índice único `{ adultId, slotKey }`
- [ ] `reminderSyncService.recalculate(adultId)`: agrupa horarios en franjas, calcula
      `desiredHash` y marca `PENDING_*`. **No llama a Alexa**
- [ ] Generador de texto genérico, **sin nombre de medicamento ni dosis** (**D023**)
- [ ] Mapeo a RRULE (`FREQ=DAILY` / `FREQ=WEEKLY;BYDAY=...`) con `BYHOUR`/`BYMINUTE`
- [ ] Enganchar el recálculo a toda escritura de medicamentos, al cambio de timezone del
      adulto y a la desactivación del adulto

**Cliente y reconciliación**

- [ ] `alexaRemindersClient`: `POST`, `PUT`, `DELETE`, `GET` uno, `GET` lista, usando el
      `apiEndpoint` del request (no hardcodear la región)
- [ ] Mapeo completo de errores de Alexa a acciones (`ALEXA_REMINDERS.md` §3)
- [ ] `ReminderSyncInterceptor`: reconciliación en sesión con presupuesto de 2 s y máximo 6
      operaciones, **sin bloquear la respuesta hablada**
- [ ] Detección de deriva vía `GET /v1/alerts/reminders`: reminders borrados por el usuario
      y huérfanos
- [ ] Backoff por `attempts`; `FAILED` a los 5 fallos consecutivos
- [ ] Reconciliación inmediata en la sesión de vinculación, con respuesta que menciona los
      horarios
- [ ] Detección reactiva de revocación (`401 UNAUTHORIZED`) → `permissionStatus: REVOKED`
- [ ] `ActivityEvent` para programación, actualización, baja, fallo y cambios de permiso
- [ ] `ALEXA_REMINDER_FIRED` **solo si** se verificó que el evento llega al endpoint

**API y panel**

- [ ] `GET /adults/:adultId/alexa-reminders` con el estado por franja
- [ ] `POST /adults/:adultId/alexa-reminders/resync` (rol `OWNER`, rate limit 5/hora)
- [ ] `reminderPermission` en la respuesta de `GET /adults/:adultId/alexa-link`
- [ ] `remindersPendingSync` en las respuestas de escritura de medicamentos
- [ ] Bloque de avisos en Configuración → Alexa, con los tres estados y su copy
      (`FRONTEND.md` §4.7)
- [ ] Copy que **nunca** presenta un aviso pendiente como activo

#### Criterios de aceptación

- En un Echo real, configurar un medicamento y —tras una sesión del adulto— **el aviso
  suena a la hora correcta** en `es-MX`.
- El consentimiento por voz otorga el permiso diciendo solo "sí"; `DENIED` deja el sistema
  en modo pull sin errores visibles para el adulto.
- Dos medicamentos a las 09:00 producen **un** aviso, no dos.
- Agregar un tercer medicamento a las 09:00 **no genera ninguna llamada a Alexa**.
- Cambiar la hora de una franja actualiza el aviso conservando el `alertToken`.
- Pausar el último medicamento de una franja borra el aviso.
- El texto del aviso **no contiene** el nombre del medicamento ni la dosis.
- Reconciliar dos veces seguidas no produce cambios en la segunda (idempotencia).
- Con la Reminders API caída, la respuesta hablada al adulto es **idéntica** a la normal.
- Revocar el permiso desde la app Alexa se detecta y se muestra en el panel.
- Borrar el aviso desde la app Alexa hace que la reconciliación lo vuelva a crear.
- **Un aviso emitido no cambia el estado de ninguna `MedicationOccurrence`**: si nadie
  confirma, la ocurrencia queda `PENDING` y luego `MISSED`.
- El panel muestra "pendiente de activación" cuando corresponde, y nunca dice que un aviso
  está activo si no lo está.
- El `apiAccessToken` no aparece en logs ni en la base.

#### Tests requeridos

`TESTING.md` §3.1 bloque `reminderSyncService` completo (incluido el test del invariante
ocurrencia/aviso), §5.4 completo, y los casos borde de permisos y fallos de
`ALEXA_SKILL.md` §10. Más la verificación manual en Echo real documentada en la bitácora,
que ningún test reemplaza.

#### Dependencias

Iteraciones 4, 5, 12 y 13. Requiere un Echo real y una cuenta de desarrollador con la skill
ya publicada en modo desarrollo. El manifiesto con `events.subscriptions` requiere **ASK
CLI** (la consola no lo permite).

#### Riesgos

**R15** (que la API no funcione como se espera en `es-MX` — se verifica antes de construir,
justamente para no descubrirlo al final), **R14** (latencia de propagación por la
restricción de creación en sesión), **R16** (el familiar confía en el aviso como si
garantizara la toma). El riesgo de dependencia de plataforma se acota manteniendo todo el
acoplamiento en una sola colección y un solo servicio.

#### Decisiones tomadas

D021 (supersede D018), D022, D023, D024.

#### Archivos/componentes afectados

`src/models/alexaReminderSync.model.js` · `src/modules/reminderSync/**` ·
`src/lib/alexaRemindersClient.js` · `src/alexa/interceptors/reminderSync.js` ·
`src/alexa/handlers/sessionResumed.js` · `src/modules/medications/*.service.js` (hook de
recálculo) · `alexa/skill.json` (permiso y eventos) ·
`frontend/src/features/settings/**`

#### Estado

PENDIENTE · Inicio: — · Fin: —

---

### Iteración 17 — Seguridad y hardening

#### Objetivo

Verificar y cerrar el modelo de seguridad sobre el sistema completo.

#### Alcance

El checklist de `SECURITY.md` §13, de punta a punta.

#### Tareas

- [ ] Recorrer el checklist completo de `SECURITY.md` §13
- [ ] Test estructural de rutas protegidas (falla si aparece una sin autorizar)
- [ ] Auditoría manual: ningún `Model.create(req.body)` ni `Object.assign` con body
- [ ] Verificar `.strict()` en todos los schemas de body
- [ ] Verificar y testear todos los rate limits
- [ ] Test de redacción de logs buscando patrones sensibles en la salida
- [ ] `npm audit` en backend y frontend; resolver altas y críticas
- [ ] Verificar helmet, CSP, HSTS y CORS **sobre el deploy real**
- [ ] Rotar todos los secretos desde los valores de desarrollo
- [ ] Usuario de Mongo con mínimo privilegio + IP allowlist
- [ ] Backups diarios cifrados fuera del VPS y **una restauración probada**
- [ ] Publicar privacy policy y terms (requisito de certificación)
- [ ] Verificar el registro de consentimiento en el alta de adultos

#### Criterios de aceptación

Todos los ítems del checklist marcados, con evidencia en la bitácora (salida de
tests, capturas de configuración). Un ítem sin evidencia **no** cuenta.

#### Tests requeridos

Toda la suite de autorización, el test estructural de rutas, el de redacción de
logs y los de rate limit.

#### Dependencias

Iteraciones 1 a 16.

#### Riesgos

Descubrir acá un problema estructural de autorización. Se mitiga desde la 2
haciendo obligatorios los tests de autorización por endpoint: esta iteración debería
confirmar, no descubrir.

#### Decisiones tomadas

—

#### Archivos/componentes afectados

Transversal.

#### Estado

PENDIENTE · Inicio: — · Fin: —

---

### Iteración 18 — Testing integral

#### Objetivo

Cobertura completa de los flujos del MVP y de los casos borde, con la suite en
verde y sin tests frágiles.

#### Alcance

Cerrar huecos de cobertura, los 18 casos borde de Alexa y la revisión de calidad de
los tests existentes.

#### Tareas

- [ ] Ejecutar cobertura y listar los huecos por servicio
- [ ] Completar los tests faltantes de servicios hasta ≥ 85 %
- [ ] Verificar que los 18 casos borde de `TESTING.md` §5.3 existen y pasan
- [ ] Revisar tests frágiles: dependencias de reloj real, de orden, de red
- [ ] Recorrido manual de los flujos completos (panel + Echo real) con checklist
- [ ] Documentar los resultados de las pruebas manuales en la bitácora
- [ ] Verificar el golden file del modelo de interacción

#### Criterios de aceptación

- Cobertura ≥ 85 % en servicios y ≥ 70 % global.
- Los 18 casos borde presentes, con nombre propio y pasando.
- La suite completa corre en menos de 2 minutos.
- Correr la suite 3 veces seguidas da el mismo resultado (sin flakes).
- Ningún test toca la red ni depende de la hora real.

#### Tests requeridos

Todos.

#### Dependencias

Iteración 17.

#### Riesgos

Perseguir el número de cobertura en lugar de la calidad. Mitigación: la revisión
exige que cada servicio tenga tests de **reglas de negocio**, no solo de camino
felizmente feliz.

#### Decisiones tomadas

—

#### Archivos/componentes afectados

`backend/tests/**` · `frontend/tests/**`

#### Estado

PENDIENTE · Inicio: — · Fin: —

---

### Iteración 19 — Deploy MVP

#### Objetivo

Chatio corriendo en producción sobre un VPS propio, con la skill apuntando al
endpoint real.

#### Alcance

Provisión y hardening del VPS, despliegue de API, frontend y MongoDB, TLS,
configuración de la skill, backups y monitoreo mínimo.

Nota de alcance: **D015** eligió VPS propio, así que esta iteración incluye trabajo de
administración de sistemas que una PaaS habría resuelto (TLS, firewall, updates,
backups). No es trabajo opcional y no se puede diferir: sin TLS válido la skill no
funciona, y sin backups fuera del servidor un fallo del VPS destruye el historial de
medicación. Ver **R12** y **DT10**.

#### Tareas

**Servidor y hardening**

- [ ] Provisionar el VPS (Ubuntu LTS), con dominio y registros DNS apuntando a él
- [ ] Usuario sin privilegios + `sudo`; **deshabilitar login SSH por contraseña y
      acceso directo de root** (solo clave pública)
- [ ] Firewall (`ufw`): abrir únicamente 22, 80 y 443
- [ ] `fail2ban` para SSH
- [ ] Actualizaciones de seguridad automáticas (`unattended-upgrades`)
- [ ] Verificar sincronización horaria por NTP (los horarios de medicación dependen
      de ella)
- [ ] Swap configurado (para no morir por OOM en un VPS chico)

**MongoDB**

- [ ] Instalar MongoDB 7, **escuchando solo en localhost** (jamás expuesto a internet)
- [ ] Habilitar autenticación; usuario de aplicación con `readWrite` solo sobre la
      base de Chatio
- [ ] `mongodump` diario por cron, **cifrado y copiado fuera del VPS** (almacenamiento
      remoto), con retención de 7 días
- [ ] **Probar una restauración completa** desde el backup en un entorno limpio

**Aplicación**

- [ ] Nginx como reverse proxy: TLS, HSTS, y `proxy_pass` a la API en localhost
- [ ] Certificado Let's Encrypt con **renovación automática verificada** (simular la
      renovación, no confiar en que ande)
- [ ] Verificar el certificado contra los requisitos de Alexa (CA pública, cadena
      completa)
- [ ] Servir el build del frontend como estático desde el mismo Nginx, con
      `VITE_API_URL` apuntando al dominio de la API
- [ ] API bajo un gestor de procesos (`systemd` o PM2) con reinicio automático y
      arranque al bootear
- [ ] Variables de entorno de producción con permisos restringidos (`600`, dueño del
      servicio), fuera del repositorio
- [ ] Rotación de logs (`logrotate`) con retención acotada
- [ ] Script de deploy reproducible (pull, `npm ci`, build, migración si hiciera falta,
      reinicio) documentado en el README

**Skill y verificación**

- [ ] Apuntar el endpoint de la skill al dominio real y activar
      `ALEXA_VERIFY_SIGNATURE=true`
- [ ] Publicar privacy policy y terms
- [ ] Preparar la skill para **beta test** con testers por invitación
- [ ] Notas de testing para el revisor (cuenta de prueba + código de vinculación)
- [ ] Smoke test en producción: login, alta de medicamento, agenda por voz,
      confirmación por voz, pedido de ayuda, email recibido
- [ ] Verificar que los jobs corren en producción (log de materialización y sweep)
- [ ] Monitoreo mínimo: chequeo externo del healthcheck con alerta, y alerta de disco
      al 80 %

#### Criterios de aceptación

- El smoke test completo pasa contra producción, con un Echo real.
- La primera interacción del día responde en menos de 8 s (la API es un proceso
  siempre vivo: no hay cold start que medir, pero se verifica igual).
- `curl` a la API por HTTP redirige a HTTPS; el certificado es válido y la cadena
  está completa.
- La renovación del certificado se probó (dry run exitoso), no solo se configuró.
- MongoDB **no** es accesible desde fuera del VPS (verificado con un escaneo desde
  otra máquina).
- SSH rechaza contraseñas y rechaza root.
- Existe un backup fuera del VPS y **se restauró con éxito** en un entorno limpio.
- El materializador generó ocurrencias para las próximas 48 h.
- El sweeper marcó correctamente una toma no confirmada.
- El email de ayuda llega a la bandeja de entrada, no a spam.
- Los logs de producción no contienen datos sensibles (revisión manual).
- La API se reinicia sola si se la mata, y arranca sola si se reinicia el VPS
  (ambas cosas probadas).

#### Tests requeridos

Smoke test manual documentado, con checklist y resultado en la bitácora. Más las
verificaciones de infraestructura de arriba, cada una con su evidencia (salida de
comando) pegada en la bitácora.

#### Dependencias

Iteraciones 17 y 18. Sin bloqueos: **D015** quedó decidida el 2026-09-29 (VPS propio).
Hace falta el VPS contratado y un dominio con acceso a su DNS.

#### Riesgos

**R12** (carga operativa del VPS: TLS, updates, backups a cargo nuestro) y **R08**
(rechazo en certificación). **R09** (cold start) queda mitigado por construcción: la
API es un proceso siempre vivo. El beta test evita la revisión pública completa
mientras se itera.

#### Decisiones tomadas

D015.

#### Archivos/componentes afectados

Configuración del VPS (Nginx, systemd, ufw, cron) · `.env` de producción ·
script de deploy · consola de Alexa

#### Estado

PENDIENTE · Inicio: — · Fin: —

---

### Iteración 20 — Validación con usuarios

#### Objetivo

Verificar con adultos mayores y familiares reales si Chatio sirve, y decidir qué
sigue con datos en la mano.

#### Alcance

Prueba de campo con 3 a 5 adultos y sus familiares durante al menos 2 semanas.

#### Tareas

- [ ] Reclutar 3 a 5 adultos con su familiar, con consentimiento informado por
      escrito
- [ ] Definir métricas: interacciones por día, tasa de confirmación por voz, tomas
      no confirmadas, pedidos de ayuda, fallos de reconocimiento, abandono
- [ ] Métricas específicas de los avisos proactivos: avisos programados, sesiones que
      empiezan dentro de los 15 minutos de un aviso (proxy de "el aviso funcionó"), y tasa
      de confirmación con aviso frente a sin aviso
- [ ] Guion de onboarding asistido (el familiar configura, alguien acompaña la
      primera sesión de voz)
- [ ] **Explicitar a cada familia** que Chatio avisa pero no vigila: un aviso programado
      no garantiza que el adulto lo haya escuchado, una confirmación es una declaración y no
      una verificación, y el pedido de ayuda por email **no es un sistema de emergencias**
      (riesgos R03, R11 y R16)
- [ ] Instrumentar las métricas en el panel o vía consultas a Mongo
- [ ] Entrevistas a la semana 1 y a la semana 2, con el adulto y con el familiar
- [ ] Registrar los fallos de ASR observados, con la frase exacta
- [ ] Informe de resultados y decisión sobre las prioridades siguientes

#### Criterios de aceptación

- Al menos 3 adultos usaron la skill durante 2 semanas.
- Métricas recogidas y analizadas.
- Cada familia entendió los límites del producto (verificado en la entrevista, no
  asumido).
- Informe escrito con hallazgos, y el backlog reordenado en consecuencia.
- Los bugs encontrados están cargados como tareas, no solo mencionados.

#### Tests requeridos

No aplica. Verificación empírica con usuarios.

#### Dependencias

Iteración 19.

#### Riesgos

Que el familiar sobreestime lo que Chatio garantiza (**R16**): que interprete el aviso
como supervisión y la confirmación como verificación de la toma. Es lo más importante a
medir en las entrevistas, junto con si los avisos efectivamente llegan y sirven.

#### Decisiones tomadas

—

#### Archivos/componentes afectados

Documentación y backlog.

#### Estado

PENDIENTE · Inicio: — · Fin: —

---

## Registro de decisiones

### D001 — Estrategia de autenticación

**Fecha:** 2026-09-29 · **Estado:** TOMADA
**Decisión:** JWT de acceso de 15 minutos (en memoria en el cliente) + refresh token
rotativo de 7 días en cookie `httpOnly; Secure; SameSite=Strict`, con versionado por
usuario para revocación masiva.
**Motivo:** hay datos de salud de por medio. Un token largo en `localStorage` es una
sesión completa entregada con un solo XSS, sin posibilidad de revocarla.
**Alternativas:** JWT único de 8 h en `localStorage` (más simple, peor); sesiones en
servidor con store (obliga a estado compartido, innecesario acá).
**Consecuencias:** hace falta un interceptor de refresh en el frontend y CORS con
`credentials`. La cookie acotada por `Path` limita la superficie de CSRF.

### D002 — Sin registro público de usuarios

**Fecha:** 2026-09-29 · **Estado:** TOMADA
**Decisión:** los usuarios los crea un `isPlatformAdmin`; los cuidadores adicionales
se agregan por email desde el panel por un `OWNER`.
**Motivo:** el producto no se autogestiona todavía; el alta implica verificar quién
es el cuidador de una persona vulnerable. Además elimina de un golpe enumeración de
emails, verificación por mail, captcha y spam de cuentas.
**Alternativas:** registro abierto (superficie innecesaria); registro por invitación
con token (más trabajo, mismo resultado en esta etapa).
**Consecuencias:** el onboarding es manual y no escala — aceptable para un MVP de 3
a 5 familias. No hay reset de contraseña autoservicio (**DT03**).

### D003 — Relación cuidador ↔ adulto

**Fecha:** 2026-09-29 · **Estado:** TOMADA (confirmada por el usuario el 2026-09-29)
**Decisión:** N:N mediante `CaregiverAccess`.
**Motivo:** un adulto con varios hijos es el caso normal, y un cuidador con dos
adultos (madre y suegra) también. El modelo N:N no cuesta más que el 1:N —una
colección puente— y el 1:N es un caso particular suyo. Al revés, migrar de 1:N a
N:N con datos en producción es caro.
**Alternativas:** `adult.userId` único (más simple, rompe el caso normal);
organizaciones/tenants (sobrediseño para el MVP).
**Consecuencias:** toda ruta de un adulto pasa por `requireAdultAccess`; el frontend
necesita selector de adulto desde el día uno.

### D004 — Roles OWNER / CAREGIVER

**Fecha:** 2026-09-29 · **Estado:** TOMADA (confirmada por el usuario el 2026-09-29)
**Decisión:** dos roles. `OWNER` administra el adulto, sus cuidadores y
la vinculación de Alexa; `CAREGIVER` ve todo y opera el día a día (confirma tomas,
atiende pedidos de ayuda, gestiona medicación y recordatorios).
**Motivo:** con un solo rol, cualquier cuidador podría revocar a los demás o
desvincular el Echo. Tres o más roles no tienen caso de uso identificado todavía.
**Alternativas:** un solo rol (riesgoso); agregar `VIEWER` de solo lectura
(plausible, sin caso de uso confirmado → backlog).
**Consecuencias:** matriz de permisos en `DATA_MODEL.md` §3.3, invariante del último
`OWNER`, y `requireRole` declarativo por ruta.

### D005 — Ocurrencias de medicación materializadas con snapshot

**Fecha:** 2026-09-29 · **Estado:** TOMADA
**Decisión:** colección `MedicationOccurrence` con un documento por toma prevista,
estados `PENDING`/`TAKEN`/`SKIPPED`/`MISSED`, y un `snapshot` inmutable de lo
prescrito ese día.
**Motivo:** el requisito es historial, no un booleano. Sin materializar no existe el
estado "no confirmó", no hay a qué apuntar una confirmación por voz, y editar un
medicamento reescribiría el pasado.
**Alternativas:** `medicamento.tomado = true` (descartado por el brief); cálculo
virtual + colección de confirmaciones (no representa `MISSED` y complica toda
consulta); event sourcing (sobrediseño).
**Consecuencias:** hace falta un scheduler (**D006**), índice único para
idempotencia, y re-materialización al editar. El volumen es trivial (~2–5 documentos
por adulto por día).

### D006 — Scheduler en proceso con node-cron

**Fecha:** 2026-09-29 · **Estado:** TOMADA
**Decisión:** dos jobs `node-cron` dentro del proceso Express: materializador
(horario, horizonte 48 h) y sweeper (cada 10 min).
**Motivo:** es lo más simple que cumple. El brief excluye colas explícitamente y el
volumen no las justifica ni de lejos.
**Alternativas:** BullMQ + Redis (infraestructura extra sin necesidad); cron del
sistema operativo (acopla al hosting, no testeable); Agenda/MongoDB como cola
(innecesario).
**Consecuencias:** los jobs se duplican si hay más de una instancia (**R04**,
**DT01**); se mitiga con idempotencia y una sola instancia en el MVP.

### D007 — HelpRequest separada de ActivityEvent

**Fecha:** 2026-09-29 · **Estado:** TOMADA
**Decisión:** dos colecciones. `HelpRequest` tiene ciclo de vida
(`OPEN`/`ACKNOWLEDGED`/`RESOLVED`); `ActivityEvent` es inmutable.
**Motivo:** mezclar un registro mutable con un log append-only rompe las garantías
de los dos.
**Alternativas:** solo eventos (no hay dónde poner el estado de atención); solo
`HelpRequest` (el timeline perdería el hito).
**Consecuencias:** cada pedido de ayuda escribe en las dos colecciones, a través del
servicio.

### D008 — La skill se sirve desde la API, sin Lambda y sin REST intermedia

**Fecha:** 2026-09-29 · **Estado:** TOMADA
**Decisión:** `POST /alexa/skill` en la misma app Express, con verificación de
firma ASK; los handlers llaman a los servicios **en proceso**.
**Motivo:** un solo deploy, un solo juego de secretos, sin latencia interna dentro
del presupuesto de 8 s, y la lógica de negocio queda estructuralmente en Chatio.
**Alternativas:** AWS Lambda (segundo artefacto, segunda config, más latencia);
endpoints REST propios para Alexa (duplica contratos e inventa una identidad para el
adulto); compartir los endpoints del panel (agujero de autorización).
**Consecuencias:** debemos verificar la firma nosotros; el endpoint es público y
necesita rate limiting propio; el body crudo obliga a ordenar los middlewares.

### D009 — Vinculación por código de 4 dígitos, sin Account Linking

**Fecha:** 2026-09-29 · **Estado:** TOMADA (confirmada por el usuario el 2026-09-29)
**Decisión:** el `OWNER` genera un código de 4 dígitos de un uso (TTL 15 min) y se
dicta al Echo; se crea el `AlexaLink` con los hashes de `userId` y `deviceId`. Sin
Account Linking, tampoco como paso previo a una publicación pública.
**Motivo:** Account Linking daría la identidad del **cuidador**, no del **adulto**:
igual haría falta el mapeo dispositivo → adulto. Y ningún adulto mayor completa un
OAuth en la app Alexa sin ayuda.
**Alternativas:** Account Linking OAuth2 (mucho trabajo, no resuelve el problema
real); vincular por `deviceId` a mano desde el panel (el cuidador no tiene forma de
conocer el `deviceId`); sin vinculación, un adulto por skill (no escala).
**Consecuencias:** hay que implementar códigos, TTL, límite de intentos y aviso por
email. Espacio de 10.000 combinaciones (**R07**), compensado. Migración a Account
Linking posible y aditiva.

### D010 — Recordatorios únicos y recurrentes, sin ocurrencias

**Fecha:** 2026-09-29 · **Estado:** TOMADA
**Decisión:** se soportan `ONE_OFF` y `RECURRING` (horas + días de la semana +
vigencia), calculados al vuelo, sin colección de ocurrencias.
**Motivo:** los dos tipos son casos de uso ya pedidos (turno médico / tomar agua) y
la diferencia de implementación es un `if`. No se materializan porque no se
confirman: sin confirmación no hay estado por instancia que persistir.
**Alternativas:** solo únicos (deja afuera "tomar agua"); RRULE completo
(sobrediseño); materializar recordatorios (documentos y un job sin beneficio).
**Consecuencias:** no hay historial de recordatorios cumplidos. Si se pide,
`ReminderOccurrence` con la misma forma que `MedicationOccurrence`.

### D011 — Notificaciones por email en el MVP

**Fecha:** 2026-09-29 · **Estado:** TOMADA (confirmada por el usuario el 2026-09-29)
**Decisión:** un único canal, email transaccional, detrás de la interfaz
`notifier.send()`. Más notificación en el panel por polling de 30 s.
**Motivo:** es lo más simple que cumple, no requiere que el familiar instale nada y
no depende de aprobaciones de terceros. El brief pide dejar WhatsApp/SMS/push para
después.
**Alternativas:** WhatsApp Business (requiere aprobación de plantillas y un número
verificado); SMS (costo por mensaje, cuenta con proveedor); Web Push (requiere
pestaña/PWA y service worker); WebSocket para el panel (innecesario con polling).
**Consecuencias:** el email puede caer en spam o leerse tarde — limitación **real**
para un pedido de ayuda, declarada en la UI y a probar en la validación. Hace falta
un dominio con SPF/DKIM. La elección del proveedor concreto es un detalle de
implementación de la Iteración 15 y no requiere una decisión de producto: el
requisito es dominio propio verificado con SPF/DKIM y capa gratuita suficiente para
el volumen del MVP. Si la validación (Iteración 20) muestra que el email llega tarde,
el canal que interrumpe (Telegram o push) pasa al frente del backlog.

### D012 — Identificadores de Alexa hasheados

**Fecha:** 2026-09-29 · **Estado:** TOMADA
**Decisión:** `userId` y `deviceId` de Alexa se guardan como SHA-256; en los logs,
truncado a 8 caracteres.
**Motivo:** son identificadores persistentes de una persona real. El hash permite
buscar por igualdad, que es todo lo que necesitamos, sin guardar el valor en claro.
**Alternativas:** guardarlos en claro (innecesario); cifrado reversible (no hace
falta revertir).
**Consecuencias:** no se pueden hacer búsquedas parciales ni depurar con el id
original. Aceptable.

### D013 — Zonas horarias por adulto, horarios como hora de pared

**Fecha:** 2026-09-29 · **Estado:** TOMADA
**Decisión:** `timezone` IANA obligatoria por adulto; los horarios se guardan como
`"HH:mm"` local; las ocurrencias guardan UTC + `localDate`/`localTime`
desnormalizados; Luxon en los bordes.
**Motivo:** el familiar puede vivir en otra zona que el adulto. Guardar UTC al
configurar rompería los horarios en cada cambio de DST.
**Alternativas:** todo UTC (rompe con DST); zona única del servidor (rompe con
familiares en el exterior); zona a nivel de cuenta (el cuidador con dos adultos en
zonas distintas queda mal).
**Consecuencias:** hay que resolver DST al materializar; el frontend muestra siempre
la zona del adulto; hacen falta tests con DST real.

### D014 — Soft delete selectivo

**Fecha:** 2026-09-29 · **Estado:** TOMADA
**Decisión:** `isActive` + `deletedAt` en medicamentos y recordatorios; `status` en
usuarios y adultos; **nunca** se borran ocurrencias ni eventos; los códigos de
vinculación sí se borran solos por TTL.
**Motivo:** el historial de medicación no puede desaparecer porque alguien borró un
medicamento. Hay que distinguir "pausado" de "dado de baja".
**Alternativas:** borrado físico (destruye historial); soft delete en todo
(complica sin beneficio en datos efímeros).
**Consecuencias:** cada query filtra `deletedAt: null` (scope reutilizable); no hay
`DELETE` real de adultos; el derecho de supresión se atiende administrativamente
(**DT02**).

### D015 — Hosting: VPS propio

**Fecha:** 2026-09-29 · **Estado:** TOMADA (elección del usuario el 2026-09-29)
**Decisión:** un **VPS propio** aloja todo: la API Node detrás de Nginx como reverse
proxy con TLS de Let's Encrypt, el frontend servido como estático por el mismo Nginx,
y MongoDB en el mismo servidor (contenedor o paquete del sistema) con backups
automatizados fuera del VPS.
**Motivo:** cumple el requisito duro de **no tener cold start** (la API es un proceso
siempre vivo, lo que salva el timeout de 8 s de Alexa y hace que la primera
interacción del día funcione), permite que los jobs de `node-cron` corran sin
adaptación, evita el costo por servicio de las PaaS y da control total sobre la
configuración y los datos de salud.
**Alternativas:** PaaS de pago bajo (menos operación, más costo recurrente y menos
control); capa gratuita (descartada: suspende el contenedor por inactividad);
serverless (cold start + los jobs de cron no encajan).
**Consecuencias — y son la contrapartida real de esta decisión:** nosotros pasamos a
ser responsables de TLS y su renovación automática, actualizaciones de seguridad del
sistema operativo, firewall, hardening de SSH, backups **y su restauración probada**,
y monitoreo de disco y memoria. Nada de eso viene resuelto. Todo está desglosado como
tareas explícitas de la Iteración 19, y el riesgo operativo se registra como **R12**
con su deuda asociada **DT10**. Decisión operativa derivada: MongoDB corre en el
mismo VPS, así que **los backups fuera del servidor no son opcionales** — sin ellos,
perder el VPS es perder el historial de medicación.

### D016 — Un repositorio, dos paquetes npm, sin workspaces

**Fecha:** 2026-09-29 · **Estado:** TOMADA
**Decisión:** `backend/` y `frontend/` con su propio `package.json`, en un solo
repositorio, sin npm workspaces ni herramientas de monorepo.
**Motivo:** comparten poco código (algún esquema Zod, que se duplica si hace falta)
y los workspaces agregan complejidad de resolución de dependencias que no compra
nada acá.
**Alternativas:** monorepo con workspaces y paquete `shared` (útil si crece);
repositorios separados (deploys desacoplados, pero sincronizar contratos cuesta más).
**Consecuencias:** dos `npm install`, dos suites de tests, dos jobs de CI. Si la
duplicación de esquemas molesta, se evalúa un paquete compartido y se registra la
decisión.

### D017 — CI desde la Iteración 1

**Fecha:** 2026-09-29 · **Estado:** TOMADA
**Decisión:** GitHub Actions con tests y `npm audit` en cada push, sin deploy
automático.
**Motivo:** cuesta casi nada al principio y es lo que hace exigible la regla de "no
se cierra una iteración con la rama en rojo".
**Consecuencias:** hace falta el repositorio en GitHub desde el inicio.

### D018 — Sin proactividad por Alexa en el MVP ~~(vigente)~~ → **SUPERSEDED por D021**

**Fecha:** 2026-09-29 · **Estado:** **SUPERSEDED el 2026-09-29 por D021**
**Se conserva por trazabilidad. No implementar según esta decisión.**

**Decisión original:** la skill solo responde cuando el adulto le habla. No se usan
Reminders API, Proactive Events ni notificaciones.
**Motivo original:** una Custom Skill no puede hablar por iniciativa propia. Reminders API
es el único camino real, y requiere un permiso que el adulto tendría que otorgar en la app
Alexa (barrera de onboarding alta) más una iteración propia.
**Alternativas consideradas entonces:** Reminders API en el MVP (permiso + onboarding
complejo + riesgo de certificación); Proactive Events (solo un chime, el usuario tiene que
preguntar).
**Consecuencias que tuvo:** se registró **R01** y se dejó la Reminders API como primer
candidato del backlog.

**Por qué se revisó:** decisión de producto del usuario el 2026-09-29. El valor central de
Chatio es que el adulto **no tenga que acordarse** de consultar; un MVP exclusivamente pull
no permite validar esa hipótesis, que es justamente la que hay que probar. Además, al
analizar la API en detalle apareció el **consentimiento por voz**
(`ALEXA_REMINDERS.md` §2.2), que desarma el argumento de onboarding sobre el que se apoyaba
esta decisión: el adulto puede otorgar el permiso diciendo "sí", sin tocar la app Alexa.

**Reemplazada por:** **D021**.

### D019 — Idiomas del proyecto

**Fecha:** 2026-09-29 · **Estado:** TOMADA
**Decisión:** código, nombres y commits en inglés; documentación, UI y textos de voz
en español.
**Motivo:** el código en inglés es lo idiomático del ecosistema y evita
`medicamentoRepositorio`. Los usuarios son hispanohablantes.
**Consecuencias:** los enums son constantes en inglés (`TAKEN`) con etiquetas en
español en la UI, mapeadas en un solo lugar.

### D020 — Dependencias mínimas

**Fecha:** 2026-09-29 · **Estado:** TOMADA

Backend: `express`, `mongoose`, `zod`, `bcrypt`, `jsonwebtoken`, `cookie-parser`,
`helmet`, `cors`, `express-rate-limit`, `pino` + `pino-http`, `luxon`, `node-cron`,
`ask-sdk-core` + `ask-sdk-express-adapter`, `dotenv`. Dev: `vitest`, `supertest`,
`mongodb-memory-server`, `eslint`, `prettier`.

Frontend: `react`, `react-dom`, `react-router-dom`, `@tanstack/react-query`,
`react-hook-form`, `zod`, `luxon`, `clsx`, `tailwindcss`. Dev: `vite`, `vitest`,
`@testing-library/react`, `msw`, `eslint`, `prettier`.

**Descartadas y por qué:** Redux/Zustand (TanStack Query + `useState` alcanza);
`axios` (`fetch` nativo con un wrapper propio); `date-fns` (Luxon maneja mejor las
zonas IANA, y una sola librería de fechas); librería de componentes
(Tailwind + componentes propios da mejor control de accesibilidad y tamaño);
`i18next` (un solo idioma); `framer-motion` (sin animaciones complejas); `moment`
(deprecada); `mongoose-paginate` (el cursor es de 10 líneas); Socket.io (polling
alcanza).

**Consecuencias:** agregar una dependencia exige registrar una decisión con su
justificación.

### D021 — Reminders API dentro del alcance del MVP (supersede D018)

**Fecha:** 2026-09-29 · **Estado:** TOMADA (decisión de producto del usuario)
**Decisión:** Chatio crea recordatorios nativos de Alexa (Reminders API) para avisarle al
adulto a la hora de la toma. Entra al alcance del MVP con una iteración propia (la 16),
antes de la validación con usuarios.
**Motivo:** es el valor principal del producto. Sin aviso, el adulto tiene que recordar que
debe preguntar, que es precisamente la capacidad que no podemos dar por supuesta en la
población objetivo.
**Alternativas:** seguir en modo pull (**D018**, descartada); Proactive Events (solo un
chime, el usuario debe preguntar por sus notificaciones: no sirve); avisos por email al
familiar para que él llame (no es autonomía del adulto).
**Consecuencias:**
- Se pide el permiso `alexa::alerts:reminders:skill:readwrite`, preferentemente por voz.
- Aparece la colección `AlexaReminderSync` y el servicio de reconciliación.
- **Limitación de plataforma aceptada:** la creación de un reminder exige una sesión activa
  de la skill, por lo que un cambio hecho en el panel se aplica en la próxima sesión del
  adulto (**R14**), y el panel lo muestra como *pendiente de activación* en lugar de
  fingir que ya está.
- Dependencia nueva de plataforma, con **R15** (comportamiento real en `es-MX`) mitigado
  verificando antes de construir.
- **Invariante, con test:** un aviso emitido **no** es una toma confirmada. Ninguna
  operación de la integración puede alterar una `MedicationOccurrence`.
- Nuevo riesgo de producto **R16**: que el familiar interprete el aviso como supervisión.

### D022 — Un reminder por franja horaria, no por medicamento

**Fecha:** 2026-09-29 · **Estado:** TOMADA
**Decisión:** el conjunto de avisos se calcula agrupando los horarios de los medicamentos
activos por **(hora local, días de la semana)**. Cada grupo distinto es un aviso.
**Motivo:** el adulto no debe escuchar dos alarmas seguidas a las 09:00 porque tiene dos
medicamentos a esa hora. Además reduce drásticamente la sincronización: agregar un
medicamento en una franja existente **no genera ningún cambio en Alexa**, y la creación
—la única operación que exige sesión activa— pasa a ser la más rara.
**Alternativas:** un reminder por medicamento (más avisos, más sincronización, peor
experiencia); un único reminder diario (pierde las tomas de la tarde y la noche).
**Consecuencias:** el aviso no puede nombrar un medicamento concreto, lo que es coherente
con **D023**. La identidad del aviso es `slotKey` y no un `medicationId`.

### D023 — El texto del aviso no contiene datos de salud

**Fecha:** 2026-09-29 · **Estado:** TOMADA
**Decisión:** el texto es siempre *"Es hora de tu medicación. Decí: Alexa, abre chatio."*
Sin nombre de medicamento, sin dosis, sin indicación.
**Motivo:** Amazon almacena ese texto, es visible en la app Alexa y lo escucha cualquiera
en la habitación. Poner "tomá tu Losartán de 50 miligramos" es exponer un dato de salud sin
necesidad, en un dispositivo compartido. El detalle lo da la skill cuando el adulto la
abre, con datos frescos y en el marco de una interacción que él inició.
**Alternativas:** incluir el nombre (mejor utilidad inmediata, peor privacidad y obliga a
resincronizar con cada cambio de medicación); texto configurable por el cuidador (backlog,
con advertencia explícita).
**Consecuencias:** si el adulto no abre la skill tras el aviso, no sabe qué tomar — sigue
siendo mejor que no tener aviso. Y el aviso **no necesita actualizarse** cuando cambia el
contenido de la medicación, solo cuando cambian las franjas horarias.

### D024 — Reconciliación solo en sesión, sin token de usuario fuera de sesión

**Fecha:** 2026-09-29 · **Estado:** TOMADA
**Decisión:** el estado deseado de los avisos se calcula al escribir medicamentos (local,
sin red) y se aplica contra Alexa en la próxima sesión de la skill, mediante un
reconciliador idempotente con presupuesto acotado. **No** se implementa el token de usuario
fuera de sesión.
**Motivo:** un token fuera de sesión **no puede crear** reminders (solo editar y borrar), y
obtenerlo exige manejar `Alexa.Authorization.Grant`, canjear códigos y **almacenar y
refrescar credenciales de terceros de larga duración** por usuario. Mucho costo y mucha
superficie de seguridad para mejorar solo la latencia del borrado.
**Alternativas:** token fuera de sesión (backlog); crear avisos con Skill Messaging API
(imposible: la restricción de creación se mantiene); pool de avisos placeholder editables
(frágil y apoyado en comportamiento no documentado — descartado explícitamente en
`ALEXA_REMINDERS.md` §1).
**Consecuencias:** latencia de propagación de hasta una sesión (**R14**), visible en el
panel. Un aviso de un medicamento dado de baja puede sonar una vez más antes de borrarse; la
skill dice la verdad al abrirse, así que el efecto es una molestia, no un riesgo clínico.

### D025 — Los healthchecks van sin versionar y fuera del contrato de la API

**Fecha:** 2026-09-29 · **Estado:** TOMADA (Iteración 1)
**Decisión:** `GET /health` y `GET /ready`, en la raíz, sin el prefijo `/api/v1`, sin el
envoltorio `{ data }` / `{ error }`, y sin exponer versión, uptime ni nombre de host.
**Motivo:** resuelve una contradicción real que tenía la documentación: la tarea de la
Iteración 1 pedía `/api/v1/health` y `/api/v1/health/ready`, su propio criterio de
aceptación pedía `/health`, y `API.md` §16 documentaba las versionadas. Se elige la
variante sin versionar porque un healthcheck es infraestructura, no un recurso: lo consumen
el monitoreo externo y el reverse proxy, nunca tendría una `v2`, y no debe romperse al
versionar la API. El `version` que figuraba en el ejemplo se quita: es información interna
en un endpoint público.
**Alternativas:** mantener las versionadas (obligaría al monitoreo a seguir la versión de
la API); publicar las dos (duplica un contrato sin ganar nada).
**Consecuencias:** se actualizaron `API.md` §16 y `ARCHITECTURE.md` §8. `/health` responde
200 aun con Mongo caído —si devolviera error, un orquestador reiniciaría un proceso sano— y
`/ready` hace un `ping` real contra la base, no mira solo el estado del socket.

### D026 — El esquema de entorno crece por iteración

**Fecha:** 2026-09-29 · **Estado:** TOMADA (Iteración 1)
**Decisión:** `env.js` solo valida las variables que el código **ya lee**. Las de
autenticación, email y Alexa se agregan cuando llega su iteración.
**Motivo:** la validación estricta al arrancar es la que hace cumplir "no arrancar con
configuración inválida" (SECURITY.md §7). Si el esquema exigiera hoy `JWT_ACCESS_SECRET`,
el arranque fallaría por una variable que ningún código usa, y el equipo aprendería a
rellenar valores falsos para que arranque — que es exactamente el hábito que la validación
busca evitar.
**Alternativas:** declarar todo desde el inicio como opcional (una validación opcional no
valida nada); declarar todo como obligatorio (arranque imposible y secretos de relleno).
**Consecuencias:** `.env.example` y `ARCHITECTURE.md` §7 marcan qué variables están ya
activas y en qué iteración entra cada una. Cada iteración que suma configuración suma su
validación y sus tests.

### D027 — Versiones del stack: ESM, Express 4, Zod 4, ESLint 10, Vitest 5

**Fecha:** 2026-09-29 · **Estado:** TOMADA (Iteración 1)
**Decisión:** módulos **ESM** (`"type": "module"`); dependencias con versión **exacta**
(sin `^`); **Express 4.22.3** como dice **D020**; y la versión mayor **actual** de cada
herramienta de desarrollo y validación: Zod 4.6.5, ESLint 10.11.0, Vitest 5.0.2,
Mongoose 8.24.4.
**Motivo:** ESM es el estándar de Node 20+ y evita el doble sistema de módulos. Las
versiones exactas hacen que CI y desarrollo instalen lo mismo. Sobre las mayores: `eslint@9`
ya avisa que **no tiene soporte**, y arrancar un proyecto nuevo con la validación (Zod) o el
runner (Vitest) en una mayor vieja garantiza una migración posterior más cara. Express se
queda en 4 porque es una decisión documentada (**D020**) y cambiarla en medio de la
iteración sería modificar una decisión en silencio.
**Alternativas:** Express 5 (evaluado y diferido, ver **DT13**); CommonJS (más simple para
interoperar con `ask-sdk`, que es CJS, pero a contramano del ecosistema); rangos `^`
(instalaciones no reproducibles).
**Consecuencias:** hubo que adaptar `env.js` a la API de Zod 4 (`error` unificado en lugar
de `required_error`/`invalid_type_error`/`errorMap`, y `z.strictObject` en lugar de
`.strict()`), lo que destapó dos diferencias de comportamiento reales documentadas en la
bitácora. Queda pendiente verificar la interoperabilidad de ESM con `ask-sdk-core` y
`ask-sdk-express-adapter` (CJS) en la Iteración 11 (**DT15**).

### D028 — Sesiones persistidas para la rotación y la detección de reutilización

**Fecha:** 2026-09-29 · **Estado:** TOMADA (Iteración 2). **Extiende D001**, que sigue
vigente en todo lo demás.
**Decisión:** se agrega la colección `auth_sessions`: un documento por sesión con el
**`SHA-256` del refresh token vigente**, que se rota en el lugar. La reutilización de un
token viejo revoca **la sesión entera** (no las otras sesiones del usuario).
`refreshTokenVersion` se renombra a **`tokenVersion`** y pasa a invalidar también los access
tokens (ver **D029**). Los claims del access token se reducen a `sub` y `tv`: **se quita el
email**.

**Motivo — y esto era una contradicción real de la documentación:** `API.md` §3 exigía que
un refresh *reusado* devolviera 401, pero el único mecanismo que especificaba era
`refreshTokenVersion`. Con eso no se puede: el token viejo y el nuevo llevan el mismo `tv`,
así que **los dos son válidos** hasta que expiran, la rotación no es verificable y el replay
es indetectable. Subir el contador en cada rotación lo arreglaría para un dispositivo y
rompería la sesión de todos los demás en cada refresh. Guardar el hash del token vigente es
lo mínimo que hace ciertas las tres propiedades que el producto necesita: rotación real,
detección de replay y cierre de sesión por dispositivo. Se quita el email del token porque
un bearer token viaja en cada request y queda en cualquier log intermedio.

**Alternativas consideradas:**
- *Solo `tokenVersion`* (lo documentado): descartado, no cumple su propio criterio.
- *Subir `tokenVersion` en cada rotación*: rompe el uso en más de un dispositivo.
- *Token de refresh opaco en lugar de JWT*: igual de válido y algo más corto, pero
  obligaría a una consulta a la base incluso para un token vencido y se alejaría más de
  D001. El JWT permite descartar lo expirado sin tocar Mongo.
- *Revocar **todas** las sesiones ante un replay* (en lugar de solo la afectada): más
  agresivo. Se eligió revocar la familia afectada porque contiene el incidente en el
  dispositivo comprometido y no expulsa al cuidador de su otro dispositivo por un falso
  positivo. Si la validación con usuarios mostrara replays reales, escalar es un cambio de
  una línea.

**Consecuencias:** una colección y un servicio más; una escritura condicional en cada
refresh (`findOneAndUpdate` sobre el hash vigente) que resuelve la carrera entre dos
refresh simultáneos; y el efecto colateral de que **dos refresh concurrentes con el mismo
token cierran la sesión**, porque son indistinguibles de un replay — de ahí el requisito de
*refresh de vuelo único* en el frontend (`API.md` §3, **DT17**). Se actualizaron
`API.md` §3, `DATA_MODEL.md` §3.1 y §3.1.bis, `SECURITY.md` §3 y `TESTING.md` §3.1.

### D029 — `requireAuth` valida contra la base en cada request

**Fecha:** 2026-09-29 · **Estado:** TOMADA (Iteración 2)
**Decisión:** además de verificar la firma del JWT, `requireAuth` carga el usuario por id y
exige que esté `ACTIVE` y que su `tokenVersion` coincida con el claim `tv`.
**Motivo:** con un token puramente stateless, desactivar a un usuario o forzar un logout
global tarda hasta 15 minutos en surtir efecto. Sobre datos de salud eso no es aceptable, y
el costo es una lectura por `_id` —indexada— en endpoints que ya van a consultar la base de
todos modos (desde la Iteración 3, `requireAdultAccess` hace lo mismo con
`CaregiverAccess`).
**Alternativas:** token stateless sin lectura (más rápido, revocación diferida 15 min);
lista de denegación en memoria (estado que se pierde al reiniciar y no funciona con más de
una instancia).
**Consecuencias:** una lectura extra por request autenticado; a cambio, revocación
inmediata real. Si alguna vez el volumen lo pidiera, se puede cachear el par
`(userId, tokenVersion)` unos segundos, aceptando esa ventana. Coherente con la regla de
`SECURITY.md` §4 de re-verificar contra la base y no contra el token.

### D030 — CSRF: `SameSite=Strict` en lugar de tokens sincronizadores

**Fecha:** 2026-09-29 · **Estado:** TOMADA (Iteración 2)
**Decisión:** no se agrega librería ni token CSRF. La protección de `POST /auth/refresh` y
`POST /auth/logout` —los dos únicos endpoints que la cookie alcanza, por su `Path`— es
`SameSite=Strict`, más que ambos sean `POST` y que CORS tenga allowlist.
**Motivo:** el access token viaja en un header, así que el resto de la API es inmune a CSRF
por construcción. Para la cookie, `SameSite=Strict` hace que el navegador simplemente no la
envíe en peticiones originadas en otro sitio: un token sincronizador sería redundante y un
mecanismo más que mantener y equivocar. Y el peor caso de un CSRF exitoso sería cerrar la
sesión o rotar un token cuya respuesta el atacante no puede leer.
**Alternativas:** `csurf` (sin mantenimiento activo); *double submit cookie* (redundante
acá); patrón de token sincronizador propio (más superficie para menos beneficio).
**Consecuencias — la letra chica:** el panel **debe** servirse desde el mismo sitio que la
API, que es la topología de **D015**. Si el panel se moviera a otro dominio,
`SameSite=Strict` impediría que la cookie viaje y habría que pasar a `SameSite=None;
Secure` **y entonces sí** sumar protección CSRF explícita. Riesgo **R18**, documentado
también como requisito del frontend en `API.md` §3.

---

### D034 — Semántica de medicación para adultos inactivos

**Fecha:** 2026-10-02 · **Estado:** TOMADA (Iteración 4)

Un adulto `INACTIVE` conserva y permite consultar sus medicamentos a los cuidadores con
acceso activo, pero bloquea crear, editar, activar, desactivar o dar de baja medicamentos
con `422 BUSINESS_RULE`. Así se preserva el historial y se evita configurar recordatorios
para un adulto que está fuera de servicio. Reactivar el adulto vuelve a habilitar esas
operaciones; no se crean ocurrencias en esta iteración.

También se agrega `MEDICATION_ACTIVATED` al catálogo de eventos para distinguir activar de
desactivar, y `nextOccurrenceLocal` se devuelve como `{ date, time, timezone }` sin duplicar
la timezone dentro de `Medication`.

### D035 — Identidad y re-materialización de ocurrencias

**Fecha:** 2026-10-02 · **Estado:** TOMADA (Iteración 5)

La identidad lógica de una toma es `{ medicationId, scheduledAt }` y se protege con un
índice único. El materializador trabaja con una ventana de 48 horas, hace `upsert` con
`$setOnInsert` y conserva el snapshot de la configuración vigente al materializar.

Al editar, pausar, reactivar o dar de baja un medicamento, solo se eliminan las
ocurrencias `PENDING` futuras y se vuelven a materializar las que correspondan; las
ocurrencias pasadas o resueltas nunca se reescriben. Un cambio de timezone del Adult
aplica la misma regla para un adulto activo. Un Adult `INACTIVE` no genera nuevas
ocurrencias y conserva las ya materializadas para el historial.

La confirmación usa la ventana `[scheduledAt - 60 min, scheduledAt + graceMinutes]`.
`TAKEN` representa una confirmación declarada, no una verificación física de ingesta;
`MISSED` significa que no se registró confirmación dentro de la ventana. La transición
condicional por estado y el índice único hacen idempotentes las confirmaciones y los
materializadores concurrentes.

### D033 — Consentimiento explícito en el alta de Adult

**Fecha:** 2026-10-02 · **Estado:** TOMADA (Iteración 3)

El alta exige `consentConfirmed: true`. El backend no persiste ese booleano como una
declaración mutable: registra `consentRecordedAt`, `consentRecordedByUserId` y
`consentStatementVersion: v1`, y no expone esos campos en el DTO público del adulto.
Esto cumple la exigencia de consentimiento informado de `SECURITY.md` sin guardar más
datos personales del adulto.

### D031 — Transacciones para consistencia de Adult y accesos

**Fecha:** 2026-10-02 · **Estado:** TOMADA (Iteración 3)

Las operaciones que crean o modifican la relación `Adult` ↔ `CaregiverAccess` usan
transacciones MongoDB. El Adult se configura en un replica set de un nodo en desarrollo y
en el VPS: esto habilita atomicidad sin convertir el MVP en un despliegue multiinstancia.
Las mutaciones de accesos toman además el lock de escritura del Adult dentro de la
transacción para serializar la revocación o degradación del último `OWNER`.

Un acceso `REVOKED` se reactiva con un nuevo `POST` de cuidador, conservando el documento
y su historial; solo un acceso activo duplicado es conflicto. Los cambios de rol emiten
`CAREGIVER_ROLE_CHANGED`.

### D032 — Replica de verificación y actividad mínima

**Fecha:** 2026-10-02 · **Estado:** TOMADA (Iteración 3)

Se adelanta únicamente el modelo/servicio de escritura de `ActivityEvent` necesario para
auditar cambios del adulto y de cuidadores. El timeline de lectura y su API siguen en la
Iteración 7. `hasAlexaLink` y `openHelpRequests` de `/auth/me` quedan en sus valores
neutros hasta que existan esas entidades.

## Decisiones pendientes

**No queda ninguna decisión pendiente.**

Las cinco bloqueantes fueron respondidas por el usuario el **2026-09-29**:

| Decisión | Resultado | Desbloquea |
| :--- | :--- | :--- |
| **D003** | N:N mediante `CaregiverAccess` | Iteración 3 |
| **D004** | Dos roles: `OWNER` y `CAREGIVER` | Iteración 3 |
| **D009** | Código de 4 dígitos, sin Account Linking | Iteración 12 |
| **D011** | Email transaccional + aviso en el panel | Iteración 15 |
| **D015** | VPS propio (Nginx + Let's Encrypt + Mongo en el mismo servidor) | Iteración 19 |

Y las dos que seguían abiertas se cerraron el mismo día:

| Pregunta abierta | Resolución |
| :--- | :--- |
| Alcance de la proactividad (era *decisión pendiente A*) | **Resuelta por D021**, por decisión de producto del usuario: la Reminders API entra al MVP con su propia iteración (la 16). **D018** queda `SUPERSEDED` y se conserva por trazabilidad |
| Manejo de zonas horarias (era *decisión pendiente B*) | **Resuelta por D013**: zona IANA por adulto, horarios como hora de pared, UTC en las ocurrencias. Encaja además con lo que la Reminders API espera (`scheduledTime` local + `timeZoneId`), lo que confirma la decisión |

Lo que queda abierto **no son decisiones sino verificaciones empíricas** de plataforma,
todas dentro de la Iteración 16 y todas con su comportamiento por defecto ya definido para
el caso de que fallen (`ALEXA_REMINDERS.md` §7):

- Comportamiento real de la Reminders API en `es-MX` (**R15**).
- Disponibilidad del consentimiento por voz en `es-MX` (fallback: tarjeta de permisos).
- Si los eventos de skill llegan a un endpoint HTTPS propio (**DT12**).
- Qué ocurre con un aviso si el Echo está offline a esa hora.

Ninguna de ellas bloquea el inicio del desarrollo: las iteraciones 1 a 15 no dependen de
la Reminders API.

---

## Riesgos

| id | Riesgo | Impacto | Prob. | Mitigación |
| :--- | :--- | :--- | :--- | :--- |
| R01 | ~~Alexa no puede avisar por iniciativa propia~~ **Cerrado por D021**: se incorpora la Reminders API al MVP (Iteración 16). El riesgo se transforma en R14/R15/R16 | — | — | Cerrado el 2026-09-29 |
| R02 | Dos adultos con un solo Echo no son distinguibles | Medio | Media | Vinculación por dispositivo; limitación declarada; no se adivina |
| R03 | El familiar interpreta "confirmado" como "verificó que lo tomó" y baja la guardia | **Alto** | Media | Lenguaje explícito en UI y documentos; se verifica en las entrevistas de la 20 |
| R04 | Jobs duplicados si se escala a varias instancias | Bajo | Baja | Idempotencia por índice único; una sola instancia en el MVP (**DT01**) |
| R05 | Invocation name de una palabra rechazado o mal reconocido | Medio | Media | Alternativas listas (`mi chatio`); prueba en Echo real en la Iteración 11 |
| R06 | El ASR transcribe mal los nombres de medicamentos | Medio | **Alta** | El flujo principal no depende del nombre; matcheo difuso; catálogo semilla |
| R07 | Código de vinculación de solo 4 dígitos | Medio | Baja | TTL 15 min, un uso, 5 intentos/hora, aviso por email, revocación en un clic |
| R08 | Certificación de Alexa rechaza la skill por contenido de salud | Medio | Media | Disclaimers, privacy policy, sin consejo médico, beta test por invitación primero |
| R09 | Cold start del hosting rompe el timeout de 8 s de Alexa | Alto | **Baja** | **Mitigado por D015**: en un VPS la API es un proceso siempre vivo bajo systemd/PM2, no hay suspensión por inactividad |
| R10 | El familiar carga mal los horarios y el adulto recibe información equivocada | **Alto** | Media | Vista previa en lenguaje natural antes de guardar; validación estricta; timeline auditable |
| R11 | El email de ayuda cae en spam y nadie se entera | **Alto** | Media | SPF/DKIM, asunto claro, aviso en el panel, prueba de entrega real en la 20 |
| R12 | Carga operativa del VPS: TLS vencido, sistema sin actualizar, disco lleno o backup que nunca se probó | **Alto** | Media | Consecuencia asumida de **D015**. Renovación automática de Let's Encrypt **verificada**, `unattended-upgrades`, alerta de disco al 80 %, chequeo externo del healthcheck, y restauración de backup probada en la Iteración 19 (**DT10**) |
| R13 | MongoDB en el mismo VPS: un fallo del servidor se lleva la aplicación **y** los datos | **Alto** | Baja | Backups diarios cifrados **fuera** del VPS con restauración probada; Mongo escuchando solo en localhost |
| R14 | Un reminder solo puede **crearse** en sesión: un cambio del familiar tarda hasta una sesión en aplicarse | Medio | **Alta** (es el comportamiento normal, no una falla) | El panel muestra "pendiente de activación" con la explicación; la sesión de vinculación crea los avisos iniciales; los propios avisos hacen que el adulto abra la skill a diario |
| R15 | La Reminders API no se comporta en `es-MX` como la documentación sugiere (locale, verbalización, consentimiento por voz) | **Alto** | Media | La Iteración 16 **empieza verificando en un Echo real** antes de construir; si falla, se detiene y se reporta en lugar de improvisar un workaround |
| R16 | El familiar interpreta el aviso como supervisión y la confirmación como verificación de la toma, y baja la guardia | **Alto** | Media | Copy normativo en la UI (`FRONTEND.md` §1); "aviso programado" nunca se muestra como "aviso escuchado"; se verifica en las entrevistas de la Iteración 20 |
| R17 | Dependencia funcional de una plataforma de terceros para el valor central del producto | Medio | Media | Todo el acoplamiento vive en una colección y un servicio (`AlexaReminderSync`); el dominio y el historial funcionan sin Alexa; el modo pull sigue operativo si el permiso falta o se revoca |
| R18 | La protección CSRF depende de `SameSite=Strict`, que exige que el panel se sirva desde el mismo sitio que la API | Medio | Baja | Es la topología de **D015** (Nginx sirve ambos). Documentado en `SECURITY.md` §3 y como requisito del frontend en `API.md` §3; si se separan los dominios hay que sumar protección CSRF explícita |

---

## Deuda técnica

| id | Deuda | Origen | Cuándo se paga |
| :--- | :--- | :--- | :--- |
| DT01 | Los jobs no tienen lock: solo una instancia de la API | D006 | Cuando haga falta escalar |
| DT02 | No hay export ni borrado autoservicio de los datos de un adulto | D014 | Backlog (obligación de la ley 25.326 si el producto crece) |
| DT03 | No hay reset de contraseña autoservicio | D002 | Cuando haya alta pública |
| DT04 | ~~Sin avisos proactivos~~ **Pagada antes de existir**: D021 incorpora la Reminders API al MVP (Iteración 16) | D018 → D021 | Cerrada el 2026-09-29 |
| DT11 | Sin token de usuario fuera de sesión: el borrado y la actualización de avisos esperan a la próxima sesión | D024 | Si la latencia molesta en la validación |
| DT12 | `ALEXA_REMINDER_FIRED` depende de que los eventos de skill lleguen al endpoint HTTPS, sin verificar | Iteración 16 | Al verificarlo; si exigen Lambda, se decide si vale un segundo artefacto |
| DT13 | Express 4 en un proyecto nuevo, con Express 5 ya estable | D020 / D027 | Evaluar la migración antes de que el router crezca. El código actual ya es compatible (no muta `req.query`) |
| DT14 | El cierre ordenado ante señal real no está verificado: Windows no entrega SIGTERM a un proceso hijo | Iteración 1 | Verificar en Linux (CI o el smoke test de la Iteración 19). La lógica sí está cubierta por 9 tests unitarios |
| DT15 | Interoperabilidad de ESM con `ask-sdk-core` / `ask-sdk-express-adapter`, que son CJS, sin verificar | D027 | Iteración 11, al montar el endpoint de la skill |
| DT16 | La CI no se ejecutó nunca: el repositorio es local y no tiene remoto | Iteración 1 | Cuando se autorice crear el remoto |
| DT17 | El frontend necesita *refresh de vuelo único*: dos `/auth/refresh` concurrentes con el mismo token cierran la sesión | D028 | Iteración 8, al escribir el `apiClient`. Está documentado en `API.md` §3 |
| DT18 | No hay pantalla ni endpoint para listar y revocar sesiones activas; el modelo ya lo soporta | Iteración 2 | Cuando aparezca el caso de uso (por ejemplo "cerrar sesión en todos los dispositivos") |
| DT19 | `requireAuth` hace una lectura a la base por request autenticado | D029 | Solo si el volumen lo pide; se resolvería con un caché corto de `(userId, tokenVersion)` |
| DT05 | Sin tests E2E de navegador | TESTING §1 | Cuando el frontend se estabilice |
| DT06 | Reintento de notificaciones simple (piggyback del sweeper) | Iteración 15 | Si aparecen fallos de entrega |
| DT07 | Esquemas Zod duplicados entre backend y frontend | D016 | Si la duplicación genera bugs |
| DT08 | Sin i18n; textos en español incrustados en componentes | D019 | Si se apunta a otro idioma |
| DT09 | Sin borrado ni archivado del historial de actividad | Iteración 7 | Cuando el volumen lo pida |
| DT10 | Infraestructura administrada a mano: no hay IaC ni deploy automatizado, y la recuperación del VPS es un procedimiento manual | D015 | Cuando el servidor deje de ser uno solo, o antes si el procedimiento manual falla una vez |

---

## Backlog futuro

Ideas registradas, explícitamente **fuera** del MVP.

**Proactividad y canales.** ~~Alexa Reminders API~~ (ya no es backlog: entró al MVP por
**D021**) · token de usuario fuera de sesión para aplicar bajas y cambios de aviso sin
esperar una sesión (**DT11**) · nombre del medicamento en el texto del aviso, como opción
configurable por el cuidador y con advertencia de privacidad (**D023**) · avisos de
recordatorios no farmacológicos (turnos, hidratación) vía Reminders API · notificaciones
push / PWA · WhatsApp Business · SMS · llamada automática ante un pedido de ayuda sin
atender.

**Hardware (excluido del MVP por el brief).** Xiaozhi · ESP32-S3 · INMP441 ·
MAX98357A · hardware propio · detección automática de caídas · cámaras · visión
artificial.

**Producto.** App móvil nativa · IA conversacional abierta con guardrails ·
recordatorios confirmables (`ReminderOccurrence`) · medicación "según necesidad"
(PRN) · pautas escalonadas · control de stock y aviso de reposición · informes
semanales en PDF para el médico · rol `VIEWER` de solo lectura · organizaciones
(residencias, multi-tenant) · 2FA para cuidadores · export y borrado autoservicio ·
multi-idioma · integración con calendario · recordatorios de turnos con
confirmación del familiar.

**Explícitamente descartado, no postergado.** Diagnóstico médico · modificación
automática de tratamientos · consejo de dosis · microservicios · Kubernetes · colas
· event sourcing.

---

## Bitácora de desarrollo

Formato obligatorio de cada entrada. Nunca se marca una tarea como completada sin
haberla verificado contra sus criterios de aceptación y sus tests.

```text
Fecha:
Iteración:
Tareas abordadas:
Cambios realizados:
Tests ejecutados:
Resultado:
Problemas encontrados:
Decisiones:
Pendientes:
```

---

### 2026-09-29 — Iteración 0

**Fecha:** 2026-09-29
**Iteración:** 0 — Arquitectura y documentación

**Tareas abordadas:** inspección del repositorio; análisis del prototipo previo;
revisión de la arquitectura propuesta; verificación de las capacidades de Alexa;
modelo de datos; contratos de API; modelo de interacción de la skill; análisis de
Account Linking; modelo de seguridad; estrategia de testing; estructura del
proyecto; documentación completa; roadmap.

**Cambios realizados:**

- `v3/` estaba vacío. Se detectó un prototipo previo en `../chatio` (ONIET:
  Python/FastAPI + SQLite + MQTT + ESP32 + Gemini + Telegram). Se decidió **no
  reutilizar código** (stack y transporte distintos) y sí reutilizar cuatro reglas
  de dominio validadas, documentadas en `ARCHITECTURE.md` §10.
- Creados `README.md`, `ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`,
  `docs/API.md`, `docs/ALEXA_SKILL.md`, `docs/SECURITY.md`, `docs/TESTING.md`,
  `docs/FRONTEND.md`.
- **Sin código de aplicación**, por decisión de alcance de la Iteración 0.

**Tests ejecutados:** ninguno (no hay código). Verificación manual de coherencia
entre documentos: enums, nombres de campos, rutas, estados y longitud del código de
vinculación cruzados entre `DATA_MODEL.md`, `API.md` y `ALEXA_SKILL.md`.

**Resultado:** documentación completa. Se corrigió una inconsistencia detectada en
la revisión: el código de vinculación estaba especificado con 6 dígitos en
`DATA_MODEL.md` y con `AMAZON.FOUR_DIGIT_NUMBER` en `ALEXA_SKILL.md`; se unificó en
4 dígitos con los controles compensatorios documentados (R07).

**Problemas encontrados:**

1. **Alexa no puede iniciar una conversación.** Es la restricción más importante del
   proyecto y contradice la expectativa natural de un producto de recordatorios. Se
   documentó en `ARCHITECTURE.md` §2, se decidió un MVP pull (**D018**) y se
   registró como **R01**. Requiere confirmación del alcance (decisión pendiente 7).
2. **Account Linking no resuelve el problema de identificar al adulto**: daría la
   identidad del cuidador. Se diseñó un mecanismo propio de vinculación (**D009**).
3. **El ASR no es confiable con nombres de medicamentos** (**R06**): se rediseñó el
   flujo de confirmación para no depender del nombre.
4. Dos adultos compartiendo un solo Echo no son distinguibles (**R02**): limitación
   declarada, no resuelta.

**Decisiones:** D001, D002, D005, D006, D007, D008, D010, D012, D013, D014, D016,
D017, D018, D019, D020 tomadas. D003, D004, D009, D011, D015 pendientes de
confirmación, con implementación provisoria definida para no bloquear.

**Pendientes:** respuesta a las 5 decisiones pendientes bloqueantes + aprobación para
iniciar la Iteración 1.

---

### 2026-09-29 (2) — Iteración 0 · cierre de decisiones bloqueantes

**Fecha:** 2026-09-29
**Iteración:** 0 — Arquitectura y documentación

**Tareas abordadas:** obtener respuesta a las cinco decisiones bloqueantes y propagar
sus consecuencias a la documentación.

**Cambios realizados:**

- **D003 → TOMADA:** relación N:N mediante `CaregiverAccess`. Sin cambios de diseño
  (era la implementación provisoria).
- **D004 → TOMADA:** dos roles, `OWNER` y `CAREGIVER`, con la matriz de
  `DATA_MODEL.md` §3.3. Sin cambios de diseño.
- **D009 → TOMADA:** código de 4 dígitos, sin Account Linking, tampoco como paso
  previo a una publicación pública. Sin cambios de diseño.
- **D011 → TOMADA:** email transaccional + aviso en el panel. La elección del
  proveedor pasa a ser un detalle de implementación de la Iteración 15, con el
  requisito de dominio propio verificado con SPF/DKIM.
- **D015 → TOMADA, y difiere de la recomendación:** el usuario eligió **VPS propio**
  en lugar de una PaaS de pago bajo. Consecuencias propagadas:
  - `ARCHITECTURE.md` §9 reescrito con la topología de VPS (Nginx + Let's Encrypt +
    Mongo en localhost + systemd).
  - **Iteración 19 reescrita**: se agregaron 14 tareas de administración de sistemas
    (hardening de SSH, `ufw`, `fail2ban`, `unattended-upgrades`, swap, NTP, Mongo solo
    en localhost, backups cifrados fuera del VPS con restauración probada, renovación
    automática de TLS verificada, gestor de procesos, `logrotate`, script de deploy,
    monitoreo de disco) y sus criterios de aceptación verificables.
  - `SECURITY.md` §10 y §13 ampliados con los controles del servidor.
  - Riesgos nuevos **R12** (carga operativa) y **R13** (Mongo en el mismo host);
    **R09** (cold start) baja a probabilidad baja porque queda mitigado por
    construcción. Deuda nueva **DT10** (infraestructura sin IaC).
- Ninguna decisión quedó sin resolver entre las bloqueantes. Las iteraciones 3, 12, 15
  y 18 ya no arrancan con dependencias abiertas.

**Tests ejecutados:** ninguno (no hay código). Verificación de coherencia entre
documentos, esta vez con revisión automatizada de enums, rutas y referencias cruzadas.

**Resultado:** documentación cerrada y consistente. Iteración 0 lista, a la espera de
aprobación para iniciar la Iteración 1.

**Problemas encontrados:**

1. Un reemplazo automático de texto en `ROADMAP.md` cortó en el lugar equivocado
   (`"#### Riesgos"` contiene `"## Riesgos"` como subcadena) y duplicó el bloque de
   iteraciones. Detectado con una verificación de secciones, reparado, y verificado que
   las 20 iteraciones y las 20 decisiones quedaron únicas e íntegras.
2. Se corrigió una inconsistencia residual: el ejemplo de código de vinculación en
   `API.md` tenía 6 dígitos cuando la decisión es de 4.

**Decisiones:** D003, D004, D009, D011, D015 cerradas.

**Pendientes:** aprobación para iniciar la Iteración 1. Queda abierta la decisión
pendiente A (alcance de la proactividad), que no bloquea ninguna iteración pero
conviene cerrar antes de la Iteración 20.

---

### 2026-09-29 (3) — Iteración 0 · cambio de alcance: proactividad, y cierre

**Fecha:** 2026-09-29
**Iteración:** 0 — Arquitectura y documentación

**Tareas abordadas:** incorporar Alexa Reminders API al alcance del MVP por decisión de
producto del usuario; analizar la API contra documentación oficial vigente antes de
diseñar; propagar el cambio a los diez documentos; verificar consistencia; cerrar la
iteración.

**Cambios realizados:**

- **Investigación previa al diseño**, contra documentación oficial de Amazon consultada
  hoy (fuentes listadas en `ALEXA_REMINDERS.md` §9). Cada afirmación del documento nuevo
  está marcada como **[VERIFICADO]** o **[SIN VERIFICAR]**, y el diseño está construido para
  no depender de ningún ítem sin verificar.
- **Hallazgo bloqueante del flujo pedido, documentado antes de diseñar cualquier
  workaround:** *"You can't use an out-of-session token to create a reminder, but you can
  use the out-of-session token to edit or delete a reminder"*. La creación exige una sesión
  activa de la skill (error `NOT_IN_SESSION`), así que **Chatio no puede crear el aviso en
  el momento en que el familiar guarda la medicación en el panel**. Se evaluaron y
  descartaron por escrito cuatro caminos alternativos (Skill Messaging API, pool de avisos
  placeholder, token fuera de sesión, reminders manuales) antes de aceptar la limitación.
- **Diseño adoptado:** reconciliador declarativo. Chatio calcula el **estado deseado** al
  escribir medicamentos (local, sin red) y lo **aplica en la próxima sesión** del adulto con
  la skill, con la sesión de vinculación como arranque. El bucle se sostiene solo porque los
  avisos hacen que el adulto abra la skill a diario.
- **Hallazgo que mejora el producto:** el **consentimiento por voz** existe y **soporta el
  scope de reminders** (`Connections.StartConnection` →
  `connection://AMAZON.AskForPermissionsConsent/2`). El adulto puede otorgar el permiso
  diciendo solo "sí", sin tocar la app Alexa. Esto desarma el argumento de onboarding sobre
  el que se apoyaba **D018**.
- **Documento nuevo:** `docs/ALEXA_REMINDERS.md` (permisos, consentimiento, endpoints,
  RRULE, límites, errores, revocación, offline, identificadores a persistir, idempotencia,
  reintentos y verificaciones pendientes).
- **Modelo de datos:** colección nueva `alexa_reminder_syncs` con su máquina de estados, más
  `reminderPermission` y `apiEndpoint` en `AlexaLink`, y ocho tipos nuevos de
  `ActivityEvent`. **`Medication` y `MedicationOccurrence` no recibieron ni un campo de
  Alexa**: todo el acoplamiento vive en una sola colección y un solo servicio (**D021**).
- **Granularidad por franja horaria** (**D022**): dos medicamentos a las 09:00 producen un
  aviso, no dos. Efecto secundario valioso: agregar un medicamento en una franja existente
  no genera ninguna llamada a Alexa, así que la creación —la operación restringida— es la
  más rara.
- **Texto del aviso sin datos de salud** (**D023**): *"Es hora de tu medicación. Decí:
  Alexa, abre chatio."* Amazon almacena ese texto, se ve en la app y lo escucha toda la
  casa. Además elimina una clase entera de desincronización, porque el texto no depende del
  contenido de la medicación.
- **Invariante explícito, con test dedicado:** ninguna operación de la integración —creación,
  actualización o emisión— puede alterar una `MedicationOccurrence`. **Un recordatorio
  emitido no es una toma confirmada.** Documentado en `ARCHITECTURE.md` §2,
  `DATA_MODEL.md` §3.11 y `ALEXA_REMINDERS.md` §5.1, con su test en `TESTING.md` §3.1.
- **Copy normativo en la UI** (`FRONTEND.md` §1): tabla de vocabulario obligatorio. Nunca
  "Medicamento tomado", siempre *"María confirmó que tomó Losartán 50 mg"*; y "aviso
  programado" nunca se muestra como "aviso escuchado".
- **Solicitudes de ayuda:** sin cambios de alcance (email + panel, **D011**), pero se
  reforzó en `SECURITY.md` §12 la declaración de que **no es un sistema de emergencias**, sin
  garantía de entrega ni de tiempo de respuesta.
- **Roadmap:** nueva **Iteración 16 — Recordatorios proactivos**, que **empieza verificando
  la plataforma en un Echo real en `es-MX` antes de escribir la integración**; las
  iteraciones siguientes se renumeraron (Seguridad 17, Testing 18, Deploy 19, Validación
  20). **D018** quedó `SUPERSEDED` por **D021**, conservada con su motivo original y el
  motivo de la revisión. Decisiones nuevas D021–D024. Riesgos: **R01 cerrado**, nuevos
  **R14** (latencia por la restricción de creación), **R15** (comportamiento real en
  `es-MX`), **R16** (el familiar sobreestima la garantía) y **R17** (dependencia de
  plataforma). **DT04 cerrada**, nuevas **DT11** y **DT12**.

**Tests ejecutados:** ninguno (no hay código todavía). Verificación de consistencia
documental: secciones únicas por documento, 21 iteraciones y 24 decisiones sin duplicados,
referencias cruzadas resueltas, enums y rutas coherentes entre `DATA_MODEL.md`, `API.md`,
`ALEXA_SKILL.md` y `ALEXA_REMINDERS.md`.

**Resultado:** **Iteración 0 COMPLETADA.** Los diez documentos están escritos, consistentes
y con decisiones concretas; no queda ningún criterio de aceptación pendiente ni ninguna
decisión bloqueante.

**Problemas encontrados:**

1. El flujo pedido no se puede implementar exactamente como estaba dibujado: la creación del
   reminder no puede ocurrir en el instante en que el familiar configura la medicación. Es
   una limitación de plataforma, está documentada con su cita, y el diseño la absorbe sin
   workarounds frágiles. El precio es una latencia de hasta una sesión, visible en el panel.
2. El soporte real de la Reminders API en `es-MX` **no está confirmado por la documentación**
   (la referencia solo ejemplifica `en-US`; un blog oficial afirma disponibilidad general).
   Por eso la Iteración 16 arranca con verificación empírica y con la instrucción explícita
   de detenerse y reportar si falla, en lugar de improvisar.
3. La documentación de eventos de skill describe la recepción en Lambda y no aclara si un
   endpoint HTTPS propio los recibe. El diseño **no depende de esos eventos**: la revocación
   se detecta reactivamente por `401` y la deriva por el `GET` de la lista.
4. Al editar el roadmap volví a cortar mal un bloque por la misma razón que la vez anterior
   (`"#### Riesgos"` contiene `"## Riesgos"`), lo que duplicó la sección de decisiones.
   Detectado con la verificación de secciones y reparado; de acá en adelante los cortes se
   anclan con saltos de línea.

**Decisiones:** D021 (supersede D018), D022, D023, D024. D018 conservada con trazabilidad.

**Pendientes:** **autorización del usuario para comenzar la Iteración 1.** No se inicia sin
ella. Lo único abierto son cuatro verificaciones empíricas de plataforma, todas dentro de la
Iteración 16 y todas con comportamiento por defecto ya definido.

---

### 2026-09-29 (4) — Iteración 1 · Base del backend

**Fecha:** 2026-09-29
**Iteración:** 1 — Base del backend

**Archivos creados (26)**

```text
.gitignore                         .env.example
.github/workflows/ci.yml

backend/package.json               backend/package-lock.json
backend/eslint.config.js           backend/.prettierrc.json
backend/.prettierignore            backend/vitest.config.js

backend/src/app.js                 backend/src/server.js
backend/src/lifecycle.js
backend/src/config/env.js          backend/src/config/logger.js
backend/src/config/db.js
backend/src/lib/errors.js
backend/src/middleware/requestId.js    backend/src/middleware/httpLogger.js
backend/src/middleware/error.js        backend/src/middleware/notFound.js
backend/src/middleware/validate.js     backend/src/middleware/rateLimit.js
backend/src/modules/health/health.routes.js
backend/src/modules/health/health.controller.js
backend/src/modules/health/health.service.js

backend/tests/helpers/createTestApp.js  backend/tests/helpers/memoryMongo.js
backend/tests/config.env.test.js        backend/tests/db.test.js
backend/tests/errors.test.js            backend/tests/health.test.js
backend/tests/lifecycle.test.js         backend/tests/logger.test.js
backend/tests/middleware.test.js        backend/tests/security.test.js
```

**Archivos modificados**

`ROADMAP.md` · `README.md` · `docs/API.md` (§16 healthchecks, §2 código 413, §15
`req.validated`) · `docs/ARCHITECTURE.md` (§7 entorno por iteración, §8 healthchecks, §3
separación app/server) · `docs/SECURITY.md` (§8 convenciones de logging).

**Dependencias agregadas y por qué**

Producción (9): `express` 4.22.3 (**D020**) · `mongoose` 8.24.4 · `zod` 4.6.5 (validación
de entorno y de entrada) · `helmet` 8.3.0 y `cors` 2.8.6 (SECURITY.md §10) ·
`express-rate-limit` 7.5.1 (API.md §14) · `pino` 9.14.0 y `pino-http` 10.5.0 (logging
estructurado con redacción) · `dotenv` 16.6.1.

Desarrollo (10): `vitest` 5.0.2 y `@vitest/coverage-v8` 5.0.2 · `supertest` 7.3.0 ·
`mongodb-memory-server` 10.4.3 · `eslint` 10.11.0, `@eslint/js`, `globals`,
`eslint-config-prettier` 10.1.8 · `prettier` 3.9.9 · `pino-pretty` 13.1.3 (solo desarrollo).

Todas con versión **exacta** (**D027**). **No** se instalaron `bcrypt`, `jsonwebtoken`,
`cookie-parser`, `luxon`, `node-cron` ni `ask-sdk-*`: pertenecen a iteraciones posteriores.

**Tests ejecutados**

```text
npx eslint .                 -> sin errores
npm run format:check         -> All matched files use Prettier code style!
npm test                     -> Test Files 8 passed (8) · Tests 92 passed (92)
npm run test:coverage        -> Statements 95.54% · Branches 90.83% · Lines 96.38%
npm audit --audit-level=high -> found 0 vulnerabilities
```

Verificación manual del proceso real (criterios 3 a 6 de la validación final), con un
MongoDB en memoria porque esta máquina no tiene `mongod`:

```text
1. Sin MONGODB_URI            -> exit 1 · "MONGODB_URI: es obligatoria"
2. production, CORS vacío
   y LOG_LEVEL=debug          -> exit 1 · nombra las dos variables, sin mostrar valores
3. Válida sin Mongo           -> arranca · /health 200 {"status":"ok"}
                                        · /ready  503 {"status":"unavailable",
                                                       "checks":{"db":"down"}}
4. Válida con Mongo           -> /health 200 · /ready 200 {"checks":{"db":"up"}}
                                 /no-existe 404 con envoltorio y requestId
                                 Log: "Conexión a MongoDB establecida" (attempt 1)
```

**Resultado:** Iteración 1 **COMPLETADA**. Los ocho criterios de aceptación se verificaron
uno por uno (ver la sección de la iteración). El único que quedó parcial es la CI: está
definida y sus cuatro comandos pasan localmente, pero no pudo ejecutarse en GitHub porque el
repositorio no tiene remoto y no se hicieron operaciones remotas (**DT16**).

**Problemas encontrados**

1. **Contradicción en la documentación, reportada antes de tocar contratos.** La tarea de
   esta iteración pedía `GET /api/v1/health` y `/api/v1/health/ready`; su propio criterio de
   aceptación pedía `GET /health`; `API.md` §16 documentaba las versionadas; y la consigna
   del usuario pedía `/health` y `/ready`. Resuelto con **D025** (sin versionar) y
   propagado a `API.md` y `ARCHITECTURE.md`.
2. **Bug propio encontrado por un test: la redacción tapaba el código de error.** La lista
   de campos sensibles incluía `code` —por el código de vinculación— y eso redactaba
   también el campo `code` del contrato de errores: los logs salían con
   `"code":"[redactado]"` en lugar de `VALIDATION_ERROR`, dejándolos sin capacidad de
   diagnóstico. Corregido: la redacción es por nombre semántico (`pairingCode`, `codeHash`,
   `verificationCode`) y `code` a secas ya no se redacta. Convención documentada en
   `SECURITY.md` §8.
3. **Zod 4 cambió el significado de `.default()` sobre esquemas con `transform`.** Ahora el
   default es el valor de **salida** y no pasa por el transform, así que
   `CORS_ORIGINS` devolvía `''` en lugar de `[]`. Lo detectó el primer test que corrí.
   Corregido y comentado en el código para que no vuelva a pasar.
4. **Zod 4 no pone la clave desconocida en `issue.path`.** La reporta en `issue.keys` con
   `path` apuntando al objeto, así que el `details` del contrato perdía el nombre del campo
   que sobraba y el frontend no podría señalarlo. `zodIssuesToDetails` ahora expande un
   detalle por clave (`body.isAdmin` + "propiedad no reconocida"). Documentado en
   `API.md` §15.
5. **El cierre ordenado no se puede verificar en Windows.** `child.kill('SIGTERM')` termina
   el proceso forzosamente (exit code `null`, sin ejecutar los handlers), así que los logs
   de cierre nunca aparecen. En lugar de dar por bueno el código sin evidencia, se extrajo
   la lógica a `src/lifecycle.js` y se cubrió con 9 tests unitarios (orden, idempotencia,
   fallo al cerrar, fallo al desconectar, timeout que fuerza la salida). La entrega real de
   la señal queda por verificar en Linux (**DT14**).
6. **`eslint@9` avisa que ya no tiene soporte.** Se subió a ESLint 10, y de paso a las
   mayores actuales de Zod y Vitest (**D027**). Express se dejó en 4 porque cambiarlo sería
   modificar **D020** en silencio; queda como **DT13** con la evaluación pendiente.
7. **Node 22.13.0 en esta máquina**, no Node 20 como decía la dependencia de la iteración.
   Node 22 también es LTS; `engines` quedó en `>=20.11` y la CI corre en 22. Sin impacto.
8. `cookie-parser` figuraba en las tareas de esta iteración pero sin autenticación no
   parsea nada útil: **movido a la Iteración 2** en lugar de sumar una dependencia sin uso.

**Decisiones:** **D025** (healthchecks sin versionar, fuera del contrato de la API),
**D026** (el esquema de entorno crece por iteración), **D027** (ESM, versiones exactas,
Express 4, Zod 4, ESLint 10, Vitest 5).

**Deuda técnica:** **DT13** (Express 4 con Express 5 estable) · **DT14** (cierre ordenado
sin verificar ante señal real) · **DT15** (interoperabilidad ESM ↔ `ask-sdk`, que es CJS) ·
**DT16** (la CI nunca se ejecutó: no hay remoto).

**Pendientes:** autorización del usuario para comenzar la **Iteración 2 — Autenticación y
autorización**. Nada del alcance de la Iteración 1 quedó sin hacer, salvo `cookie-parser`,
que se movió deliberadamente a la 2. No se implementó nada de iteraciones futuras: no hay
modelos de dominio, ni autenticación, ni endpoints de negocio, y el router de `/api/v1` está
marcado con un comentario en `app.js` pero no existe.

---

### 2026-09-29 (5) — Iteración 2 · Autenticación y autorización

**Fecha:** 2026-09-29
**Iteración:** 2 — Autenticación y autorización

**Archivos creados (17)**

```text
backend/src/models/user.model.js
backend/src/models/authSession.model.js
backend/src/modules/auth/auth.service.js      backend/src/modules/auth/auth.controller.js
backend/src/modules/auth/auth.routes.js       backend/src/modules/auth/auth.schemas.js
backend/src/modules/auth/tokens.js            backend/src/modules/auth/password.js
backend/src/modules/admin/admin.routes.js
backend/src/middleware/auth.js
backend/src/lib/securityLog.js                backend/src/lib/cookies.js
backend/src/routes.js
backend/scripts/seedAdmin.js
backend/tests/helpers/authFixtures.js
backend/tests/auth.user.test.js               backend/tests/auth.login.test.js
backend/tests/auth.refresh.test.js            backend/tests/auth.session.test.js
backend/tests/auth.cycle.test.js
```

**Archivos modificados**

`backend/src/config/env.js` (10 variables nuevas) · `backend/src/app.js` (cookie-parser y
montaje de `/api/v1`) · `backend/src/middleware/rateLimit.js` (limitadores de login y
refresh, con normalización de IP propia) · `backend/package.json` (script `seed:admin`) ·
`.env.example` · `docs/API.md` · `docs/DATA_MODEL.md` · `docs/SECURITY.md` ·
`docs/TESTING.md` · `ROADMAP.md` · 4 archivos de tests de la Iteración 1 (los entornos de
prueba necesitaban los secretos nuevos).

**Dependencias agregadas y por qué**

`bcrypt` 6.0.0 (hash de contraseñas, SECURITY.md §3; compiló sin problemas en Windows, así
que el riesgo de la iteración no se materializó y no hizo falta `bcryptjs`) ·
`jsonwebtoken` 9.0.3 (firma y verificación HS256 de los dos tokens) · `cookie-parser` 1.4.7
(leer la cookie de refresh; venía diferido de la Iteración 1). Las tres estaban previstas en
**D020**. No se agregó ninguna otra: la validación usa el Zod que ya estaba y el hash de los
refresh tokens usa `node:crypto`.

**Tests ejecutados**

```text
npx eslint .                 -> sin errores
npm run format:check         -> All matched files use Prettier code style!
npm test                     -> Test Files 13 passed (13) · Tests 188 passed (188)
npm run test:coverage        -> Statements 94.64% · Branches 86.80% · Lines 95.84%
npm audit --audit-level=high -> found 0 vulnerabilities
```

96 tests nuevos. Verificación manual del seed contra una base real:

```text
1. Sin variables del seed      -> exit 1, nombra las cuatro variables que faltan
2. Contraseña común            -> exit 1, "es demasiado común: elegí una distinta"
3. --generate-password         -> exit 0, contraseña mostrada UNA vez; al log solo el userId
4. Repetir el seed             -> exit 0, "ya existe y ya es administrador", sin cambios
5. Login del admin sembrado    -> 200, isPlatformAdmin true
   Cookie: chatio_rt=<token>; Max-Age=604800; Path=/api/v1/auth; HttpOnly; SameSite=Strict
   GET /me                     -> 200, seis campos, adults: []
```

**Resultado:** Iteración 2 **COMPLETADA**. Los nueve criterios de aceptación verificados, y
el ciclo completo del criterio fundamental demostrado en `auth.cycle.test.js`:
login → API autenticada → expiración real del access → refresh → rotación → nuevo
access → logout → refresh inválido; y R1 → R2 → replay de R1 → rechazado con la sesión
revocada.

**Problemas encontrados**

1. **Contradicción real en la documentación, y es la más importante de esta iteración.**
   `API.md` §3 exigía que un refresh *reusado* devolviera 401, pero el único mecanismo que
   especificaba era `refreshTokenVersion`. Con eso es imposible: R1 y R2 llevan el mismo
   `tv`, así que los dos son válidos hasta expirar. El criterio de aceptación del propio
   roadmap ("reusar el anterior devuelve 401") no era alcanzable con el diseño documentado.
   Resuelto con **D028** (colección `auth_sessions` con el hash del token vigente), cuatro
   alternativas evaluadas por escrito, y la documentación actualizada.
2. **Zod 4 y los mensajes en español.** Dos campos del seed caían al mensaje por defecto en
   inglés ("Invalid input: expected string, received undefined") porque `z.string()` sin
   `error` no lo traduce. Detectado en la verificación manual del seed, no por un test.
   Corregido.
3. **`express-rate-limit` 7.5.1 no exporta `ipKeyGenerator`**, que es lo que la
   documentación sugiere para claves con IP seguras en IPv6. Se implementó `ipKey()` propio,
   que agrupa IPv6 por su `/64` — si se contara por dirección exacta, un cliente con un /64
   entero se saltearía la cuota rotando de dirección.
4. **La redacción del logger tapaba el email en un assert de test**, lo que en realidad
   confirmó que funciona: el test de auditoría verifica que el email **no** aparezca en los
   logs y pasa por eso mismo.
5. **Dos refresh concurrentes son indistinguibles de un replay.** Es inherente a la
   detección de reutilización, no un bug: cualquier ventana de gracia la debilitaría. Se
   testeó explícitamente (uno rota, el otro recibe 401) y se convirtió en un requisito del
   frontend —refresh de vuelo único— documentado en `API.md` §3 y anotado como **DT17**.
6. **Los tests de la Iteración 1 se rompieron al hacer obligatorios los secretos.** Es el
   comportamiento correcto (**D026**: el esquema crece y valida de verdad); se actualizaron
   los entornos de prueba, centralizados en `baseTestEnv`.
7. El modelo declaraba el índice de email dos veces (`unique: true` más `schema.index()`) y
   Mongoose avisaba de índice duplicado. Corregido.

**Decisiones:** **D028** (sesiones persistidas para rotación y detección de reutilización;
extiende D001, renombra `refreshTokenVersion` a `tokenVersion` y quita el email del access
token), **D029** (`requireAuth` valida contra la base en cada request), **D030** (CSRF por
`SameSite=Strict`, sin librería, con la condición de despliegue same-site).

**Tareas movidas:** `requireAdultAccess` y `requireRole` → **Iteración 3**. Motivo:
dependen de `Adult` y `CaregiverAccess`, que son las entidades contra las que consultan.
Implementarlas ahora exigiría inventar un modelo ficticio o simular una autorización no
verificable. El patrón quedó documentado en `SECURITY.md` §4 y el principio —la identidad
sale del token, nunca de la URL— ya está testeado sobre los endpoints existentes
(`/auth/me` con `?userId=` de otro usuario devuelve el propio).

**Deuda técnica:** **DT17** (refresh de vuelo único en el frontend) · **DT18** (no hay
listado ni revocación de sesiones activas; el modelo ya lo soporta) · **DT19**
(`requireAuth` hace una lectura por request, consecuencia aceptada de D029).

**Pendientes:** autorización del usuario para comenzar la **Iteración 3 — Adultos y
cuidadores**, que arranca con las dos tareas movidas. No se implementó nada de la Iteración
3: no existen `Adult`, `CaregiverAccess`, ni ningún endpoint de negocio; el router de
`/api/v1` solo monta `auth` y `admin`.

---

### 2026-10-02 — Iteración 3 · Adultos y cuidadores

**Fecha:** 2026-10-02  · **Iteración:** 3  · **Estado:** COMPLETADA

**Implementado**

- Modelos `Adult`, `CaregiverAccess` y el modelo de escritura mínima `ActivityEvent`.
- Validación estricta de nombres, fechas, contactos, consentimiento y zonas horarias IANA
  con Luxon.
- Creación transaccional de Adult + acceso OWNER inicial.
- `GET/POST /api/v1/adults`, `GET/PATCH /api/v1/adults/:adultId`, activate/deactivate.
- `GET/POST/PATCH/DELETE /api/v1/adults/:adultId/caregivers`.
- `requireAdultAccess` revalida `userId + adultId + ACTIVE` contra MongoDB en cada request;
  `requireRole('OWNER')` aplica la matriz de permisos.
- `/auth/me` devuelve adultos accesibles, rol y campos neutros para Alexa/ayuda futura.
- Auditoría mínima de `ADULT_UPDATED`, `CAREGIVER_GRANTED`, `CAREGIVER_REVOKED` y
  `CAREGIVER_ROLE_CHANGED`.
- Consentimiento explícito obligatorio (`consentConfirmed: true`) y registro interno de
  fecha, usuario y versión de la declaración.

**Seguridad y consistencia**

- Recursos ajenos responden 404; IDs mal formados responden 400.
- Se rechaza mass assignment con schemas Zod estrictos.
- Accesos revocados dejan de funcionar inmediatamente aunque el JWT siga vigente.
- El último OWNER no puede revocarse ni degradarse; los cambios concurrentes se serializan
  dentro de una transacción que toma el lock del Adult.
- Los tests de Mongo usan `MongoMemoryReplSet` de un nodo para verificar transacciones
  reales; el despliegue del MVP queda documentado como replica set de un nodo.

**Tests ejecutados**

```text
npm run lint           -> sin errores
npm run format:check  -> All matched files use Prettier code style!
npm test              -> Test Files 14 passed (14) · Tests 201 passed (201)
npm run test:coverage -> Statements 88.88% · Branches 80.29% · Lines 91.71%
npm audit --audit-level=high -> found 0 vulnerabilities
```

**Decisiones:** D031 (transacciones y serialización por Adult) · D032 (auditoría mínima y
valores neutros en `/auth/me`) · D033 (consentimiento explícito y versionado).

**Archivos principales:** `backend/src/models/{adult,caregiverAccess,activityEvent}.model.js` ·
`backend/src/middleware/authorize.js` · `backend/src/modules/{adults,caregivers,activity}/**` ·
`backend/tests/adults.test.js` · documentación normativa actualizada.

**Resultado:** Iteración 3 COMPLETADA. No se implementó Iteración 4, medicamentos, Alexa ni
frontend. Próximo paso: esperar aprobación para comenzar la Iteración 4.

---

### 2026-10-02 — Iteración 4 · Medicamentos y horarios

**Fecha:** 2026-10-02 · **Iteración:** 4 · **Estado:** COMPLETADA

**Implementado**

- Modelo `Medication` con `schedule` embebido, enums cerrados, `graceMinutes`, índices
  por adulto/estado y soft delete. No se agregó una colección `MedicationSchedule` ni
  `MedicationOccurrence`.
- Validación estricta de nombre, dosis, unidades, horarios `HH:mm`, días `0..6`, fechas
  locales y rango de vigencia; el servidor normaliza el orden de horas y días.
- CRUD protegido bajo `requireAuth` + `requireAdultAccess`; OWNER y CAREGIVER pueden
  gestionar medicamentos según la matriz aprobada.
- Próxima ocurrencia calculada con Luxon desde la timezone del Adult y expuesta como UTC
  más `{ date, time, timezone }` local. La timezone no se duplica en `Medication`.
- Adultos `INACTIVE` conservan lecturas, pero rechazan escrituras de medicamentos con
  `422 BUSINESS_RULE`.
- Auditoría de creación, edición, activación y desactivación con payload mínimo que no
  contiene nombre, dosis ni indicaciones.
- La integración Alexa y `AlexaReminderSync` quedan fuera de esta iteración; la respuesta
  usa `remindersPendingSync: false` como valor neutro hasta la iteración correspondiente.

**Seguridad y consistencia**

- Consultas de recursos siempre combinan `adultId` con `medicationId`, y los recursos
  inaccesibles responden 404.
- Se verificaron token ausente, acceso revocado, cuidador ajeno, mass assignment y
  aislamiento entre adultos.
- Los tests usan replica set de Mongo en memoria para verificar las transacciones de las
  escrituras y conservan el documento al hacer soft delete.

**Tests ejecutados**

```text
npm run lint           -> sin errores
npm run format:check   -> All matched files use Prettier code style!
npm test               -> Test Files 16 passed (16) · Tests 214 passed (214)
npm run test:coverage  -> Statements 89.62% · Branches 80.51% · Lines 93.04%
npm audit --audit-level=high -> found 0 vulnerabilities
```

**Decisiones:** D034 (adultos inactivos, activación diferenciada y forma de la próxima
ocurrencia). Alexa, ocurrencias y frontend no se implementaron.

**Archivos principales:** `backend/src/models/medication.model.js` ·
`backend/src/modules/medications/**` · `backend/src/lib/time.js` ·
`backend/tests/medications.test.js` · `backend/tests/time.test.js` · contratos API y
modelo de datos actualizados.

**Resultado:** Iteración 4 COMPLETADA. Próximo paso: esperar aprobación para comenzar la
Iteración 5 — Ocurrencias y confirmaciones.

---

### 2026-10-02 — Iteración 5 · Ocurrencias y confirmaciones

**Fecha:** 2026-10-02 · **Iteración:** 5 · **Estado:** COMPLETADA

**Implementado**

- Modelo `MedicationOccurrence` con estados `PENDING`, `TAKEN`, `SKIPPED` y `MISSED`,
  snapshot inmutable, `source`, confirmación declarada y los cuatro índices aprobados.
- Materializador de 48 horas con conversión local/UTC, DST, vigencia, adulto activo,
  medicamento activo y upsert idempotente sobre `{ medicationId, scheduledAt }`.
- Re-materialización al cambiar una medicación o la timezone del adulto: solo elimina
  pendientes futuras; estados resueltos e historial permanecen intactos.
- Sweeper cada 10 minutos: `PENDING` pasa a `MISSED` después de `graceMinutes` y emite
  un evento genérico sin datos clínicos.
- Confirmación y omisión con transiciones condicionales, ventana de `-60` minutos a
  `+graceMinutes`, confirmación tardía desde WEB, source ALEXA disponible para el servicio,
  idempotencia y concurrencia segura.
- Endpoints protegidos para listar ocurrencias con filtros/cursor y confirmar u omitir;
  todos revalidan `requireAdultAccess` y mantienen 404 para recursos inaccesibles.
- Jobs separados `materializeOccurrences`, `sweepOccurrences` y scheduler de `node-cron`,
  invocables directamente en tests y conectados al arranque/cierre del proceso.

**Semántica y privacidad**

- `TAKEN` significa únicamente “se registró una confirmación declarada”; no prueba la
  ingesta física. `MISSED` significa que no se registró confirmación dentro de la ventana.
- Los eventos solo contienen el `occurrenceId`, source y un resumen genérico; no contienen
  nombre, dosis ni indicaciones. No se agregó ninguna ruta ni integración Alexa.
- Adultos inactivos no generan nuevas ocurrencias y conservan las ya materializadas.

**Tests ejecutados**

```text
npm run lint           -> sin errores
npm run format:check   -> All matched files use Prettier code style!
npm test               -> Test Files 18 passed (18) · Tests 235 passed (235)
npm run test:coverage  -> Statements 87.50% · Branches 79.34% · Lines 91.06%
npm audit --audit-level=high -> found 0 vulnerabilities
```

**Decisiones:** D035 (identidad única, ventana de 48 horas, re-materialización,
confirmación declarada e idempotencia/concurrencia). Se mantuvieron D005, D006 y D013.

**Archivos principales:** `backend/src/models/medicationOccurrence.model.js` ·
`backend/src/modules/occurrences/**` · `backend/src/jobs/**` ·
`backend/tests/occurrences.test.js` · `backend/tests/occurrenceJobs.test.js`.

**Resultado:** Iteración 5 COMPLETADA. Próximo paso: esperar aprobación para comenzar la
Iteración 6 — Recordatorios y agenda diaria.
