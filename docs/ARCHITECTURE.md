# Arquitectura — Chatio MVP

Versión 1.0 · Iteración 0 · 2026-09-29

Este documento define la arquitectura del MVP, revisa la arquitectura propuesta
inicialmente, y deja explícitas las restricciones técnicas reales de Alexa que
condicionan el producto.

---

## 1. Revisión de la arquitectura propuesta

La arquitectura conceptual planteada es correcta y suficiente para el MVP. Se
confirma el enfoque monolítico modular: **una sola aplicación Node/Express** que
atiende al panel web y a la skill de Alexa, con MongoDB como única persistencia.
No se introducen microservicios, colas ni orquestadores.

Se proponen cinco ajustes concretos:

### A1 · El endpoint de la skill vive dentro de la API de Chatio (no en AWS Lambda)

La propuesta original dibuja "Alexa Skill" como un componente separado que
consume "Servicios Chatio". Si ese componente fuera una función Lambda,
tendríamos: un segundo artefacto a desplegar, un segundo juego de secretos, y
latencia extra (Alexa → Lambda → API → Mongo) dentro de un presupuesto de
**8 segundos** de timeout.

Alexa Skills Kit admite como backend un **endpoint HTTPS propio** siempre que
tenga certificado válido de una CA pública y se verifique la firma de cada
request. Por lo tanto la skill se sirve desde la misma aplicación Express, en
`POST /alexa/skill`, y sus handlers invocan **directamente la capa de servicios**
(llamadas de función en proceso, no HTTP interno).

Consecuencias: un solo deploy, una sola base de código, cero latencia de red
interna, y la lógica de negocio queda estructuralmente en Chatio. Costo: debemos
implementar la verificación de firma (`ask-sdk-express-adapter` la provee) y el
endpoint queda expuesto públicamente, lo que se mitiga en `SECURITY.md` §6.
Ver decisión **D008**.

### A2 · "Servicios Chatio" no es un componente separado: es la capa de servicios

En el diagrama original "Servicios Chatio" aparece como par de MongoDB. En
realidad es la capa de dominio *dentro* de la API, y es el único lugar donde vive
la lógica de negocio. Tanto los controladores REST como los handlers de Alexa son
**adaptadores delgados** sobre esa capa. Esta es la regla estructural más
importante del proyecto.

### A3 · Hace falta un scheduler en proceso

Nada en el diagrama original genera las **ocurrencias de medicación** ni marca
las no confirmadas. Se agrega un scheduler interno (`node-cron`) con dos jobs:
materializador de ocurrencias y *sweeper* de vencidas. Corre en el mismo proceso
Express, sin colas ni workers externos (ver §5 y decisión **D006**).

### A4 · Hace falta un canal de salida hacia el familiar

La solicitud de ayuda requiere notificar al familiar. Se agrega un servicio de
notificaciones con un único proveedor en el MVP (email transaccional) detrás de
una interfaz `notifier.send()`, para poder sumar canales después sin tocar el
dominio. Ver **D011** (pendiente de confirmación del proveedor).

### A5 · El flujo es híbrido: aviso proactivo + interacción pull

Alexa **avisa** al adulto a la hora de la toma mediante la **Reminders API**
(**D021**), y el adulto entonces abre la skill para saber qué tomar y confirmarlo. La
plataforma impone que el reminder solo pueda **crearse** desde una sesión activa, lo que
obliga a un reconciliador y no a una llamada directa. Ver §2 y `ALEXA_REMINDERS.md`.

### Arquitectura resultante

```text
   Familiar / Cuidador                             Adulto mayor
           |                                             |
           v                                             v
   React + Vite (SPA)                             Amazon Echo
           |                                             |
      HTTPS / JSON                            Alexa Cloud (ASR + TTS)
           |                                             |
           |                                    HTTPS + firma ASK
           v                                             v
  +----------------------------------------------------------------+
  |                  API Chatio  (Node + Express)                  |
  |                                                                |
  |   /api/v1/*  (REST, JWT)          /alexa/skill  (ASK verified) |
  |        |                                   |                   |
  |        v                                   v                   |
  |   Controladores                   Handlers de intents          |
  |        +--------------+--------------------+                   |
  |                       v                                        |
  |            CAPA DE SERVICIOS (dominio)                         |
  |   adults · medications · occurrences · reminders · agenda ·    |
  |   activity · help · alexaLink · notifications ·                |
  |   reminderSync  ──────────────► Alexa Reminders API            |
  |                (solo en sesión)                                |
  |                       |                                        |
  |        +--------------+--------------+                         |
  |        v              v              v                         |
  |    Mongoose      Scheduler      Notifier                       |
  |        |        (node-cron)          |                         |
  +--------+-----------------------------+-------------------------+
           v                             v
      MongoDB (VPS)              Proveedor de email
```

---

## 2. Proactividad: qué puede y qué no puede hacer Alexa

Una Custom Skill **no puede iniciar una conversación**: no hay forma de que Chatio haga
que el Echo diga "es hora de tomar Losartán" en el momento en que se cumple el horario.
Lo que sí existe es la **Reminders API**, que crea un recordatorio nativo de Alexa a
nombre del usuario y que **Alexa anuncia sola** a la hora fijada.

| Mecanismo | Qué hace realmente | Decisión |
| :--- | :--- | :--- |
| Respuesta a un request | La skill habla solo como respuesta a algo que el usuario dijo | Base de toda la interacción |
| **Reminders API** | Recordatorio nativo que Alexa anuncia a la hora fijada. Requiere el permiso `alexa::alerts:reminders:skill:readwrite` | **Dentro del MVP (D021)** |
| Proactive Events API | Notificación con chime y anillo amarillo; esquemas predefinidos y el usuario debe preguntar "¿qué notificaciones tengo?". No lee contenido arbitrario | Descartado |
| Notifications / Announcements | No disponibles de forma arbitraria para Custom Skills de terceros | Descartado |

### El flujo del MVP

```text
El familiar configura la medicación en el panel      (fuera de toda sesión Alexa)
        │
        ▼
Chatio registra el horario y recalcula el estado deseado de los avisos
        │
        ▼
Reconciliación en la próxima sesión  ──►  Alexa Reminder creado   (D024)
        │
        ▼
Alexa le avisa al adulto: "Es hora de tu medicación. Decí: Alexa, abre chatio."
        │
        ▼
El adulto abre la skill
        │
        ▼
Chatio consulta la MedicationOccurrence pendiente e informa qué corresponde
        │
        ▼
El adulto confirma verbalmente
        │
        ▼
Chatio registra la confirmación  ──►  el familiar la ve en el panel
```

Cuatro conceptos que el diseño mantiene **separados a propósito**, y que no se colapsan
en ningún punto del código:

1. **Programación** de la medicación (`Medication.schedule`) — la autoría del cuidador.
2. **Recordatorio de Alexa** (`AlexaReminderSync` → `alertToken`) — un efecto en un
   sistema externo, derivado de (1).
3. **Ocurrencia de medicación** (`MedicationOccurrence`) — qué debía tomarse y cuándo,
   generada por nuestro scheduler desde (1).
4. **Confirmación declarada** — una afirmación del adulto o del cuidador sobre (3).

**Invariante con test dedicado: un recordatorio emitido nunca es una toma confirmada.**
Ningún camino de código permite que la creación, actualización o emisión de un reminder
cambie el `status` de una ocurrencia. Y la UI nunca dice "Medicamento tomado": dice
*"María confirmó que tomó Losartán 50 mg"*, porque lo único que tenemos es una
declaración.

### La limitación de plataforma que condiciona el diseño

**Un reminder solo puede crearse desde una sesión activa de la skill** (un token fuera de
sesión sirve para editar y borrar, pero no para crear). Por lo tanto Chatio no puede crear
el aviso en el momento en que el familiar guarda la medicación en el panel.

Solución adoptada: Chatio mantiene el **estado deseado** de los avisos y lo **reconcilia
en la próxima sesión** del adulto con la skill; la sesión de vinculación (Iteración 12) es
el arranque, y desde ahí el bucle se sostiene solo porque los avisos hacen que el adulto
abra la skill a diario. El panel muestra explícitamente los avisos `pendientes de
activación` en lugar de fingir que ya están aplicados.

El análisis completo —permisos, consentimiento por voz, recurrencia RRULE, límites,
errores, revocación, identificadores a persistir y qué queda por verificar
empíricamente— está en **`ALEXA_REMINDERS.md`**, con cada afirmación marcada como
verificada contra documentación oficial o pendiente de verificación. Riesgos asociados:
**R14** (latencia de propagación) y **R15** (soporte real de la API en `es-MX`).

### Otras restricciones de plataforma que condicionan el diseño

- **Timeout de 8 segundos** por request. Todo intent debe resolverse con 1–3 consultas
  indexadas, y la reconciliación de avisos corre con presupuesto acotado y **sin** bloquear
  la respuesta hablada.
- **La sesión muere rápido** (pocos segundos de silencio si no se reprompta). No se puede
  asumir estado conversacional largo.
- **El `userId` de Alexa es opaco y por skill**, estable mientras el usuario no
  deshabilite la skill. Si la deshabilita y la vuelve a habilitar, cambia: la vinculación
  debe poder rehacerse (ver `ALEXA_SKILL.md` §7) y los `alertToken` viejos dejan de servir.
- **Un Echo es compartido por el hogar.** Alexa no garantiza *quién* habla (los Voice
  Profiles existen pero no son confiables como control de acceso). Por eso Chatio no expone
  por voz más datos que los estrictamente necesarios, y por eso **el texto del aviso no
  menciona el medicamento** (**D023**).

## 3. Capas y reglas estructurales

```text
HTTP / ASK          -> routes + controllers | alexa handlers   (adaptadores)
Validación          -> zod schemas en middleware               (borde)
Autorización        -> middleware requireAuth + requireAdultAccess
Dominio             -> services/*.service.js                   (única lógica)
Persistencia        -> models/*.model.js (Mongoose)
Infraestructura     -> config, logger, mailer, scheduler
```

El código sigue esta separación desde la Iteración 1: `src/app.js` (fábrica de la app,
sin `process.env` ni logger propio) está separada de `src/server.js` (proceso), y el cierre
ordenado vive en `src/lifecycle.js` para poder testearse sin abrir un puerto.

Reglas no negociables:

1. Un controlador no contiene reglas de negocio ni consultas Mongoose directas.
2. Un handler de Alexa **solo** traduce: request ASK → llamada a servicio → texto
   de respuesta. Cero `if` de negocio, cero Mongoose.
3. Un servicio nunca conoce `req`, `res` ni el `HandlerInput` de Alexa. Recibe
   datos planos y un contexto (`{ actor }`).
4. La autorización se resuelve **antes** del servicio, en middleware, y el
   servicio recibe el `adultId` ya autorizado — nunca lo toma de un body sin
   verificar.
5. Toda escritura relevante emite un `ActivityEvent` a través del servicio de
   actividad, no por código duplicado.

Separación explícita pedida en el brief:

| Concern | Dónde vive |
| :--- | :--- |
| Authentication | `middleware/auth.js`, `modules/auth/*` |
| Authorization | `middleware/authorize.js` (`requireAdultAccess`) |
| Business logic | `modules/*/*.service.js` |
| Alexa integration | `src/alexa/**` (handlers, interceptors, respuestas) |

---

## 4. Zonas horarias

Decisión **D013**, cerrada.

- Cada `Adult` tiene un `timezone` IANA obligatorio (ej.
  `America/Argentina/Buenos_Aires`).
- Los horarios configurados por el familiar se guardan como **hora de pared
  local**: `"09:00"` + `daysOfWeek`. Nunca como UTC.
- Cada `MedicationOccurrence` guarda `scheduledAt` en **UTC** (resuelto con la
  timezone del adulto al materializar) y además `localDate` (`"2026-09-29"`) y
  `localTime` (`"09:00"`) desnormalizados, para consultar "el hoy del adulto" con
  un índice simple y sin convertir dentro de la query.
- Todo `Date` se persiste en UTC; la conversión ocurre en los bordes (Luxon).
- El horario de verano se resuelve al materializar, no al configurar. Si un día la
  hora local no existe o se repite por cambio de DST, se aplica el comportamiento
  por defecto de Luxon y se registra en el log del job.
- El frontend muestra siempre la hora **en la zona del adulto**, con etiqueta
  visible, no en la del navegador del familiar.

Justificación: el familiar puede estar en otra zona horaria que el adulto (caso
real y frecuente en este producto). Guardar UTC al configurar rompería los
horarios en cada cambio de DST.

---

## 5. Scheduler: materialización de ocurrencias

Dos jobs `node-cron` en el proceso Express (decisión **D006**):

**Job 1 — Materializador.** Cada hora en el minuto 5, y además al arrancar el
proceso. Para cada `Medication` activa calcula las ocurrencias que caen en la
ventana `[ahora, ahora + 48 h]` y las inserta con `upsert` sobre el índice único
`{ medicationId, scheduledAt }`. Es **idempotente**: correrlo dos veces, o en dos
instancias simultáneas, no duplica.

**Job 2 — Sweeper.** Cada 10 minutos. Pasa a `MISSED` toda ocurrencia `PENDING`
cuyo `scheduledAt + graceMinutes` ya pasó, y emite el `ActivityEvent`
correspondiente. `graceMinutes` es configurable por medicamento (default 180).

Por qué materializar y no calcular al vuelo: necesitamos historial inmutable (qué
debía tomar el adulto *según la configuración de ese día*), un estado `MISSED`
detectable, y confirmaciones por voz que apunten a una ocurrencia concreta. Un
cálculo virtual no puede representar "no confirmó" ni sobrevivir a la edición
posterior del medicamento.

Ventana de confirmación por voz:
`[scheduledAt − 60 min, scheduledAt + graceMinutes]`. Más laxa que la ventana de
10 minutos del prototipo anterior (ONIET), porque allí el dispositivo *avisaba* a
la hora exacta y aquí el adulto pregunta cuando quiere. Ver `DATA_MODEL.md` §4
para la resolución de ambigüedad.

En la Iteración 5 los cambios de horario, dosis, nombre, indicaciones o timezone
eliminan únicamente ocurrencias `PENDING` futuras y las vuelven a materializar con
la configuración nueva cuando el Adult está activo. Las ocurrencias `TAKEN`,
`SKIPPED` o `MISSED` y las ocurrencias ya pasadas son inmutables en sus datos
históricos. Un Adult inactivo no genera nuevas ocurrencias y conserva las ya
materializadas para que el historial no desaparezca.

**Riesgo asumido (R04):** con más de una instancia de la API los jobs corren
duplicados. El `upsert` idempotente y las actualizaciones condicionadas por estado
lo hacen inocuo, pero el MVP se despliega en **una sola instancia**. Si hiciera
falta escalar, se introduce un lock en Mongo (`findOneAndUpdate` sobre una
colección `job_locks` con TTL), no una cola.

Los recordatorios (`Reminder`) **no** se materializan: no se confirman, solo se
leen en la agenda, y se calculan al vuelo. Simplificación deliberada (**D010**).

**Ningún job llama a la Reminders API de Alexa**, y no puede ser de otra forma: la
creación exige una sesión activa (§2). Cuando el cuidador toca un medicamento, el servicio
recalcula el **estado deseado** de los avisos en `AlexaReminderSync` —una escritura local,
sin red— y la aplicación efectiva ocurre en la próxima sesión de la skill, en un
interceptor. Es el mismo patrón que el materializador: estado declarado primero,
reconciliación después, todo idempotente.

---

## 6. Flujos críticos

### 6.1 Consulta de medicación por voz

```text
Adulto: "Alexa, abre Chatio"  ->  LaunchRequest
  1. Verificación de firma ASK + applicationId
  2. Resolver adulto: alexaUserId (+ deviceId) -> AlexaLink -> Adult
     · sin vínculo     -> mensaje de vinculación, termina la sesión
     · adulto inactivo -> mensaje neutro, termina la sesión
  3. agendaService.getToday(adultId) -> resumen corto + pregunta abierta
  4. ActivityEvent: ALEXA_SESSION_STARTED

Adulto: "¿Qué medicamento tengo que tomar?"  ->  GetMedicationIntent
  1. occurrenceService.findConfirmable(adultId, now)
  2. 0 pendientes -> "Por ahora no tenés nada pendiente."
     1 pendiente  -> "Tenés que tomar Losartán, 1 comprimido de 50 mg,
                      después del desayuno. ¿Ya lo tomaste?"
                      (sesión: awaitingConfirmation = occurrenceId)
     N pendientes -> enumera hasta 3 por hora y pregunta cuál
  3. ActivityEvent: MEDICATION_QUERIED

Adulto: "Ya tomé mi medicamento"  ->  ConfirmMedicationIntent
  1. Resuelve objetivo: slot de medicamento -> sesión -> única pendiente
  2. occurrenceService.confirm(occurrenceId, { source: ALEXA })
     · ya confirmada    -> respuesta idempotente, no duplica
     · fuera de ventana -> registra con confirmedOutOfWindow: true
  3. ActivityEvent: MEDICATION_CONFIRMED
  4. "Listo, registré que tomaste Losartán."
```

### 6.2 Solicitud de ayuda

```text
Adulto: "Necesito ayuda"  ->  RequestHelpIntent
  1. helpService.create(adultId, { source: ALEXA })
     · si hay una HelpRequest OPEN de los últimos 15 min, la reutiliza
       (dedupe), suma un intento y no vuelve a notificar
  2. ActivityEvent: HELP_REQUESTED
  3. notifier.send(cuidadores del adulto)   <- asíncrono, no bloquea
  4. "Ya avisé a tu familia. Si es una emergencia médica, llamá al 911."
  5. El panel muestra la solicitud abierta (polling cada 30 s) hasta que un
     cuidador la marca atendida
```

El envío de email **no** ocurre dentro del request de Alexa (presupuesto de 8 s):
se dispara sin esperar, y sus fallos se loguean y se reintentan desde el sweeper.

### 6.4 Reconciliación de avisos proactivos

```text
(A) El familiar guarda un medicamento nuevo a las 21:00     [panel, sin sesión Alexa]
      1. medicationService guarda y re-materializa ocurrencias
      2. reminderSyncService.recalculate(adultId)
           · agrupa los horarios activos en franjas (hora + días)
           · crea/actualiza AlexaReminderSync con status PENDING_*
           · NO llama a Alexa: no hay sesión y la creación la exige
      3. El panel muestra "21:00 — pendiente de activación"

(B) El adulto abre la skill (por el aviso de las 09:00)     [sesión activa]
      1. ReminderSyncInterceptor: ¿hay pendientes para este adulto?
      2. ¿permissionStatus == GRANTED? si no, no se intenta nada
      3. GET /v1/alerts/reminders  -> estado observado
      4. Diferencia y aplica: POST / PUT / DELETE, máximo 6 operaciones y 2 s
      5. Persiste alertToken y status; emite ActivityEvent por cambio efectivo
      6. La respuesta hablada sale igual, aunque la reconciliación falle
```

El paso (B) nunca retrasa lo que el adulto escucha. Si el presupuesto se agota, lo
pendiente queda para la próxima sesión.

### 6.3 Vinculación Alexa ↔ adulto

Ver `ALEXA_SKILL.md` §7. Resumen: el cuidador genera un código de un uso en el
panel para un adulto concreto; ese código se dicta una vez desde el Echo; Chatio
crea el `AlexaLink`. **D009 está pendiente de confirmación.**

---

## 7. Configuración y entorno

Toda la configuración entra por variables de entorno, validadas con Zod al
arrancar: si falta una obligatoria, el proceso **no levanta**. Ver `.env.example`.

El esquema **crece por iteración** (**D026**): solo se valida lo que el código ya lee, así
que agregar una variable antes de tiempo no puede impedir un arranque. Estas son todas las
previstas para el MVP; las marcadas con ✔ ya existen y se validan.

```text
✔ NODE_ENV  ✔ PORT  ✔ LOG_LEVEL  ✔ TRUST_PROXY
✔ MONGODB_URI  ✔ MONGODB_SERVER_SELECTION_TIMEOUT_MS
✔ CORS_ORIGINS  ✔ BODY_LIMIT
✔ RATE_LIMIT_WINDOW_MS  ✔ RATE_LIMIT_MAX
✔ HEALTH_RATE_LIMIT_WINDOW_MS  ✔ HEALTH_RATE_LIMIT_MAX
✔ SHUTDOWN_TIMEOUT_MS

  JWT_ACCESS_SECRET  JWT_REFRESH_SECRET  ACCESS_TTL  REFRESH_TTL   (Iteración 2)
  ALEXA_SKILL_ID  ALEXA_VERIFY_SIGNATURE                           (Iteración 11)
  MAIL_PROVIDER  MAIL_API_KEY  MAIL_FROM  APP_PUBLIC_URL           (Iteración 15)
  ALEXA_REMINDERS_ENABLED  REMINDER_SYNC_BUDGET_MS
  REMINDER_SYNC_MAX_OPS                                            (Iteración 16)
  OCCURRENCE_HORIZON_HOURS  DEFAULT_GRACE_MINUTES                  (Iteración 5)
```

---

## 8. Observabilidad

- Logger estructurado JSON (`pino`) con `requestId` por request.
- Redacción obligatoria: nunca se loguean `Authorization`, cookies, tokens,
  `passwordHash`, códigos de vinculación ni el `alexaUserId` completo (se loguea
  un hash corto). Ver `SECURITY.md` §8.
- `GET /health` (liveness) y `GET /ready` (ping real a Mongo). Sin versionar, por ser
  infraestructura y no recursos de la API (**D025**); ver `API.md` §16.
- Los jobs loguean inicio, documentos afectados y duración.

---

## 9. Despliegue

Topología decidida (**D015**, 2026-09-29): **un VPS propio** aloja todo.

```text
                        Internet
                           |
                       (443 / 80)
                           v
              +--------------------------+
              |   VPS (Ubuntu LTS)       |
              |                          |
              |   Nginx                  |
              |    · TLS (Let's Encrypt) |
              |    · HSTS, redirect 80   |
              |    · estáticos del front |
              |    · proxy_pass /api     |
              |    · proxy_pass /alexa   |
              |         |                |
              |         v                |
              |   API Node (systemd)     |
              |    · Express + jobs cron |
              |         |                |
              |         v                |
              |   MongoDB (localhost, replica set) |
              |    · auth habilitada     |
              +-----------|--------------+
                          |
                    mongodump diario
                     cifrado, cron
                          v
              Almacenamiento remoto (fuera del VPS)
```

Por qué cumple los requisitos de Alexa:

- **Sin cold start.** La API es un proceso permanente bajo `systemd` (o PM2), así que
  la primera interacción del día —la más importante— no paga arranque. Es la razón
  por la que se descartó la capa gratuita de las PaaS, que suspende el contenedor.
- **TLS de CA pública** vía Let's Encrypt, que Alexa acepta. La renovación automática
  debe quedar **verificada**, no solo configurada: un certificado vencido deja la
  skill muda.
- **Una sola instancia**, que es justo lo que los jobs necesitan mientras no tengan
  lock (§5).
- Reloj sincronizado por NTP: los horarios de medicación dependen de él.

Contrapartida, explícita: pasan a ser nuestra responsabilidad el TLS y su renovación,
las actualizaciones de seguridad del sistema, el firewall, el hardening de SSH, los
backups **y su restauración probada**, y el monitoreo de disco y memoria. Nada de eso
viene resuelto por el proveedor. Está desglosado como tareas verificables de la
Iteración 19 y registrado como riesgo **R12** con la deuda **DT10**.

Dos decisiones operativas que se derivan de tener Mongo en el mismo host:

1. **MongoDB escucha solo en `localhost`** y con autenticación habilitada. Nunca se
   expone a internet. Se configura como replica set de un solo nodo para habilitar las
   transacciones que mantienen consistentes Adult + OWNER y serializan cambios de acceso;
   no implica desplegar varias instancias en el MVP.
2. **Los backups fuera del VPS no son opcionales.** Con la base en el mismo servidor,
   perder el VPS sin backup externo es perder el historial de medicación de todas las
   familias. Backup diario cifrado, copiado afuera, con restauración probada.

## 10. Antecedente: proyecto ONIET

En `../chatio` existe un prototipo previo (nombre interno *ONIET*): Python 3.11 +
FastAPI + SQLAlchemy + SQLite, MQTT hacia un ESP32-S3, Gemini para conversación y
Telegram para alertas. **No se reutiliza código**: stack, transporte y modelo de
persistencia son distintos.

Sí se reutiliza conocimiento validado ahí:

- Re-verificar ownership contra la base en **todos** los endpoints que tocan
  recursos de un adulto.
- El guardrail de que la capa de voz/IA no puede escribir prescripciones ni dar
  consejo médico.
- El historial de actividad como *append-only*.
- La disciplina de `ROADMAP.md` como fuente de verdad con tareas atómicas.

Y se corrige explícitamente la ventana rígida de 10 minutos, que tenía sentido con
un dispositivo que avisaba y no lo tiene con una interfaz pull.
