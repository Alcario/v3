# Alexa Reminders API — análisis e integración

Versión 1.0 · Iteración 0 · 2026-09-29

Este documento analiza la Alexa Reminders API **contra la documentación oficial
vigente** antes de implementarla, y define cómo Chatio la integra.

Regla de este documento: cada afirmación está marcada como **[VERIFICADO]** (respaldada
por documentación oficial de Amazon, con la fuente al final) o **[SIN VERIFICAR]** (no
está en la documentación consultada, o está pero sin el detalle necesario). Nada de lo
que sigue asume comportamiento de Alexa no respaldado por documentación. Los ítems
**[SIN VERIFICAR]** son tareas de verificación empírica de la Iteración 16, no
suposiciones de diseño: el diseño está construido para funcionar sin depender de
ninguno de ellos.

---

## 1. La limitación que condiciona todo el flujo

> **[VERIFICADO]** *"You can't use an out-of-session token to create a reminder, but you
> can use the out-of-session token to edit or delete a reminder."*
> — Alexa Reminders Overview

**Un reminder solo puede crearse desde una sesión activa de la skill**, usando el
`context.System.apiAccessToken` que llega en un request de Alexa. Si se intenta crear
con un token fuera de sesión, la API responde **401 `NOT_IN_SESSION`**
**[VERIFICADO]**.

Consecuencia directa sobre el flujo pedido:

```text
Familiar configura medicación   (ocurre en el panel web, fuera de toda sesión Alexa)
        ↓
Chatio registra horario          OK, es nuestro
        ↓
Alexa Reminder                   ← NO se puede crear en este momento
```

**Esto no hace inviable el flujo, pero lo hace no-instantáneo.** Es una limitación de
plataforma, no un problema de diseño nuestro, y no tiene workaround legítimo: no existe
forma documentada de crear un reminder sin que el adulto esté hablando con la skill.

Se evaluaron y **descartaron** los siguientes caminos antes de aceptar la limitación:

| Camino evaluado | Por qué se descarta |
| :--- | :--- |
| Crear con token fuera de sesión (LWA client credentials) | Prohibido explícitamente: `NOT_IN_SESSION` **[VERIFICADO]** |
| Despertar la skill con la Skill Messaging API y crear ahí | El request resultante es fuera de sesión; el token sigue siendo out-of-session y la restricción de creación se mantiene **[VERIFICADO por la regla general]**. Además sumaría credenciales y un endpoint nuevo para no resolver nada |
| Pre-crear un pool de reminders vacíos y después editarlos (el update sí es out-of-session) | Requiere reminders "placeholder" que igual hay que crear en sesión, dispararían avisos falsos hasta ser editados, y depende de comportamiento no documentado del campo `status`. Es exactamente el tipo de workaround frágil que no queremos en un producto que habla de medicación |
| Usar `Reminders` de la app Alexa manualmente | No es Chatio: no se puede sincronizar, ni auditar, ni mantener |

**Diseño que se adopta en consecuencia:** Chatio mantiene el **estado deseado** de los
reminders y lo **reconcilia en la próxima sesión** del adulto con la skill
(§5). La creación inicial se hace en la sesión de vinculación, que ya existe en el
flujo de onboarding (Iteración 12). A partir de ahí el sistema es autosostenido: los
propios reminders hacen que el adulto abra la skill a diario, y cada apertura reconcilia
los cambios pendientes.

**Latencia de propagación resultante:** un cambio hecho por el familiar en el panel se
refleja en Alexa la próxima vez que el adulto usa la skill — típicamente el mismo día,
en el próximo aviso. **El panel muestra ese estado de forma explícita** (`pendiente de
activación`), sin fingir que ya está aplicado. Registrado como riesgo **R14**.

---

## 2. Permisos y consentimiento

**[VERIFICADO]** Permiso requerido: `alexa::alerts:reminders:skill:readwrite`.

**[VERIFICADO]** La Reminders API está disponible para **custom skills** (es
explícitamente compatible con el modelo de voz personalizado).

**[VERIFICADO]** El modelo de consentimiento tiene dos niveles: el permiso global de
lectura/escritura de reminders, y el consentimiento del cliente en el diálogo de la
skill.

Existen **dos formas** de obtener el permiso, y la diferencia es decisiva para nuestro
usuario:

### 2.1 Tarjeta de permisos (`AskForPermissionsConsent`)

**[VERIFICADO]** La skill responde con una tarjeta que lleva al usuario a la página de
permisos de la skill **en la app Alexa**, donde activa el permiso.

Problema para Chatio: **el adulto mayor no va a completar esto solo.** Requiere teléfono,
app instalada, sesión iniciada y navegación. Sirve como camino para el **cuidador**.

### 2.2 Consentimiento por voz (voice-forward consent) — camino principal

**[VERIFICADO]** La skill envía una directiva `Connections.StartConnection` con
URI `connection://AMAZON.AskForPermissionsConsent/2`, cuyo `input` es de tipo
`AskForPermissionsConsentRequest` y lleva un array `permissionScopes` con su
`consentLevel` (`ACCOUNT` o `PERSON`).

**[VERIFICADO]** El scope `alexa::alerts:reminders:skill:readwrite` **está entre los
soportados** por este flujo.

**[VERIFICADO]** Al completarse, Alexa envía un `SessionResumedRequest` con una causa
`ConnectionCompleted` cuyo resultado es `ACCEPTED`, `DENIED` o `NOT_ANSWERED` (este
último por timeout de 8 segundos o cancelación).

**[VERIFICADO]** Restricción: la skill no puede ser child-directed. Chatio no lo es.

**[SIN VERIFICAR]** La documentación consultada no enumera los locales en los que el
consentimiento por voz está disponible. **Hay que verificarlo en `es-MX` sobre un Echo
real** antes de dar por bueno este camino (tarea de la Iteración 16). Si no estuviera
disponible en español, el fallback es la tarjeta de permisos completada por el cuidador,
que es el camino que el onboarding documenta de todos modos.

Esto permite un onboarding realista: durante la sesión de vinculación, la skill pide el
permiso por voz y **el adulto solo tiene que decir "sí"**. Si responde `DENIED` o
`NOT_ANSWERED`, Chatio sigue funcionando en modo pull y el panel le indica al cuidador
cómo activarlo desde la app.

---

## 3. La API

**[VERIFICADO]** Hosts regionales: `https://api.amazonalexa.com` (Norteamérica),
`https://api.eu.amazonalexa.com` (Europa), `https://api.fe.amazon.com` (Lejano Oriente).
El host correcto se toma de `context.System.apiEndpoint` del request, no se hardcodea.

**[VERIFICADO]** Operaciones:

| Operación | Método | URI |
| :--- | :--- | :--- |
| Crear | `POST` | `/v1/alerts/reminders` |
| Actualizar | `PUT` | `/v1/alerts/reminders/{alertToken}` |
| Eliminar | `DELETE` | `/v1/alerts/reminders/{alertToken}` |
| Leer uno | `GET` | `/v1/alerts/reminders/{alertToken}` |
| Listar todos | `GET` | `/v1/alerts/reminders` |

**[VERIFICADO]** Autenticación: `Authorization: Bearer <token>`. En sesión, el token es
`context.System.apiAccessToken`. Fuera de sesión, un token de Login with Amazon.

**[VERIFICADO]** Cuerpo de la petición:

```json
{
  "requestTime": "2026-09-29T14:32:00.000",
  "trigger": {
    "type": "SCHEDULED_ABSOLUTE",
    "scheduledTime": "2026-09-30T09:00:00.000",
    "timeZoneId": "America/Argentina/Buenos_Aires",
    "recurrence": {
      "startDateTime": "2026-09-30T09:00:00.000",
      "endDateTime": null,
      "recurrenceRules": ["FREQ=DAILY;BYHOUR=9;BYMINUTE=0;BYSECOND=0;INTERVAL=1"]
    }
  },
  "alertInfo": {
    "spokenInfo": {
      "content": [
        { "locale": "es-MX", "text": "Es hora de tu medicación. Decí: Alexa, abre chatio." }
      ]
    }
  },
  "pushNotification": { "status": "DISABLED" }
}
```

**[VERIFICADO]** `scheduledTime` es hora local **sin offset**, acompañada de
`timeZoneId`. Esto encaja exactamente con nuestro modelo de *hora de pared* (**D013**):
no hay que convertir a UTC ni preocuparse por el horario de verano — Alexa resuelve el
DST con la zona IANA, igual que nosotros.

**[VERIFICADO]** Respuesta: `alertToken`, `createdTime`, `updatedTime`,
`status` (`ON` | `COMPLETED`), `version`, `href`. **El `alertToken` es el identificador
que hay que persistir.**

### Recurrencia

**[VERIFICADO]** `recurrenceRules` usa formato RRULE. `FREQ` admite `DAILY`, `WEEKLY`,
`MONTHLY`, `YEARLY`. Reglas admitidas: `FREQ`, `BYMONTHDAY`, `BYDAY`, `BYHOUR`,
`BYMINUTE`, `BYSECOND`, `INTERVAL`.

**[VERIFICADO]** `INTERVAL` tiene mínimo de **1 hora en `en-US` y 4 horas en los demás
locales**, y máximo de 31 días (`DAILY`/`WEEKLY`/`MONTHLY`) o 1 año (`YEARLY`).

Impacto en Chatio: **ninguno**, y conviene dejarlo escrito para que nadie lo rompa más
adelante. Nuestros reminders son uno por franja horaria con `INTERVAL=1` sobre `DAILY`
(24 h) o `WEEKLY` (7 días), muy por encima del mínimo de 4 horas. El mínimo de 4 horas
**prohibiría** una pauta tipo "cada 2 horas" expresada como un único reminder recurrente
en español; si algún día se necesita, se resuelve con reminders separados por franja, que
es justamente lo que ya hacemos.

Mapeo de nuestro `schedule` a RRULE:

| `daysOfWeek` | RRULE |
| :--- | :--- |
| `[0,1,2,3,4,5,6]` | `FREQ=DAILY;BYHOUR=9;BYMINUTE=0;BYSECOND=0;INTERVAL=1` |
| `[1,2,3,4,5]` | `FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;BYHOUR=9;BYMINUTE=0;BYSECOND=0;INTERVAL=1` |

`recurrence.startDateTime` y `endDateTime` se toman de `schedule.startDate` /
`endDate`.

### Límites

| Límite | Valor | Estado |
| :--- | :--- | :--- |
| Reminders por usuario | **500** | **[VERIFICADO]** |
| `scheduledTime` en el pasado | Rechazado (`TRIGGER_SCHEDULED_TIME_IN_PAST`) | **[VERIFICADO]** |
| Longitud del texto | Existe un máximo; el valor exacto no figura en la referencia (hay un error "Text string is too long") | **[SIN VERIFICAR]** — nuestros textos son de ~60 caracteres, muy lejos de cualquier límite plausible |
| Duración máxima de una recurrencia sin `endDateTime` | No documentada | **[SIN VERIFICAR]** — mitigado por la reconciliación con `GET /v1/alerts/reminders` (§5.4), que detecta un reminder desaparecido y lo vuelve a crear |
| Locales soportados | La referencia solo ejemplifica `en-US`; un blog oficial afirma disponibilidad en todos los locales de Alexa | **[SIN VERIFICAR]** — **verificación obligatoria en `es-MX` sobre Echo real antes de cerrar la Iteración 16.** Es el ítem de mayor riesgo del documento (**R15**) |

**[VERIFICADO]** Una skill solo puede acceder a los reminders **que ella misma creó**
para ese cliente. No podemos ver ni tocar los reminders personales del adulto, y eso es
bueno: menos superficie y menos privacidad ajena en juego.

### Errores

**[VERIFICADO]**

| HTTP | Códigos | Tratamiento en Chatio |
| :--- | :--- | :--- |
| 201 / 200 | — | Éxito: se persiste `alertToken` y `status: SYNCED` |
| 400 | `INVALID_REQUEST_TIME_FORMAT`, `INVALID_TRIGGER`, `TRIGGER_SCHEDULED_TIME_IN_PAST`, `INVALID_TRIGGER_TIME_ZONE`, `INVALID_TRIGGER_RECURRENCE`, `UNSUPPORTED_TRIGGER_RECURRENCE`, `UNSUPPORTED_TRIGGER_RECURRENCE_INTERVAL`, `INVALID_ALERT_INFO`, `INVALID_TRIGGER_OFFSET` | **Error nuestro, no reintentable.** `status: FAILED`, se loguea el código, se muestra en el panel y **no** se reintenta en bucle |
| 401 | `MISSING_BEARER_TOKEN`, `INVALID_BEARER_TOKEN`, `EXPIRED_BEARER_TOKEN`, `NOT_IN_SESSION`, `UNAUTHORIZED` | `UNAUTHORIZED` suele significar **permiso no otorgado o revocado** → `permissionStatus: REVOKED`, el panel avisa, y la skill sigue en modo pull. `NOT_IN_SESSION` es un bug nuestro: solo se crea en sesión |
| 403 | `MAX_REMINDERS_EXCEEDED`, `DEVICE_NOT_SUPPORTED` | No reintentable. Se informa en el panel con texto entendible ("el dispositivo no admite recordatorios") |
| 404 | — | El reminder ya no existe (el usuario lo borró en la app). Se limpia el `alertToken` y se vuelve a `PENDING_CREATE` |
| 429 | — | Throttling: **reintento con backoff exponencial** en la próxima sesión, nunca dentro del mismo request |
| 500 / 503 | — | Transitorio: reintento en la próxima sesión |

**Regla dura:** un fallo de sincronización con Alexa **nunca** rompe la respuesta de voz
ni un endpoint del panel. La reconciliación corre en segundo plano respecto de la
respuesta al usuario y sus fallos quedan registrados, no propagados.

---

## 4. Revocación de permisos y otros eventos

**[VERIFICADO]** Existen eventos de skill suscribibles en el manifiesto
(`events.subscriptions`), con estos nombres exactos:

```text
AlexaSkillEvent.SkillEnabled            AlexaSkillEvent.SkillDisabled
AlexaSkillEvent.SkillPermissionAccepted AlexaSkillEvent.SkillPermissionChanged
AlexaSkillEvent.SkillAccountLinked      AlexaSkillEvent.SkillAccountUnlinked
Reminders.ReminderStarted               Reminders.ReminderCreated
Reminders.ReminderUpdated               Reminders.ReminderDeleted
Reminders.ReminderStatusChanged
```

**[VERIFICADO]** La suscripción se declara en el `skill.json` y requiere ASK CLI (la
consola no lo permite). Los eventos se reintentan hasta una hora si la skill no los
confirma.

**[SIN VERIFICAR] — y es importante:** la documentación de eventos de skill describe la
recepción **en un endpoint AWS Lambda con trigger de Alexa**, y no aclara si un endpoint
HTTPS propio los recibe. Como Chatio usa endpoint HTTPS propio (**D008**), **no podemos
dar por sentado que estos eventos lleguen.**

Por lo tanto el diseño **no depende de los eventos de skill**:

- **Revocación de permisos:** se detecta **reactivamente**, cuando una llamada a la
  Reminders API devuelve `401 UNAUTHORIZED` **[VERIFICADO]**. Ahí se marca
  `permissionStatus: REVOKED`, se emite un `ActivityEvent` y el panel avisa al cuidador.
  Es suficiente y no necesita eventos.
- **Reminder borrado por el usuario en la app Alexa:** se detecta por `404` al
  actualizarlo, o por la reconciliación con `GET /v1/alerts/reminders` (§5.4).
- **Reminder efectivamente emitido:** es la única cosa que *solo* los eventos darían
  (`Reminders.ReminderStarted`). Si al probarlos resulta que llegan al endpoint HTTPS, se
  registra un `ActivityEvent` de tipo `ALEXA_REMINDER_FIRED` y el familiar ve en el
  timeline que el aviso sonó. **Si no llegan, el MVP funciona igual**: se registra el
  aviso como *programado*, nunca como *emitido*, y no se afirma en la UI algo que no
  podemos comprobar.

Probar si los eventos llegan al endpoint HTTPS es una tarea explícita de la Iteración 16
con resultado documentado en la bitácora, no una suposición.

**[SIN VERIFICAR]** Comportamiento con el dispositivo offline a la hora del aviso. La
documentación consultada no lo especifica. **Y el diseño no depende de eso**: la
`MedicationOccurrence` la genera y la vence el scheduler de Chatio (`ARCHITECTURE.md`
§5), independientemente de que el reminder haya sonado. Si el Echo estaba desconectado, el
aviso se pierde y la ocurrencia queda `MISSED` como corresponde — el registro de Chatio
nunca depende de la entrega de Alexa.

---

## 5. Diseño de la integración

### 5.1 Principio: Chatio es la fuente de verdad, Alexa es un espejo

```text
Medication (+ schedule)        ← autoría del cuidador. Fuente de verdad.
        │  derivado, nunca editado a mano
        ▼
AlexaReminderSync              ← estado deseado + estado real del espejo
        │  reconciliación en sesión
        ▼
Alexa Reminder (alertToken)    ← sistema externo, best-effort

MedicationOccurrence           ← historial de tomas. NO conoce Alexa.
```

Cuatro conceptos, deliberadamente separados, como pediste:

| Concepto | Dónde vive | Quién lo crea |
| :--- | :--- | :--- |
| 1. Programación de la medicación | `Medication.schedule` | El cuidador, en el panel |
| 2. Recordatorio de Alexa | `AlexaReminderSync` → `alertToken` | Derivado de (1) por Chatio |
| 3. Ocurrencia de medicación | `MedicationOccurrence` | El materializador, desde (1) |
| 4. Confirmación declarada | `MedicationOccurrence.status = TAKEN` | **Solo** una declaración del adulto o del cuidador |

**Invariante, con test dedicado:** ningún camino de código permite que un reminder
—creado, actualizado o emitido— modifique el `status` de una `MedicationOccurrence`. El
aviso y la toma son cosas distintas. Un recordatorio emitido **no** es una toma
confirmada.

Ni `Medication` ni `MedicationOccurrence` reciben un solo campo de Alexa. Todo el
acoplamiento vive en `AlexaReminderSync`, que es la única pieza que sabe que Alexa
existe. Si mañana se cambia Alexa por otra plataforma, se reescribe esa colección y el
dominio no se toca.

### 5.2 Granularidad: un reminder por franja horaria, no por medicamento

El conjunto deseado de reminders para un adulto se calcula así: se toman todos sus
medicamentos activos y se agrupan sus horarios por **(hora local, conjunto de días)**.
Cada grupo distinto es **un** reminder, identificado por su `slotKey`
(ej. `"09:00|0123456"`), que es la clave única de `AlexaReminderSync`.

Ejemplo: Losartán 09:00 todos los días + Metformina 09:00 todos los días + Metformina
21:00 todos los días → **dos** reminders (09:00 y 21:00), no tres.

Ventajas, y son grandes:

- **Menos avisos.** El adulto no escucha dos alarmas seguidas a las 09:00 por dos
  medicamentos distintos. Esto solo ya justifica la decisión.
- **Muchísima menos sincronización.** Agregar un tercer medicamento a las 09:00 **no
  produce ningún cambio en Alexa**. Solo cambia el conjunto de reminders cuando cambia el
  conjunto de franjas horarias.
- **La creación —la operación restringida a sesión (§1)— es la más rara de todas.** La
  mayoría de las ediciones del cuidador no requieren crear nada.
- Un adulto típico tiene 1 a 4 franjas: lejísimos del límite de 500.

### 5.3 El texto del aviso no menciona el medicamento

Texto del reminder, para todos los casos:

```text
"Es hora de tu medicación. Decí: Alexa, abre chatio."
```

Tres razones, en orden de importancia:

1. **Privacidad y minimización de datos.** El texto de un reminder se almacena en la
   infraestructura de Amazon, es visible en la app Alexa y lo escucha cualquiera que esté
   en la habitación. Poner "Tomá tu Losartán de 50 miligramos" es enviar y exponer un
   dato de salud que no hace falta exponer (`SECURITY.md` §11). Un Echo es un dispositivo
   compartido.
2. **Coincide con el flujo pedido:** el aviso empuja al adulto a abrir Chatio, y es
   Chatio —con su propio estado, actualizado al segundo— quien dice qué corresponde
   tomar.
3. **Elimina una clase entera de desincronización.** Como el texto no depende del
   contenido de la medicación, cambiar una dosis, un nombre o agregar un medicamento **no
   obliga a actualizar el reminder**. El espejo solo depende de las franjas horarias.

Consecuencia aceptada: si el adulto no abre la skill después del aviso, no sabe qué
tomar. Es el mismo caso que hoy, y el aviso ya es una mejora enorme sobre no tener nada.
Poner el nombre del medicamento en el texto queda en el backlog como opción configurable
por el cuidador, con su advertencia de privacidad.

### 5.4 Reconciliación

`reminderSyncService` implementa un reconciliador declarativo clásico: calcula el estado
deseado, lo compara con el observado y aplica la diferencia.

**Cuándo se recalcula el estado deseado** (fuera de sesión, sin tocar Alexa): al crear,
editar, pausar, reactivar o borrar un medicamento; al cambiar la timezone del adulto; al
desactivar al adulto. El servicio escribe/actualiza documentos `AlexaReminderSync` con
`status: PENDING_CREATE | PENDING_UPDATE | PENDING_DELETE` y listo. **Nunca llama a
Alexa acá**, porque no hay sesión.

**Cuándo se aplica** (en sesión, con `apiAccessToken`): en **cada** request de Alexa, un
interceptor dispara la reconciliación de ese adulto si hay algo pendiente:

```text
1. Si permissionStatus != GRANTED  -> no se intenta nada (se evita un 401 garantizado)
2. GET /v1/alerts/reminders        -> estado observado (solo los que creó la skill)
3. Diferencia contra el estado deseado:
     falta en Alexa y se desea       -> POST    (única operación que exige sesión)
     existe y cambió la franja/días  -> PUT
     existe y ya no se desea         -> DELETE
     existe en Alexa sin documento   -> DELETE (huérfano de un sync anterior fallido)
     documento con alertToken ausente en Alexa -> el usuario lo borró: PENDING_CREATE
4. Se persiste alertToken, status, lastSyncedAt, attempts, lastError
5. ActivityEvent por cada cambio efectivo (nunca uno por reconciliación sin cambios)
```

Propiedades del reconciliador:

- **Idempotente.** Correrlo dos veces seguidas no produce cambios la segunda vez. El
  `desiredHash` (hash del estado deseado) permite decidir en una comparación si hay algo
  que hacer, sin llamar a Alexa cuando no hace falta.
- **Acotado en tiempo.** Se ejecuta con un presupuesto duro (2 s) y un máximo de
  operaciones por sesión (6). El request de Alexa tiene 8 segundos en total
  **[VERIFICADO en `ALEXA_SKILL.md`]** y la respuesta al adulto tiene prioridad absoluta:
  si el presupuesto se agota, lo que quedó sigue pendiente para la próxima sesión y **la
  respuesta de voz sale igual**.
- **Nunca bloquea la respuesta.** La reconciliación no se espera antes de responder,
  salvo en la sesión de vinculación, donde sí tiene sentido esperarla para poder decirle
  al adulto "listo, ya te voy a avisar".
- **Con backoff.** `attempts` y `lastAttemptAt` evitan reintentar en cada request algo
  que falla sistemáticamente. Tras 5 fallos consecutivos, `status: FAILED` y el panel lo
  muestra; no se reintenta hasta que el cuidador toque algo o pida resincronizar.
- **Autocurativo.** El paso 2 detecta la deriva real, incluidos los reminders que el
  usuario borró desde la app y los que pudieran haber expirado por un límite no
  documentado.

### 5.5 Bootstrap: de dónde sale la primera sesión

La sesión de vinculación (Iteración 12) es el momento en que todo se activa:

```text
1. El cuidador genera el código en el panel
2. Alguien le dice al Echo: "Alexa, abre chatio" -> "mi código es cuatro, siete, dos, tres"
3. Chatio crea el AlexaLink
4. Chatio pide el permiso de reminders POR VOZ (Connections.StartConnection)
5. SessionResumedRequest: ACCEPTED -> reconciliación inmediata: se crean los reminders
                          DENIED / NOT_ANSWERED -> modo pull, y el panel explica cómo
                          activarlo desde la app Alexa
6. "Listo. Te voy a avisar a las nueve y a las nueve de la noche."
```

A partir de ahí el sistema se sostiene solo: el aviso hace que el adulto abra la skill, y
cada apertura reconcilia.

---

## 6. Identificadores a persistir

| Dato | Dónde | Por qué |
| :--- | :--- | :--- |
| `alertToken` | `AlexaReminderSync.alertToken` | Único identificador para `PUT`, `DELETE` y `GET` **[VERIFICADO]** |
| `alexaUserIdHash` | `AlexaReminderSync` (y `AlexaLink`) | Los reminders pertenecen al **usuario de Alexa**, no al adulto. Si se revincula otra cuenta, los tokens viejos no sirven |
| `apiEndpoint` | `AlexaReminderSync.apiEndpoint` | El host regional del request **[VERIFICADO]**; se guarda el último visto para no hardcodear región |
| `desiredHash` | `AlexaReminderSync` | Comparación O(1) para saber si hay algo que sincronizar |
| `permissionStatus` | `AlexaLink.reminderPermission` | Estado del permiso, para no intentar llamadas condenadas al 401 y para informar al panel |

**Nunca se persiste el `apiAccessToken`.** Es de vida corta, llega en cada request y se
usa dentro del mismo. Tampoco se loguea (`SECURITY.md` §8).

**No se implementa el token de usuario fuera de sesión** en el MVP. Obtenerlo exige
manejar un `Alexa.Authorization.Grant` en el endpoint, canjear el código de autorización
y **almacenar y refrescar tokens por usuario de forma asíncrona** **[VERIFICADO]** — es
decir, guardar credenciales de larga duración de terceros, con todo lo que eso implica en
seguridad. Y como **no habilita la creación** (§1), solo mejoraría la latencia del borrado
y la actualización. No paga su costo en el MVP: queda en el backlog con esta
justificación escrita.

---

## 7. Lo que hay que verificar empíricamente en la Iteración 16

Ninguno de estos puntos es un supuesto del diseño; son verificaciones con resultado
documentado en la bitácora.

- [ ] La Reminders API funciona en **`es-MX`** sobre un Echo real: el texto en español se
      pronuncia bien y el aviso suena a la hora correcta (**R15**, el de mayor riesgo).
- [ ] El consentimiento por voz (`Connections.StartConnection`) está disponible en
      `es-MX`. Si no, fallback documentado a la tarjeta de permisos.
- [ ] Cómo verbaliza Alexa en español un reminder creado por una skill (¿antepone algo
      como "Aquí está tu recordatorio"?). Afecta la redacción del texto.
- [ ] Si los eventos de skill (`Reminders.ReminderStarted`,
      `AlexaSkillEvent.SkillPermissionChanged`) llegan a un **endpoint HTTPS propio** o
      exigen Lambda.
- [ ] Qué pasa con el aviso si el Echo está **offline** a la hora programada.
- [ ] Si una recurrencia sin `endDateTime` sobrevive indefinidamente o expira.
- [ ] Comportamiento real de un `PUT` sobre un reminder recurrente (¿conserva el
      `alertToken`? **[VERIFICADO: sí, el `PUT` es sobre el `alertToken`]**, ¿reinicia la
      recurrencia?).
- [ ] Longitud máxima real del texto.

---

## 8. Decisiones registradas

`D021` (supersede a `D018`) Reminders API dentro del alcance del MVP ·
`D022` un reminder por franja horaria, no por medicamento · `D023` texto genérico sin
datos de salud · `D024` reconciliación en sesión, sin token fuera de sesión.
Ver `ROADMAP.md`.

---

## 9. Fuentes

Documentación oficial consultada el 2026-09-29:

- [Alexa Reminders Overview](https://developer.amazon.com/en-US/docs/alexa/smapi/alexa-reminders-overview.html)
- [Reminders REST API Reference](https://developer.amazon.com/en-US/docs/alexa/smapi/alexa-reminders-api-reference.html)
- [Use Voice-Forward Consent in Your Skill](https://developer.amazon.com/en-US/docs/alexa/custom-skills/use-voice-forward-consent.html)
- [Get a User-Specific Access Token for Out-of-Session Calls to Alexa](https://developer.amazon.com/en-US/docs/alexa/custom-skills/get-a-user-specific-access-token.html)
- [Add Events to Your Skill with SMAPI](https://developer.amazon.com/en-US/docs/alexa/smapi/add-events-to-your-skill-with-smapi.html)
- [Skill Events in Alexa Skills](https://developer.amazon.com/en-US/docs/alexa/smapi/skill-events-in-alexa-skills.html)
- [Request Customer Contact Information](https://developer.amazon.com/en-US/docs/alexa/custom-skills/request-customer-contact-information-for-use-in-your-skill.html)
- [Tutorial: Update a Reminder from Outside of an Alexa Skill Session](https://developer.amazon.com/en-US/docs/alexa/smapi/tutorial-update-reminder-from-outside-of-session.html)
