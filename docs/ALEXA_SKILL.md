# Alexa Custom Skill — Chatio

Versión 1.0 · Iteración 0 · 2026-09-29 · Alexa Skills Kit, Custom Skill

Diseño de la primera versión de la skill. Todo lo que está acá fue validado contra
las capacidades reales del ASK (no se asume nada que la plataforma no ofrezca) y
las limitaciones se declaran explícitamente.

---

## 1. Definiciones generales

| | |
| :--- | :--- |
| Tipo | Custom Skill (modelo de interacción propio) |
| Backend | Endpoint HTTPS propio: `POST /alexa/skill` de la API Chatio (**no** Lambda, ver `ARCHITECTURE.md` A1) |
| Locales | `es-MX` (primario), `es-US` y `es-ES` con el mismo modelo |
| Account Linking | **No** en el MVP (ver §8) |
| Permisos solicitados | **`alexa::alerts:reminders:skill:readwrite`** (avisos proactivos de medicación, **D021**). Ningún otro: ni ubicación, ni datos del perfil |
| Interfaces | Ninguna (sin APL, sin audio player). Solo voz |
| Distribución | Privada / beta test durante la validación, con testers invitados |

Se pide **un solo** permiso, y es el que habilita el valor central del producto: que el
adulto reciba el aviso sin tener que acordarse de consultar. El riesgo de onboarding —que
un adulto mayor no complete una pantalla de consentimiento en la app Alexa— se resuelve
con **consentimiento por voz** (§11), donde solo tiene que decir "sí". No se pide ningún
otro permiso ni interfaz: cada uno agrega una barrera de onboarding y superficie de
revisión en certificación.

### Invocation name

Elegido: **`chatio`**.

Riesgo real (**R05**): Amazon exige que el invocation name tenga dos o más palabras
salvo que sea un nombre de marca distintivo, y "chatio" es una palabra inventada
que el ASR en español puede confundir con "chat io", "chatío" o "chatillo".
Mitigación: registrar como alternativa de respaldo **`mi chatio`** o
**`asistente chatio`** si certificación rechaza la palabra única o si las pruebas
de campo muestran fallos de reconocimiento. La decisión final se toma con los
resultados del primer test real en un Echo (tarea de la Iteración 11).

Frases de apertura soportadas:

```text
Alexa, abre chatio
Alexa, abrí chatio                      (voseo, es-MX lo reconoce)
Alexa, pregúntale a chatio qué tengo que tomar
Alexa, dile a chatio que ya tomé mi medicamento
Alexa, inicia chatio
```

### Registro lingüístico

Las *utterances* cubren **tuteo, voseo y ustedeo** porque no controlamos cómo habla
el adulto ("¿qué tengo que tomar?", "¿qué tomo ahora?", "decime qué tengo que
tomar"). Las *respuestas* usan un registro rioplatense cálido y breve ("Tenés que
tomar…"), centralizado en un único módulo de copys (`src/alexa/copy.es.js`) para
poder ajustar el tono sin tocar la lógica. Nada de textos incrustados en los
handlers.

Reglas de redacción de respuestas, por el perfil de usuario:

- Frases cortas, una idea por frase. Sin subordinadas.
- Siempre terminar con una pregunta concreta cuando la sesión sigue abierta.
- Nunca leer listas de más de 3 ítems; resumir y ofrecer detalle.
- Decir las horas en lenguaje natural ("a las nueve", "a las diez y media"), no
  "09:00".
- Nunca deletrear ids, códigos internos ni nombres de estado.
- Nunca dar consejo médico, dosis no prescritas ni interpretar síntomas.

---

## 2. Modelo de interacción

### Intents

| Intent | Propósito | Slots |
| :--- | :--- | :--- |
| `LaunchRequest` | Apertura: saluda y resume lo próximo del día | — |
| `GetMedicationIntent` | "¿Qué medicamento tengo que tomar?" | `medicationName` (opcional) |
| `ConfirmMedicationIntent` | "Ya tomé mi medicamento" | `medicationName` (opcional) |
| `GetTodayScheduleIntent` | "¿Qué tengo que hacer hoy?" | — |
| `RequestHelpIntent` | "Necesito ayuda" | — |
| `LinkDeviceIntent` | Canje del código de vinculación | `code` (`AMAZON.FOUR_DIGIT_NUMBER`) |
| `AMAZON.YesIntent` | Respuesta afirmativa a una pregunta de Chatio | — |
| `AMAZON.NoIntent` | Respuesta negativa | — |
| `AMAZON.HelpIntent` | Qué puede hacer la skill | — |
| `AMAZON.StopIntent` | Cierra | — |
| `AMAZON.CancelIntent` | Cancela la operación en curso | — |
| `AMAZON.FallbackIntent` | No se entendió | — |
| `AMAZON.NavigateHomeIntent` | Requerido por ASK; se trata como Stop | — |
| `SessionEndedRequest` | Cierre por silencio o error; solo registra | — |
| `SessionResumedRequest` | Resultado del consentimiento por voz de recordatorios (§11) | — |

Cambios respecto de la lista propuesta en el brief, con justificación:

- **Se agrega `LinkDeviceIntent`.** Sin Account Linking, el canje del código tiene
  que ocurrir por voz. Es el único intent que no necesita un adulto ya resuelto.
- **Se agregan `AMAZON.YesIntent` / `AMAZON.NoIntent`.** Sin ellos no se puede
  cerrar el diálogo "¿Ya lo tomaste?" → "Sí", que es el camino más natural y más
  corto para confirmar una toma. Son imprescindibles, no opcionales.
- **Se agrega `AMAZON.FallbackIntent`.** Obligatorio en la práctica: sin él, una
  frase no entendida produce un intent aleatorio, y en este producto eso puede
  significar registrar una toma que no ocurrió.
- **Se agrega `AMAZON.NavigateHomeIntent`.** Requerido por el modelo estándar.
- **No se agrega un intent para omitir tomas.** Decidir no medicarse no puede ser
  un comando de voz suelto; se hace desde el panel (ver `API.md` §7).
- Los nombres del brief se conservan tal cual donde funcionan
  (`GetMedicationIntent`, `ConfirmMedicationIntent`, `GetTodayScheduleIntent`,
  `RequestHelpIntent`): son válidos, descriptivos y no colisionan con nombres
  reservados de Amazon.

### Sample utterances (extracto normativo)

`GetMedicationIntent`

```text
qué medicamento tengo que tomar
qué medicamento tomo ahora
qué remedio tengo que tomar
qué pastilla tengo que tomar
qué tengo que tomar
qué tengo que tomar ahora
cuál es mi medicamento
me toca algún remedio
tengo que tomar algo
decime qué tengo que tomar
dime qué tengo que tomar
qué tengo que tomar de {medicationName}
```

`ConfirmMedicationIntent`

```text
ya tomé mi medicamento
ya tomé el remedio
ya tomé la pastilla
ya lo tomé
ya la tomé
tomé mi medicamento
tomé el {medicationName}
ya tomé el {medicationName}
ya tomé la {medicationName}
listo ya lo tomé
acabo de tomar mi remedio
```

`GetTodayScheduleIntent`

```text
qué tengo que hacer hoy
qué tengo hoy
cómo viene el día
qué hay para hoy
qué tengo para hoy
cuál es mi agenda
tengo algún turno hoy
qué me toca hoy
```

`RequestHelpIntent`

```text
necesito ayuda
ayuda
ayúdenme
avisá a mi familia
avisa a mi familia
llamá a mi familia
no me siento bien
necesito que venga alguien
```

`LinkDeviceIntent`

```text
vincular con el código {code}
mi código es {code}
el código es {code}
vincular {code}
código {code}
```

**Colisión conocida:** "ayuda" a secas es también la utterance canónica de
`AMAZON.HelpIntent`. Se resuelve así, y es una decisión de producto: `"ayuda"`
sola y `"necesito ayuda"` se enrutan a **`RequestHelpIntent`**, y `AMAZON.HelpIntent`
queda para "qué podés hacer", "cómo funciona esto", "no entiendo". Para un adulto
mayor que dice "ayuda", la interpretación segura es pedir asistencia, no escuchar
un tutorial. `AMAZON.HelpIntent` no se puede quitar del modelo, así que además su
respuesta **ofrece explícitamente** el pedido de ayuda: *"Si necesitás que avise a
tu familia, decime 'necesito ayuda'."*

### Slots

| Slot | Tipo | Notas |
| :--- | :--- | :--- |
| `medicationName` | Custom `MedicationName` | Siempre **opcional**. Ver abajo |
| `code` | `AMAZON.FOUR_DIGIT_NUMBER` | Maneja ceros a la izquierda y secuencias de dígitos, que `AMAZON.NUMBER` interpreta mal |

**El nombre del medicamento no es confiable y el diseño no depende de él
(R06).** El ASR en español transcribe mal los nombres de fármacos ("Losartán" →
"lo sartén", "losартán"), no existe un slot type built-in de medicamentos
utilizable en `es-*`, y un custom slot no puede poblarse dinámicamente por usuario
(las Dynamic Entities existen pero solo duran la sesión y requerirían inyectar la
lista en cada turno, sumando latencia).

Por lo tanto:

- El slot `medicationName` se declara con un catálogo semilla de nombres frecuentes
  en Argentina (Losartán, Enalapril, Metformina, Levotiroxina, Atorvastatina,
  Aspirina, Amlodipina, Omeprazol, Clonazepam, Furosemida, Paracetamol, Ibuprofeno,
  …) únicamente para ayudar al reconocimiento. **No** se usa entity resolution como
  verdad.
- El matcheo contra los medicamentos del adulto lo hace Chatio: normalización
  (minúsculas, sin acentos, sin espacios), match por prefijo y distancia de
  Levenshtein con umbral. Si el resultado es ambiguo, **se ignora el slot** y se
  cae al mecanismo por contexto.
- **El camino principal de confirmación no usa el nombre**: Chatio nombra el
  medicamento y el adulto contesta "sí". Ver §4.

### Definición del modelo (esqueleto)

```json
{
  "interactionModel": {
    "languageModel": {
      "invocationName": "chatio",
      "intents": [
        { "name": "GetMedicationIntent",
          "slots": [{ "name": "medicationName", "type": "MedicationName" }],
          "samples": ["qué medicamento tengo que tomar", "qué tengo que tomar"] },
        { "name": "ConfirmMedicationIntent",
          "slots": [{ "name": "medicationName", "type": "MedicationName" }],
          "samples": ["ya tomé mi medicamento", "ya lo tomé"] },
        { "name": "GetTodayScheduleIntent", "slots": [],
          "samples": ["qué tengo que hacer hoy", "qué tengo hoy"] },
        { "name": "RequestHelpIntent", "slots": [],
          "samples": ["necesito ayuda", "ayuda", "avisá a mi familia"] },
        { "name": "LinkDeviceIntent",
          "slots": [{ "name": "code", "type": "AMAZON.FOUR_DIGIT_NUMBER" }],
          "samples": ["mi código es {code}", "vincular con el código {code}"] },
        { "name": "AMAZON.YesIntent", "samples": [] },
        { "name": "AMAZON.NoIntent", "samples": [] },
        { "name": "AMAZON.HelpIntent", "samples": [] },
        { "name": "AMAZON.StopIntent", "samples": [] },
        { "name": "AMAZON.CancelIntent", "samples": [] },
        { "name": "AMAZON.FallbackIntent", "samples": [] },
        { "name": "AMAZON.NavigateHomeIntent", "samples": [] }
      ],
      "types": [
        { "name": "MedicationName",
          "values": [{ "name": { "value": "Losartán" } },
                     { "name": { "value": "Metformina" } }] }
      ]
    }
  }
}
```

No se usa **Dialog Management** (`dialogState`, slot elicitation automática): con
un solo slot opcional no aporta, y agrega turnos de conversación que este usuario
no tolera bien. El diálogo se maneja con atributos de sesión.

---

## 3. Sesión y estado

`sessionAttributes` que Chatio mantiene (solo ids y banderas, sin datos de salud):

```json
{
  "adultId": "66f1...001",
  "awaitingConfirmationOccurrenceId": "66f1...201",
  "awaitingLink": false,
  "lastIntent": "GetMedicationIntent",
  "helpRequestId": null,
  "pendingPermissionAsk": false,
  "reminderSyncRan": true
}
```

Reglas:

- El adulto se resuelve **en cada request** desde `AlexaLink` (un
  `RequestInterceptor`), no se confía en el `adultId` que vuelve en la sesión: los
  atributos de sesión viajan por el cliente y no son una fuente de autoridad. El
  valor en sesión es solo caché para el log.
- `awaitingConfirmationOccurrenceId` se limpia al resolverse o al cambiar de tema.
- Las sesiones expiran solas (silencio de pocos segundos). Ningún flujo requiere
  más de **dos turnos**.
- No se persiste estado conversacional entre sesiones. No se usa la Persistent
  Attributes API de ASK: nuestro estado ya vive en MongoDB.

---

## 4. Respuestas por intent

### `LaunchRequest`

Con vínculo activo y adulto activo:

```text
"Hola. Soy Chatio. Hoy tenés que tomar Losartán a las nueve
 y tenés turno con el cardiólogo a las diez y media.
 ¿Querés saber qué medicamento te toca ahora?"
reprompt: "¿Te ayudo con tu medicación o con tu agenda de hoy?"
```

Cuando el adulto entra **justo después de un aviso** (hay una ocurrencia confirmable en
ventana), el `LaunchRequest` va directo al grano en lugar de recitar la agenda, porque el
aviso ya le dijo que es la hora:

```text
"Hola. Es hora de tu Losartán: un comprimido de cincuenta miligramos,
 después del desayuno. ¿Ya lo tomaste?"
```

En este request corre además la reconciliación de avisos (§11), que nunca retrasa ni
altera lo que el adulto escucha.

Con la agenda vacía: *"Hola. Soy Chatio. Hoy no tenés medicamentos ni turnos
anotados. ¿Necesitás algo?"*

Sin vínculo (§7): *"Hola. Todavía no estoy vinculado con nadie. Pedile a tu
familia el código de cuatro números que aparece en la aplicación y decime 'mi
código es' seguido de los números."* — `shouldEndSession: false`, `awaitingLink: true`.

Adulto inactivo: *"Hola. Por ahora no tengo información para darte. Tu familia
puede activarme desde la aplicación."* — cierra la sesión. No revela nombres ni
motivos.

### `GetMedicationIntent`

| Situación | Respuesta |
| :--- | :--- |
| Una sola confirmable | *"Tenés que tomar Losartán: un comprimido de cincuenta miligramos, después del desayuno. ¿Ya lo tomaste?"* → `awaitingConfirmationOccurrenceId` |
| Varias confirmables | *"Tenés dos medicamentos para ahora: Losartán y Metformina. ¿Cuál tomaste?"* (máximo 3; si son más: *"Tenés cuatro medicamentos para hoy. El primero es Losartán a las nueve. ¿Querés que te los diga de a uno?"*) |
| Ninguna confirmable, pero hay más tarde | *"Ahora no te toca ninguno. El próximo es Metformina, a la una de la tarde."* |
| Ninguna en todo el día | *"Hoy no tenés medicamentos anotados."* |
| Hay `MISSED` de hoy | *"Tenías que tomar Losartán a las nueve y no me lo confirmaste. ¿Lo tomaste?"* |
| Slot que matchea un medicamento | Responde solo por ese |
| Slot que no matchea nada | *"No encontré ese medicamento. Puedo decirte lo que te toca ahora, ¿querés?"* — no inventa |

Emite `MEDICATION_QUERIED`.

### `ConfirmMedicationIntent` y `AMAZON.YesIntent`

`AMAZON.YesIntent` con `awaitingConfirmationOccurrenceId` presente equivale a
confirmar esa ocurrencia. Sin contexto, se responde *"No estoy seguro de qué me
estás confirmando. ¿Querés que te diga qué tenés que tomar?"*

Resolución del objetivo: la cadena de 6 pasos de `DATA_MODEL.md` §4.

| Situación | Respuesta |
| :--- | :--- |
| Confirmación correcta | *"Listo. Registré que tomaste Losartán. Muy bien."* → cierra |
| Ya estaba confirmada | *"Ya lo tenía registrado. Tomaste Losartán hace un rato, no hace falta tomarlo de nuevo."* → **cierra, y no duplica** |
| Fuera de ventana | *"Lo anoté igual. Tomaste Losartán, que era de las nueve."* (`confirmedOutOfWindow: true`) |
| Varias posibles | *"¿Cuál tomaste, el Losartán o la Metformina?"* → sigue abierta |
| Nada pendiente | *"No tengo ningún medicamento pendiente ahora. Si tomaste algo que no tengo anotado, avisale a tu familia."* |

La advertencia de "no hace falta tomarlo de nuevo" es intencional: es la única
respuesta de la skill con contenido cuasi-sanitario, y es segura porque no da
indicación médica, solo informa el registro.

Emite `MEDICATION_CONFIRMED`.

### `GetTodayScheduleIntent`

```text
"Hoy tenés que tomar Losartán a las nueve y tenés turno con el cardiólogo
 a las diez y media. ¿Querés que te repita algo?"
```

Prioriza lo que está por venir; menciona lo pendiente vencido; máximo 3 ítems y
después resume. Agenda vacía: *"Hoy no tenés nada anotado. Que tengas un buen
día."* Emite `SCHEDULE_QUERIED`.

### `RequestHelpIntent`

```text
"Ya le avisé a tu familia que necesitás ayuda. Quedate tranquilo.
 Si es una emergencia médica, cortá y llamá al 911."
```

Repetido dentro de 15 minutos (dedupe activo): *"Ya le avisé a tu familia, y les
volví a avisar. Si es una emergencia, llamá al 911."* Solo se re-notifica al
cruzar el umbral de intentos (ver `DATA_MODEL.md` §3.8).

Si falla el registro en base: *"No pude avisarle a tu familia. Por favor llamá al
911 o a un vecino."* — **nunca** se le dice que avisó si no avisó.

Emite `HELP_REQUESTED`. La sesión se cierra (no se lo deja esperando una
respuesta).

### `AMAZON.HelpIntent`

```text
"Puedo decirte qué medicamento te toca, anotar que ya lo tomaste, contarte
 qué tenés hoy, y avisarle a tu familia si necesitás ayuda.
 Probá diciendo: qué tengo que tomar. Si necesitás que avise a tu familia,
 decime: necesito ayuda."
```

### `AMAZON.StopIntent` / `CancelIntent` / `NavigateHomeIntent`

*"Hasta luego. Estoy acá si me necesitás."* → cierra.

### `AMAZON.FallbackIntent`

```text
1er fallo: "Perdoname, no te entendí. Podés preguntarme qué tenés que tomar
            o decirme que ya tomaste tu medicamento."
2do fallo seguido: "Sigo sin entenderte. Te dejo tranquilo. Si necesitás ayuda,
            decime: necesito ayuda." -> cierra
```

Contador de fallos en la sesión. Insistir con un adulto mayor que no logra hacerse
entender es peor que cerrar con cortesía.

### `SessionEndedRequest`

No produce voz. Registra motivo si es `ERROR` y limpia lo que haga falta.

---

## 5. Manejo de errores

Un `ErrorHandler` global captura **todo**. Regla absoluta: nunca se devuelve 5xx,
porque eso hace que Alexa diga *"hubo un problema con la skill solicitada"* — la
peor experiencia posible para este usuario.

| Falla | Respuesta hablada | Registro |
| :--- | :--- | :--- |
| Mongo caído / timeout | *"Ahora no puedo consultar tu información. Probá en un ratito."* | `error` con `requestId` |
| Excepción no prevista | Igual que la anterior | `error` + stack en log del servidor |
| Firma ASK inválida | **Ninguna** (HTTP 400 seco) | `warn`, con IP |
| `applicationId` ajeno | **Ninguna** (HTTP 400 seco) | `warn` |
| Intent sin handler | Fallback | `warn` |
| Adulto sin vínculo | Guion de vinculación | `ALEXA_LINK_FAILED` |
| Vínculo ambiguo (§7) | *"Necesito que tu familia termine de configurarme en la aplicación."* | `ALEXA_LINK_FAILED` |
| Latencia > 6 s | Respuesta parcial si es posible | `warn` con duración |
| Reminders API falla (cualquier código) | **Ninguna mención al adulto.** La respuesta hablada sale igual | `ALEXA_REMINDER_SYNC_FAILED` con el código de Alexa |
| Permiso de recordatorios revocado (`401 UNAUTHORIZED`) | Ninguna mención en ese momento | `permissionStatus: REVOKED` + aviso en el panel |

**Regla:** un fallo de sincronización de avisos **nunca** se le comunica al adulto ni
altera la respuesta. Es un problema de configuración que le corresponde al cuidador, y se
le informa a él en el panel. Ver `ALEXA_REMINDERS.md` §3.

Timeout interno de las llamadas a servicios: **5 segundos**, para poder responder
algo dentro de los 8 s del ASK.

---

## 6. Seguridad del endpoint

1. **Verificación de firma obligatoria** (`ask-sdk-express-adapter`): cadena de
   certificados desde `s3.amazonaws.com/echo.api/`, SAN
   `echo-api.amazon.com`, firma del body crudo y `timestamp` con tolerancia de
   150 s (anti-replay). En producción `ALEXA_VERIFY_SIGNATURE=true` **siempre**; la
   única excepción es el entorno de test local.
2. **Validación del `applicationId`** contra `ALEXA_SKILL_ID` en cada request.
3. Rate limit por `alexaUserIdHash` **después** de verificar la firma (`API.md` §14).
4. El `userId` de Alexa se hashea antes de tocar la base o los logs.
5. La skill no expone datos de otro adulto que el vinculado a ese dispositivo, ni
   información del cuidador, ni teléfonos de contacto. Un Echo es compartido: hay
   que asumir que cualquiera en la casa puede escuchar.
6. La skill **nunca** crea, edita ni borra medicamentos ni recordatorios de Chatio. Solo
   lectura, confirmación de tomas y sincronización de los avisos de Alexa. Esto es un
   límite de diseño, no una restricción temporal.
7. El `apiAccessToken` del request se usa dentro del mismo request y **no se persiste ni
   se loguea nunca**. Los `alertToken` sí se persisten, porque son necesarios para
   actualizar y borrar avisos, y no son credenciales.
8. **El texto de los avisos no contiene datos de salud** (**D023**): Alexa almacena ese
   texto y lo muestra en la app, y el Echo es un dispositivo compartido.

---

## 7. Vinculación: ¿qué adulto está hablando?

Este es el punto más delicado del diseño. El request de Alexa trae:

```json
"context": { "System": {
  "user":   { "userId": "amzn1.ask.account.AG..." },
  "device": { "deviceId": "amzn1.ask.device.AF..." },
  "application": { "applicationId": "amzn1.ask.skill.xxxx" }
} }
```

`userId` es opaco, estable por (cuenta de Amazon × skill), y **no nos dice nada
sobre quién es la persona**. `deviceId` identifica el Echo concreto. Ninguno de los
dos es una credencial: hay que crear el vínculo nosotros.

### Mecanismo elegido para el MVP: código de vinculación de un uso (**D009, pendiente de confirmación**)

```text
1. El cuidador OWNER entra al panel → Configuración → Alexa → "Vincular un Echo"
   y elige el adulto. Chatio genera un código de 4 dígitos, lo muestra UNA vez y
   guarda solo su hash (TTL 15 min, un solo uso).
2. Alguien le habla al Echo del adulto:
      "Alexa, abre chatio"            -> "Todavía no estoy vinculado…"
      "mi código es cuatro siete dos tres"
3. Chatio valida el código: vigente, no usado, dentro del límite de intentos.
4. Crea el AlexaLink { adultId, alexaUserIdHash, deviceIdHash }, marca el código
   como usado, emite ALEXA_LINKED y envía un email a los OWNER avisando que se
   vinculó un dispositivo nuevo.
5. Pide el permiso de recordatorios POR VOZ (§11) para poder avisarle a la hora de
   la toma. Si acepta, reconcilia y crea los avisos en esa misma sesión.
6. Alexa responde: "Listo. Te voy a avisar a las nueve y a las nueve de la noche."
   (o, si no dio el permiso: "Listo, ya estoy vinculado. Cuando quieras, preguntame
   qué tenés que tomar.")
```

La sesión de vinculación es además **el único momento garantizado** en que Chatio puede
crear los avisos iniciales, porque la creación de reminders exige una sesión activa
(`ALEXA_REMINDERS.md` §1). Por eso el permiso se pide acá y no más tarde.

Por qué así, y no de otra forma:

- **Es el único flujo que un adulto mayor puede completar** sin instalar nada ni
  iniciar sesión. El paso difícil (el panel) lo hace el cuidador.
- El vínculo lo origina **siempre** un `OWNER` autenticado: nadie se autovincula.
- Es revocable en un clic desde el panel, y auditable.
- No requiere implementar un servidor OAuth2 (ver §8).

Controles contra el abuso: 4 dígitos (10.000 combinaciones) con TTL de 15 minutos,
un solo uso, **5 intentos por hora** por `alexaUserIdHash`, y aviso por email al
`OWNER` en cuanto se crea un vínculo. La ventana de ataque efectiva es de unos
pocos intentos contra los códigos que casualmente estén vigentes en ese momento, y
cualquier vínculo indebido es visible y revocable de inmediato. Se eligen 4 dígitos
y no 6 porque `AMAZON.FOUR_DIGIT_NUMBER` es el único slot type que captura
secuencias de dígitos de forma confiable en `es-*`; con 6 dígitos vía
`AMAZON.NUMBER` el reconocimiento falla lo suficiente como para que el flujo se
vuelva inusable, y un flujo de vinculación que no funciona es un riesgo de
seguridad peor (lleva a compartir cuentas). **Riesgo R07**, aceptado y registrado.

### Resolución en cada request

1. `AlexaLink` activo con `{ alexaUserIdHash, deviceIdHash }` exactos → ese adulto.
2. Si no hay, `AlexaLink` activo con `{ alexaUserIdHash, deviceIdHash: null }`.
3. Exactamente uno → ese adulto. Se actualiza `lastSeenAt` (sin bloquear).
4. Más de uno → **no se adivina**: se pide terminar la configuración en el panel y
   se registra `ALEXA_LINK_FAILED`.
5. Ninguno → guion de vinculación.

### Un cuidador con varios adultos

Es el caso realmente problemático, y tiene dos sub-casos distintos:

- **Adultos en casas distintas** (lo habitual: madre y suegra). Cada casa tiene su
  propio Echo y su propia cuenta de Amazon → `alexaUserIdHash` distinto → sin
  ambigüedad. Funciona sin más.
- **Dos adultos en la misma casa con la misma cuenta de Amazon** (una pareja
  mayor). Mismo `alexaUserIdHash`. Se resuelve por **dispositivo**: cada adulto se
  vincula al Echo de su habitación y el `AlexaLink` guarda `deviceIdHash`. El panel
  detecta el conflicto al generar el segundo código y **obliga** a vinculación por
  dispositivo. Si aun así dos adultos comparten el mismo Echo, Chatio no puede
  distinguirlos y **lo declara explícitamente**: no se soporta en el MVP. La
  alternativa —preguntar "¿con quién hablo?" en cada sesión— degrada la
  experiencia precisamente para el usuario que queremos proteger. Riesgo **R02**.

---

## 8. Account Linking: análisis y decisión

Account Linking (OAuth 2.0 authorization code grant) es el mecanismo estándar de
Amazon para asociar una cuenta de Alexa con una cuenta de nuestra aplicación.

| | Account Linking | Código de vinculación (elegido) |
| :--- | :--- | :--- |
| Qué debemos construir | Servidor OAuth2: `/authorize`, `/token`, pantalla de consentimiento, refresh, revocación | Un endpoint que genera un código y un intent que lo canjea |
| Quién completa el flujo | El usuario de la cuenta de Amazon, desde la app Alexa, con login | El cuidador en el panel + una frase dicha al Echo |
| Identidad resultante | Un `accessToken` por request que identifica a un **usuario** de Chatio | Un vínculo dispositivo → **adulto** |
| Selección del adulto | **Igual hace falta resolverla**: el token identifica al cuidador, no al adulto | Resuelta por construcción |
| Revocación | Estándar (token) | Un clic en el panel |
| Esfuerzo | Alto (una iteración completa, más superficie de ataque) | Bajo |
| Riesgo de abandono | **Alto**: el adulto mayor no va a completar un OAuth en la app Alexa | Bajo |

Punto clave, y la razón de fondo: **Account Linking no resuelve el problema que
tenemos.** Nos daría la identidad del *cuidador* dueño de la cuenta de Amazon,
cuando lo que necesitamos saber es *qué adulto* está frente a ese Echo. Con un
cuidador que administra dos adultos, tras el Account Linking seguiríamos
necesitando exactamente el mismo mapeo dispositivo → adulto. Sería trabajo extra
para quedar en el mismo lugar.

**Decisión (D009):** sin Account Linking en el MVP. Se implementa el código de
vinculación.

Cuándo sí habría que migrar a Account Linking: si se publica la skill al store
público (Amazon lo mira con mejores ojos y algunos revisores lo esperan para
skills con datos personales), si hace falta que el propio adulto tenga cuenta, o
si se necesita revocación centralizada desde el lado de Amazon. La migración es
aditiva: `AlexaLink` sobrevive igual, solo cambia cómo se origina.

---

## 9. Certificación y cumplimiento

Puntos que hay que atender antes de someter la skill (Iteración 19):

- **Privacy policy y terms of use públicos y accesibles.** Obligatorio para
  cualquier skill que maneje datos personales. Debe declarar qué guardamos
  (medicación, confirmaciones, pedidos de ayuda) y qué no (audio,
  transcripciones).
- **Disclaimer de no-emergencia.** La descripción de la skill, la respuesta de
  `AMAZON.HelpIntent` y la de `RequestHelpIntent` deben dejar claro que Chatio
  **no es un servicio de emergencias** y derivar al 911. Amazon rechaza skills que
  insinúan capacidad de respuesta ante emergencias.
- **Sin consejo médico.** La skill no diagnostica, no sugiere dosis, no interpreta
  síntomas. Solo lee lo que un cuidador configuró. Conviene decirlo tal cual en las
  notas para el revisor.
- **Instrucciones de testing para el revisor.** El revisor no puede pasar la
  vinculación solo: hay que darle una cuenta de prueba del panel y un código, o un
  código de larga duración solo para el entorno de certificación (y quitarlo
  después).
- **Justificación del permiso de recordatorios.** Hay que explicar en las notas para el
  revisor para qué se usa `alexa::alerts:reminders:skill:readwrite`: avisar la hora de una
  toma configurada por un familiar. Amazon revisa que el permiso solicitado sea coherente
  con la función de la skill.
- **El texto de los avisos no contiene datos de salud** (**D023**), lo que también reduce
  el riesgo en la revisión de privacidad.
- La privacy policy debe mencionar explícitamente que la skill **crea recordatorios en la
  cuenta de Alexa del usuario** y que puede modificarlos y borrarlos.
- **Contenido apto para todo público**, sin recolección de datos de menores.
- **Distribución privada / beta** durante la validación (Iteración 20): evita la
  revisión pública completa mientras se itera, admite hasta 500 testers por
  invitación y acorta muchísimo el ciclo.

---

## 10. Testing de la skill

Detalle completo en `TESTING.md` §5. Enfoque:

- **Unitario (Vitest).** Cada handler con el `HandlerInput` mockeado y los
  servicios stubbeados: se asserta el `outputSpeech`, el `reprompt`,
  `shouldEndSession` y los `sessionAttributes`. Es donde vive la mayoría de los
  tests de voz, y corre en milisegundos.
- **Integración (Supertest).** `POST /alexa/skill` con requests ASK reales
  capturados, firma deshabilitada por env, base en memoria: verifica el efecto en
  Mongo y los `ActivityEvent` generados.
- **Manual con el simulador de la consola Alexa** y con un Echo físico antes de
  cerrar las iteraciones 11 a 15. El simulador no reproduce los errores de ASR: los
  nombres de medicamentos **hay que probarlos en voz real**.
- **Golden file del modelo de interacción.** Un test que compara el JSON del modelo
  contra un snapshot, para que un cambio de utterances no pase inadvertido.

Casos borde obligatorios (los del brief, con el comportamiento esperado ya
definido):

| Caso | Comportamiento esperado |
| :--- | :--- |
| Confirma dos veces la misma toma | 2ª vez idempotente: *"Ya lo tenía registrado"*. Un solo `ActivityEvent`, `confirmedAt` sin cambios |
| Pregunta qué tomar con 2 pendientes | Los nombra a los dos y pregunta cuál; no elige por su cuenta |
| Confirma fuera de horario | Se registra con `confirmedOutOfWindow: true`; la respuesta lo menciona sin regañar |
| No hay medicamentos pendientes | *"No tenés nada pendiente ahora"* + próximo horario si existe |
| Dice "necesito ayuda" 3 veces | Una sola `HelpRequest` con `attempts: 3`; un email, más uno de escalamiento al cruzar el umbral |
| Alexa no está vinculada | Guion de vinculación; **cero** acceso a datos; `ALEXA_LINK_FAILED` |
| Confirma sin contexto ("sí" suelto) | Pide aclaración; no confirma nada |
| Vínculo ambiguo (2 adultos, 1 Echo) | Pide completar la configuración en el panel |
| Adulto desactivado | Mensaje neutro y cierre; sin datos |
| Mongo caído | *"Ahora no puedo consultar tu información"*; nunca un 5xx |
| Código de vinculación vencido o usado | *"Ese código ya no sirve. Pedile uno nuevo a tu familia"*; cuenta el intento |
| Permiso de recordatorios **denegado** por voz | La skill sigue funcionando en modo pull; `permissionStatus: DENIED`; el panel lo informa |
| Permiso **revocado** después de haber estado activo | `401 UNAUTHORIZED` detectado, `permissionStatus: REVOKED`, aviso en el panel, **sin** mención al adulto |
| La Reminders API falla durante la reconciliación | La respuesta hablada **no cambia**; `status: FAILED` tras 5 intentos |
| Un aviso suena pero el adulto no confirma nada | La ocurrencia queda `PENDING` y luego `MISSED`. **El aviso emitido nunca la marca `TAKEN`** |
| El usuario borra el aviso desde la app Alexa | La reconciliación lo detecta (`404` o ausencia en el `GET`) y lo vuelve a crear |

---

## 11. Permiso y sincronización de los avisos proactivos

Resumen operativo; el análisis completo contra documentación oficial —con cada afirmación
marcada como verificada o pendiente de verificar— está en **`ALEXA_REMINDERS.md`**.

### 11.1 Pedir el permiso por voz

La skill solicita `alexa::alerts:reminders:skill:readwrite` con una directiva
`Connections.StartConnection` hacia `connection://AMAZON.AskForPermissionsConsent/2`:

```json
{
  "type": "Connections.StartConnection",
  "uri": "connection://AMAZON.AskForPermissionsConsent/2",
  "input": {
    "@type": "AskForPermissionsConsentRequest",
    "@version": "2",
    "permissionScopes": [
      { "permissionScope": "alexa::alerts:reminders:skill:readwrite",
        "consentLevel": "ACCOUNT" }
    ]
  },
  "token": "reminders-consent"
}
```

Alexa le pregunta al adulto y devuelve un **`SessionResumedRequest`** con una causa
`ConnectionCompleted` cuyo resultado es `ACCEPTED`, `DENIED` o `NOT_ANSWERED` (timeout de
8 segundos).

| Resultado | Qué hace Chatio |
| :--- | :--- |
| `ACCEPTED` | `permissionStatus: GRANTED`, reconcilia en la misma sesión, `ActivityEvent` `ALEXA_REMINDER_PERMISSION_GRANTED`, y le dice a qué horas le va a avisar |
| `DENIED` | `permissionStatus: DENIED`, sigue en modo pull, evento registrado, y **no se vuelve a pedir por voz**: el panel le explica al cuidador cómo activarlo desde la app Alexa |
| `NOT_ANSWERED` | No se cambia el estado; se puede reintentar en una sesión futura (máximo una vez por semana, para no acosar al adulto) |

Fallback si el consentimiento por voz no estuviera disponible en `es-MX` (pendiente de
verificación): tarjeta `AskForPermissionsConsent`, que completa el **cuidador** desde la
app Alexa siguiendo las instrucciones del panel.

### 11.2 Reconciliar en cada sesión

Un `RequestInterceptor` (`ReminderSyncInterceptor`) corre en **todo** request de Alexa:

```text
1. ¿Hay AlexaReminderSync pendientes para este adulto?   si no -> no hace nada
2. ¿permissionStatus == GRANTED?                         si no -> no intenta (evita un 401)
3. ¿Backoff cumplido?                                    si no -> espera
4. GET /v1/alerts/reminders   -> estado observado (solo los que creó la skill)
5. Aplica la diferencia: POST (crear) / PUT (mover) / DELETE (sacar)
6. Persiste alertToken y status; emite ActivityEvent por cada cambio efectivo
```

Garantías, todas verificables con tests:

- **Presupuesto duro:** 2 segundos y 6 operaciones por sesión. Lo que no entra queda
  pendiente. Los 8 segundos del ASK son para el adulto, no para nuestra sincronización.
- **No bloquea la respuesta hablada** en ningún caso, excepto en la sesión de vinculación,
  donde sí se espera para poder confirmarle al adulto a qué hora se le va a avisar.
- **Idempotente:** dos reconciliaciones seguidas no producen cambios en la segunda.
- **Silenciosa para el adulto:** los fallos se informan al cuidador en el panel, nunca por
  voz.
- **No toca el dominio:** ninguna operación de sincronización puede cambiar el estado de
  una `MedicationOccurrence`.

### 11.3 El texto del aviso

```text
"Es hora de tu medicación. Decí: Alexa, abre chatio."
```

Sin nombre de medicamento, sin dosis (**D023**). El detalle lo da la skill cuando el
adulto la abre, con datos frescos. Razones en `ALEXA_REMINDERS.md` §5.3: privacidad (el
texto queda almacenado en Amazon, se ve en la app y lo escucha toda la casa), coherencia
con el flujo, y que así el aviso no necesita actualizarse cuando cambia la medicación.
