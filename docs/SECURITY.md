# Seguridad y privacidad — Chatio MVP

Versión 1.0 · Iteración 0 · 2026-09-29

Chatio maneja datos de medicación de personas mayores. Eso es información
sensible de salud incluso en un MVP, y el diseño lo trata como tal desde la
primera línea de código, no en una iteración de "hardening" al final. La
Iteración 17 existe para verificar y cerrar brechas, no para empezar a pensar el
tema.

---

## 1. Qué protegemos

| Activo | Sensibilidad | Impacto si se filtra |
| :--- | :--- | :--- |
| Medicamentos, dosis y horarios de un adulto | **Alta** — dato de salud | Revela condiciones médicas inferibles del tratamiento |
| Historial de tomas y omisiones | **Alta** | Revela estado de salud y grado de autonomía |
| Solicitudes de ayuda | **Alta** | Revela episodios de vulnerabilidad |
| Nombre, fecha de nacimiento, contactos | Media | Identificación y contacto directo con una persona vulnerable |
| Credenciales de cuidadores | **Crítica** | Acceso completo a todo lo anterior |
| Vínculo Alexa ↔ adulto | Alta | Permitiría escuchar/registrar en nombre del adulto |
| Identificadores de Amazon | Media | Correlación con cuentas reales de Amazon |
| Texto de los avisos almacenado en Alexa | Media | Lo almacena Amazon, se ve en la app Alexa y lo escucha toda la casa. **Por eso no contiene datos de salud** (**D023**) |

Marco legal aplicable: **Ley 25.326** de Protección de Datos Personales
(Argentina), que clasifica los datos de salud como *datos sensibles* y exige
consentimiento expreso e informado, finalidad determinada y medidas de seguridad
adecuadas. Consecuencias concretas que ya están incorporadas al diseño:

- El alta del adulto en el panel incluye una declaración explícita de que el
  cuidador cuenta con el consentimiento del adulto (o su representación legal), y
  esa declaración se registra con fecha, usuario y versión del texto mostrado.
- Finalidad declarada y acotada: recordar y registrar. Los datos no se usan para
  otra cosa, no se ceden y no se monetizan.
- Derecho de acceso y supresión: el `OWNER` puede exportar y solicitar la
  eliminación de los datos de un adulto. Export en el backlog; borrado
  administrativo posible desde la Iteración 3.

---

## 2. Principales amenazas y mitigaciones

| # | Amenaza | Mitigación |
| :--- | :--- | :--- |
| T1 | Un cuidador accede a un adulto que no le corresponde (IDOR) | `requireAdultAccess` verifica `CaregiverAccess` **contra la base en cada request**; 404 en lugar de 403 |
| T2 | Escalada de privilegios por *mass assignment* (`role`, `isPlatformAdmin`, `status`) | Zod `strict()` + construcción explícita del objeto a persistir; nunca `Model.create(req.body)` |
| T3 | Robo del token por XSS | Access token en memoria (no `localStorage`), TTL 15 min; refresh en cookie `httpOnly` |
| T4 | Robo del refresh token (CSRF / cookie) | `httpOnly` + `Secure` + `SameSite=Strict` + `Path` acotado + rotación en cada uso + versionado por usuario |
| T5 | Fuerza bruta de contraseñas | bcrypt cost 12, rate limit 5/15 min por IP+email, mensaje y tiempo de respuesta uniformes |
| T6 | Enumeración de usuarios | Respuestas idénticas en login y en alta de cuidador; sin registro público |
| T7 | Request falso al endpoint de Alexa | Verificación obligatoria de firma ASK + `applicationId` + tolerancia de timestamp de 150 s |
| T8 | Vinculación indebida de un Echo a un adulto | Código de un uso originado por un `OWNER` autenticado, TTL 15 min, 5 intentos/hora, aviso por email, revocación inmediata |
| T9 | Inyección NoSQL por operadores en el body (`{"$gt":""}`) | Validación de tipos con Zod antes de Mongoose + `sanitizeFilter`; jamás se interpola input en un filtro |
| T10 | Filtración de datos sensibles por logs | Redacción por lista explícita; logs estructurados sin PII de salud (§8) |
| T11 | Filtración por mensajes de error | Envoltorio único de error; nunca stack, nunca detalle de Mongo hacia el cliente |
| T12 | Escucha por un tercero en el hogar (Echo compartido) | La skill dice lo mínimo necesario; no lee contactos, no da datos de otros adultos |
| T13 | Abuso del endpoint público de la skill (DoS) | Rate limit por `alexaUserIdHash` post-firma + límites globales del hosting |
| T14 | Dependencia comprometida | `npm ci` con lockfile, `npm audit` en CI, dependencias mínimas y evaluadas una por una |
| T15 | Secretos en el repositorio | `.gitignore` estricto, `.env.example` sin valores reales, validación de env al arrancar |
| T16 | Filtración de datos de salud hacia Amazon vía el texto de los avisos | El texto es genérico: *"Es hora de tu medicación"*. Sin nombre, dosis ni indicación (**D023**) |
| T17 | Fuga del `apiAccessToken` de Alexa por logs o persistencia | Se usa dentro del request y **no se persiste ni se loguea**; está en la lista de redacción |
| T18 | Un aviso proactivo interpretado como toma confirmada | Invariante con test: ninguna operación de sincronización altera una `MedicationOccurrence` (**D021**) |

---

## 3. Autenticación

**Decisión D001.** Access token corto + refresh rotativo en cookie `httpOnly`.

| Parámetro | Valor |
| :--- | :--- |
| Algoritmo | HS256 con secretos distintos para access y refresh (≥ 32 bytes aleatorios) |
| Access TTL | 15 minutos |
| Refresh TTL | 7 días |
| Transporte del access | `Authorization: Bearer` |
| Almacenamiento del access | Memoria del frontend (estado de React), **nunca** `localStorage` ni `sessionStorage` |
| Transporte del refresh | Cookie `chatio_rt`: `httpOnly; Secure; SameSite=Strict; Path=/api/v1/auth` |
| Rotación | En cada `/auth/refresh`. El servidor guarda el `SHA-256` del token vigente en `auth_sessions`, así que el anterior deja de existir (**D028**) |
| Detección de reutilización | Un token válido cuyo hash no es el vigente es un replay: se revoca **la sesión entera**, no las demás del usuario |
| Revocación por sesión | `logout` revoca solo ese dispositivo |
| Revocación masiva | Se revocan todas las sesiones y se incrementa `user.tokenVersion`, que `requireAuth` compara en cada request: efecto inmediato también sobre los access tokens (**D029**) |
| Claims del access | `sub`, `tv`, `iat`, `exp`, `iss: "chatio"`, `aud: "chatio-web"`. **Sin email ni rol** (**D028**) |
| Claims del refresh | `sub`, `sid`, `tv`, `jti`, `aud: "chatio-refresh"` |

Por qué no un JWT simple de 8 horas en `localStorage`, que sería más fácil: con un
único XSS un atacante se lleva una sesión de 8 horas sobre datos de salud, sin
posibilidad de revocarla. El costo de esta decisión es un interceptor de refresh en
el cliente y una cookie bien configurada. Es la relación costo/beneficio más clara
del proyecto.

Contraseñas:

- **bcrypt, cost 12** (configurable por entorno, con un mínimo de 12 impuesto en
  producción por la validación del arranque). Nunca en texto plano, nunca MD5/SHA, nunca
  cifrado reversible. `passwordHash` tiene `select: false` en el esquema, así que no puede
  filtrarse por un `findOne` distraído, y `toJSON` lo elimina igual por si alguien lo pide
  explícitamente.
- Mínimo 10 caracteres, comparación contra una lista de contraseñas comunes, y sin
  reglas de composición arbitrarias (favorecen contraseñas peores y molestan al
  usuario). Sin expiración forzada.
- Comparación siempre con `bcrypt.compare` (tiempo constante). Si el usuario no
  existe, se compara igual contra un hash dummy para no filtrar por timing.
- La política **no se aplica en el login**, solo al crear o cambiar una contraseña:
  validar el formato en el login filtraría información sobre lo almacenado y dejaría
  afuera a una cuenta vieja que ya no cumple la política.
- El *reset* de contraseña queda fuera del MVP porque no hay registro público: lo
  hace un `isPlatformAdmin`. Registrado como deuda técnica **DT03**.

### CSRF (decisión **D030**)

Las dos mitades de la sesión tienen exposiciones distintas, y de ahí sale la protección:

| | Transporte | ¿CSRF? |
| :--- | :--- | :--- |
| Access token | Header `Authorization` | **No.** El navegador no lo agrega solo en una petición cross-site; hay que ponerlo con JavaScript, y para eso ya hace falta el token |
| Refresh token | Cookie `httpOnly` | **Sí en principio**, porque las cookies sí viajan solas. Es lo que hay que cubrir |

Los dos únicos endpoints que la cookie alcanza son `POST /auth/refresh` y
`POST /auth/logout` (por el `Path=/api/v1/auth`). Su protección es:

1. **`SameSite=Strict`**: el navegador **no envía** la cookie en ninguna petición
   originada en otro sitio, así que un formulario o un `fetch` desde un sitio del atacante
   llega sin cookie y recibe 401. Esta es la defensa principal.
2. **Solo `POST`**: no hay forma de dispararlos con una navegación o una imagen.
3. **CORS con allowlist** y `credentials: true`: un `fetch` cross-origin desde un sitio no
   permitido no puede leer la respuesta.
4. El peor caso de un CSRF exitoso en `/logout` sería cerrarle la sesión al usuario, y en
   `/refresh` rotar su token sin poder leer el nuevo access token (la respuesta queda
   bloqueada por CORS).

**No se agrega una librería CSRF ni un token sincronizador.** Con `SameSite=Strict` sobre
una topología same-site sería redundante, y un mecanismo de más que mantener y equivocar.

**Condición que hay que respetar, y es la letra chica de esta decisión:** el panel debe
servirse **desde el mismo sitio** que la API — que es exactamente la topología de
**D015** (Nginx sirve el frontend estático y hace `proxy_pass` a la API en el mismo
dominio). Si algún día el panel se moviera a otro dominio, `SameSite=Strict` impediría que
la cookie viaje, habría que pasar a `SameSite=None; Secure` y **entonces sí** haría falta
protección CSRF explícita. Está anotado como riesgo **R18**.

Los adultos mayores **no tienen credenciales**: no inician sesión en ningún lugar.
Su "autenticación" es la posesión física del Echo vinculado, y se documenta como
tal, con sus límites (§T12).

---

## 4. Autorización

Tres capas, en este orden, y ninguna se puede saltear:

```text
1. requireAuth            -> valida el JWT y CARGA EL USUARIO de la base (D029);
                             deja la identidad en req.actor
2. requirePlatformAdmin   -> solo para /admin/*; NO da acceso a datos de adultos
3. requireAdultAccess     -> lee CaregiverAccess (userId, adultId, ACTIVE)
                             contra la BASE; adjunta req.adultAccess.role
4. requireRole('OWNER')   -> solo en las rutas que lo piden
```

La identidad autenticada vive en **`req.actor`** (`{ userId, isPlatformAdmin, user }`) y es
la **única** fuente de identidad de la cadena: ningún controlador toma el id del usuario
del body, del query ni de la URL.

Desde la Iteración 3, los pasos 3 y 4 también están implementados: `requireAdultAccess`
consulta `CaregiverAccess` en cada request y `requireRole` aplica la matriz
OWNER/CAREGIVER. Un acceso revocado deja de funcionar sin esperar la expiración del JWT.

Reglas de hierro:

- **El `adultId` viaja siempre en la URL, nunca en el body.** Por eso un único
  middleware protege todo el árbol `/adults/:adultId/**`, y no hay forma de agregar
  un endpoint nuevo bajo ese prefijo y olvidarse de autorizarlo.
- **Nunca se confía en un id del cliente.** El `userId` sale del JWT, no del
  payload. `source`, `confirmedByUserId`, `createdByUserId` y `status` los fija el
  servidor.
- **Se re-verifica contra la base en cada request**, no contra el token: un acceso
  revocado hace 10 segundos tiene que dejar de funcionar ahora, no cuando expire el
  token.
- Los recursos hijos (`medicationId`, `occurrenceId`, `reminderId`) se cargan
  **siempre** filtrando por `adultId` además de por `_id`. Un id válido de otro
  adulto devuelve 404.
- Un recurso inaccesible responde **404**, no 403: un 403 confirmaría que ese id
  existe.

Matriz de roles: `DATA_MODEL.md` §3.3. `isPlatformAdmin` **no** da acceso a datos
de adultos: sirve para crear usuarios y nada más. Que el soporte técnico pueda leer
la medicación de cualquiera es una mala decisión por defecto.

---

## 5. Validación de entradas

- Zod en el borde para `params`, `query` y `body`, en un middleware `validate()`.
- `.strict()` en todo schema de body: una propiedad desconocida es un error, no algo
  que se ignora. Es la defensa concreta contra *mass assignment*.
- Los ids se validan como `ObjectId` bien formado **antes** de llegar a Mongo.
- Toda cadena con `trim` y longitud máxima. Enums cerrados. Números con rango.
- Fechas y horas con formato estricto (`YYYY-MM-DD`, `HH:mm`) y validación
  semántica (`endDate ≥ startDate`, timezone IANA existente).
- `express.json({ limit: '32kb' })`. No hay razón para aceptar bodies grandes.
- Contra inyección NoSQL: los tipos validados hacen imposible que un objeto
  `{ $gt: "" }` llegue a un filtro, y además se activa `mongoose.set('sanitizeFilter', true)`.
- El texto libre (`notes`, `resolutionNote`, `instructions`) se guarda tal cual y se
  escapa **al renderizar**. React escapa por defecto; queda prohibido
  `dangerouslySetInnerHTML` en todo el proyecto.

---

## 6. Endpoint de Alexa

Ver `ALEXA_SKILL.md` §6. Resumen de controles:

1. Firma ASK verificada sobre el **body crudo** (el parser JSON global se monta
   después de esta ruta).
2. Cadena de certificados validada: origen S3 de Amazon y SAN `echo-api.amazon.com`.
3. `timestamp` con tolerancia de 150 s → protección anti-replay.
4. `applicationId` comparado con `ALEXA_SKILL_ID`.
5. Rate limit por `alexaUserIdHash` **después** de la firma, para que tráfico no
   firmado no consuma la cuota de un usuario legítimo.
6. `ALEXA_VERIFY_SIGNATURE=false` solo se admite si `NODE_ENV !== 'production'`; el
   arranque falla si alguien lo intenta en producción.
7. La skill es de **solo lectura + confirmación**. No puede crear, editar ni borrar
   medicamentos ni recordatorios, ni gestionar cuidadores. Un comando de voz no
   puede cambiar un tratamiento.

---

## 7. Secretos y configuración

- Todo por variables de entorno, validadas con Zod al arrancar: si falta una
  obligatoria o un secreto es demasiado corto, **el proceso no levanta**. Fallar
  ruidosamente al inicio es mejor que descubrirlo en producción.
- `.env` está en `.gitignore`. `.env.example` documenta cada variable **sin valores
  reales**.
- Secretos de producción solo en el archivo de entorno del VPS, con permisos `600`
  y dueño del usuario del servicio. Nunca en el repositorio, en capturas, en el
  ROADMAP ni en un chat.
- Secretos distintos por entorno. Generados con `crypto.randomBytes(48)`.
- Usuario de MongoDB con mínimo privilegio (`readWrite` sobre la base de Chatio y
  nada más), autenticación habilitada y escucha restringida a `localhost`.
- Rotación: documentada y probada una vez antes del deploy (Iteración 19). Rotar
  `JWT_REFRESH_SECRET` desloguea a todos, que es el comportamiento correcto.

---

## 8. Logs

Nunca se loguea:

```text
Authorization · cookies · access/refresh tokens · passwordHash · password
códigos de vinculación (ni su hash) · alexaUserId / deviceId completos
apiAccessToken de Alexa · alertToken completo (se loguea truncado)
nombres de medicamentos junto a datos identificatorios del adulto
contenido de notes · emails completos en logs de nivel info · stacks al cliente
```

Sí se loguea: `requestId`, método, **pathname sin query string**, status, duración,
`userId`, `adultId`, `alexaUserIdHash` truncado a 8 caracteres, tipo de intent, código de
error de la API.

Dos convenciones que la implementación obligó a fijar:

- **El query string no se loguea**: puede llevar identificadores o datos personales, y un
  log de acceso no es el lugar para eso. Del `url` solo se registra el `pathname`.
- **El código de vinculación se llama siempre `pairingCode`** en el código, nunca `code`.
  `code` es el nombre del campo del código de error de la API (`VALIDATION_ERROR`, …) y
  redactarlo dejaría los logs sin capacidad de diagnóstico. La redacción se hace por nombre
  semántico de campo, no por una palabra ambigua.

- `pino` con `redact` configurado por lista explícita de rutas, no por heurística.
- Nivel `info` en producción, `debug` solo en desarrollo.
- Los errores llevan el `requestId` que se devuelve al cliente: se puede
  diagnosticar sin que el cliente vea nada interno.
- Retención de logs acotada (lo que dé el hosting, objetivo 30 días). Los logs no
  son un almacén paralelo de datos de salud.

---

## 9. Auditoría

Las acciones de negocio se auditan en `activity_events` (ver `DATA_MODEL.md` §3.7),
que es append-only y guarda quién (`actorUserId`), qué (`type`), cuándo
(`occurredAt`) y desde dónde (`source`): creación y edición de medicamentos,
confirmaciones y omisiones, alta y baja de cuidadores, vinculación y desvinculación
de Alexa, atención de solicitudes de ayuda.

Las acciones de **seguridad** (login exitoso, login fallido, refresh rechazado,
código de vinculación inválido, 403) van al log estructurado, no al timeline del
adulto: no le importan al familiar y no deben mezclarse con datos de salud.

No hace falta una colección de audit log aparte en el MVP. Si más adelante se
necesita auditoría inmutable con retención legal, se agrega una colección
dedicada con TTL propio.

---

## 10. Transporte y cabeceras

- **HTTPS obligatorio** en todo. La API rechaza HTTP en producción
  (`app.set('trust proxy', 1)` + redirección o rechazo).
- HSTS: `max-age=31536000; includeSubDomains`.
- `helmet` con: `contentSecurityPolicy` (sin `unsafe-inline` en scripts),
  `noSniff`, `frameguard: deny`, `referrerPolicy: no-referrer`,
  `crossOriginResourcePolicy`.
- CORS con **allowlist explícita** desde `CORS_ORIGINS` y `credentials: true`.
  Nunca `origin: '*'` (además es incompatible con cookies).
- `x-powered-by` desactivado.
- El endpoint de Alexa queda exento de CORS (no lo llama un navegador).

### Seguridad del servidor (consecuencia de D015: VPS propio)

Al alojar en un VPS propio, estos controles son nuestros y no del proveedor. Cada uno
es una tarea verificable de la Iteración 19:

- **SSH:** solo clave pública. Login por contraseña deshabilitado, acceso directo de
  root deshabilitado, `fail2ban` activo.
- **Firewall (`ufw`):** únicamente 22, 80 y 443 abiertos. Todo lo demás cerrado.
- **MongoDB escuchando solo en `localhost`**, con autenticación habilitada y usuario
  de aplicación con `readWrite` limitado a la base de Chatio. Jamás expuesto a
  internet — una base Mongo abierta es la forma más común de filtrar datos de salud.
- **Actualizaciones de seguridad automáticas** (`unattended-upgrades`).
- **TLS por Let's Encrypt con renovación automática verificada.** Un certificado
  vencido rompe la skill entera, no solo el panel.
- **Archivo de entorno con permisos `600`**, dueño del usuario del servicio, fuera del
  repositorio y del directorio servido por Nginx.
- **Backups diarios cifrados y copiados fuera del VPS**, con una restauración
  efectivamente probada. Con la base en el mismo host, es el único mecanismo que evita
  la pérdida total.
- **Rotación de logs** con retención acotada: los logs no son un almacén paralelo de
  datos de salud.
- **NTP sincronizado:** un reloj desfasado produce tomas a la hora equivocada.

---

## 11. Minimización de datos

Ver `DATA_MODEL.md` §7. En una línea: no se guardan diagnósticos, historia clínica,
DNI, dirección ni obra social; `birthDate` es opcional; **no se guarda audio ni
transcripciones** de lo que dice el adulto, solo el intent resuelto; los
identificadores de Amazon se guardan hasheados.

El adulto mayor no es el usuario que acepta los términos, y eso es un problema
ético real, no solo legal: el diseño lo compensa guardando poco, no exponiendo su
información a terceros, y dejando que su familia pueda borrarlo.

---

## 12. Límites explícitos del producto

Declarados en la UI, en la skill y en la descripción del store:

- Chatio **no es un servicio de emergencias** y no reemplaza al 911 ni a un sistema
  de teleasistencia médica.
- Chatio **no diagnostica**, no sugiere dosis, no interpreta síntomas y no modifica
  tratamientos. Solo registra, recuerda y comunica lo que un cuidador configuró.
- Chatio **avisa, pero no vigila**: crea un recordatorio en Alexa para la hora de la toma
  (**D021**), pero no escucha de forma continua, no detecta caídas y no puede saber si el
  adulto escuchó el aviso, si estaba en casa o si el Echo estaba encendido. Un aviso
  programado no es un aviso entregado, y un aviso entregado no es una toma.
- **Las solicitudes de ayuda se notifican por email** y eso es todo lo que el MVP hace
  (**D011**). El email puede leerse tarde o caer en spam: **no es un sistema de
  emergencias**, no garantiza entrega ni tiempo de respuesta, y así está declarado en la
  UI y en la skill. Quien necesite asistencia inmediata tiene que llamar al 911.
- La confirmación de una toma significa que **alguien le dijo a Alexa** que la toma
  ocurrió. No es una verificación de que el medicamento se ingirió. La UI usa este
  lenguaje, no "tomó el medicamento".

Este último punto es el más importante del documento para evitar daño real: un
familiar que interpreta "confirmado" como "verificado" puede dejar de controlar.

---

## 13. Checklist de la Iteración 17

- [ ] Ningún endpoint bajo `/adults/:adultId` sin `requireAdultAccess` (test que
      recorre el router y falla si aparece uno nuevo sin proteger)
- [ ] Test de autorización por cada endpoint: sin token, con token de otro
      cuidador, con rol insuficiente
- [ ] Ningún `Model.create(req.body)` ni `Object.assign(doc, req.body)` en el código
- [ ] Todos los schemas de body con `.strict()`
- [ ] Rate limits activos y verificados con tests
- [ ] `helmet`, CORS allowlist y HSTS verificados sobre el deploy real
- [ ] Redacción de logs verificada con un test que busca patrones sensibles en la
      salida del logger
- [ ] Firma de Alexa verificada en producción; `ALEXA_VERIFY_SIGNATURE=false`
      imposible en producción
- [ ] `npm audit` sin vulnerabilidades altas o críticas
- [ ] Validación de env al arrancar probada quitando una variable
- [ ] Secretos rotados desde los valores de desarrollo, y rotación documentada
- [ ] Usuario de Mongo con mínimo privilegio, autenticación habilitada y escucha
      restringida a `localhost` (verificado con un escaneo desde otra máquina)
- [ ] SSH sin contraseñas y sin root; `ufw` con solo 22/80/443; `fail2ban` activo
- [ ] Actualizaciones automáticas activas y NTP sincronizado
- [ ] Renovación de TLS probada con un dry run, no solo configurada
- [ ] Archivo de entorno de producción con permisos `600` y fuera del repositorio
- [ ] Backups diarios cifrados **fuera del VPS** y **una restauración probada** en un
      entorno limpio
- [ ] Registro de consentimiento presente en el alta de adultos
- [ ] Privacy policy y terms publicados, mencionando que la skill crea recordatorios en
      la cuenta de Alexa del usuario (requisito de certificación)
- [ ] El texto de los avisos no contiene nombres de medicamentos, dosis ni indicaciones
      (verificado con un test sobre el generador de texto)
- [ ] El `apiAccessToken` no aparece en logs ni en la base (verificado con test)
- [ ] Test del invariante: ninguna operación de sincronización de avisos altera el
      `status` de una `MedicationOccurrence`
