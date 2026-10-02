# Chatio

Plataforma de asistencia para adultos mayores. Un familiar o cuidador configura
información (medicamentos, recordatorios, datos de contacto) desde una aplicación
web; el adulto mayor consulta e interactúa por voz a través de **Amazon Alexa**; el
familiar ve en el panel qué ocurrió.

> Chatio **registra, recuerda y comunica** información configurada previamente.
> No es un sistema de diagnóstico médico, no modifica tratamientos y **no
> reemplaza a los servicios de emergencia**.

---

## Estado del proyecto

| | |
| :--- | :--- |
| Iteración actual | **5 — Ocurrencias y confirmaciones → COMPLETADA** |
| Estado | Medicamentos, ocurrencias materializadas, confirmaciones declaradas y 235 tests en verde |
| Código de aplicación | `backend/` con infraestructura, autenticación, adultos, cuidadores, medicamentos, ocurrencias y auditoría mínima. Recordatorios, frontend y Alexa todavía no implementados |
| Fuente de verdad del progreso | [`ROADMAP.md`](ROADMAP.md) |

El código se crea iteración por iteración, tarea por tarea. El backend ya tiene la base de
Express, autenticación, adultos/cuidadores, medicamentos, ocurrencias y autorización por
persistencia. La siguiente iteración implementará recordatorios y agenda diaria.

```bash
# Backend (desde backend/)
npm ci
npm run dev            # requiere un MongoDB accesible en MONGODB_URI
npm test               # 235 tests
npm run lint
```

Antes de arrancar hay que copiar `.env.example` a `.env` **en la raíz del repositorio** y
completarlo.

---

## Alcance del MVP

Lo que el MVP **sí** hace:

- Alta y administración de adultos mayores por parte de familiares/cuidadores.
- Configuración de medicamentos con horarios (días, horas, rango de vigencia).
- Generación de **ocurrencias de medicación** (cada toma que debía suceder) con
  historial completo: programada, confirmada, omitida, no confirmada.
- Recordatorios no farmacológicos (turno médico, tomar agua, llamar a alguien).
- **Aviso proactivo a la hora de la toma**, mediante la Alexa Reminders API: el adulto no
  necesita acordarse de preguntar (ver [`docs/ALEXA_REMINDERS.md`](docs/ALEXA_REMINDERS.md)).
- Agenda del día consultable por voz.
- Confirmación de tomas por voz ("ya tomé mi medicamento").
- Solicitud de ayuda por voz, con registro y notificación al familiar.
- Línea de tiempo de actividad relevante del adulto.

Lo que el MVP **no** hace (ver *Backlog futuro* en `ROADMAP.md`):

Xiaozhi, ESP32, INMP441, MAX98357A ni hardware propio · detección de caídas ·
cámaras o visión artificial · app móvil nativa · IA conversacional abierta ·
diagnóstico médico · ajuste automático de tratamientos · microservicios, colas o
Kubernetes · WhatsApp/SMS/push avanzado.

Tres límites que el producto declara de forma explícita, porque confundirlos puede hacer
daño:

- **Un aviso programado no es un aviso escuchado.** Chatio le pide a Alexa que avise; no
  puede saber si el adulto estaba en casa, si el Echo estaba encendido ni si escuchó.
- **Una confirmación es una declaración, no una verificación.** Que alguien le diga a Alexa
  "ya lo tomé" no prueba que el medicamento se haya ingerido. Por eso la interfaz dice
  *"María confirmó que tomó Losartán 50 mg"* y nunca *"Medicamento tomado"*.
- **El aviso de ayuda por email no es un sistema de emergencias.** No garantiza entrega ni
  tiempo de respuesta. Ante una emergencia hay que llamar al 911.

---

## Stack

| Capa | Tecnología |
| :--- | :--- |
| Frontend | React 18 + Vite + Tailwind CSS + TanStack Query + React Router |
| Backend | Node.js 20 LTS + Express 4 + Mongoose 8 |
| Base de datos | MongoDB 7 |
| Auth panel | JWT (access corto + refresh rotativo en cookie `httpOnly`) |
| Voz | Alexa Skills Kit — Custom Skill, endpoint HTTPS propio (no AWS Lambda) |
| Avisos proactivos | Alexa Reminders API (permiso `alexa::alerts:reminders:skill:readwrite`) |
| Fechas/zonas | Luxon (IANA timezones) |
| Validación | Zod |
| Tests | Vitest + Supertest + mongodb-memory-server (back) · Vitest + Testing Library (front) |

La lógica de negocio vive en Chatio. Alexa es **solamente** una interfaz de voz.

---

## Documentación

| Documento | Contenido |
| :--- | :--- |
| [`ROADMAP.md`](ROADMAP.md) | **Fuente de verdad.** Iteraciones, tareas, criterios de aceptación, registro de decisiones, bitácora, deuda técnica, reglas de trabajo. |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Arquitectura, capas, estructura de carpetas, flujos críticos, scheduler, zonas horarias, límites reales de Alexa. |
| [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) | Colecciones, campos, enums, índices, relaciones, soft delete y por qué se descartaron otras opciones. |
| [`docs/API.md`](docs/API.md) | Contratos REST del panel, convenciones, errores, paginación, endpoint de Alexa. |
| [`docs/ALEXA_SKILL.md`](docs/ALEXA_SKILL.md) | Invocation name, intents, utterances, slots, respuestas, vinculación, manejo de errores, certificación. |
| [`docs/ALEXA_REMINDERS.md`](docs/ALEXA_REMINDERS.md) | Análisis de la Reminders API contra documentación oficial (permisos, consentimiento, límites, errores, revocación) y diseño de la sincronización. |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Modelo de amenazas, autenticación, autorización, rate limiting, secretos, logs, auditoría, datos de salud. |
| [`docs/TESTING.md`](docs/TESTING.md) | Estrategia de pruebas por capa y casos borde obligatorios de Alexa. |
| [`docs/FRONTEND.md`](docs/FRONTEND.md) | Pantallas del panel, sistema de diseño, accesibilidad y patrones de estado. |

---

## Estructura prevista del repositorio

Se crea incrementalmente; hoy solo existen los documentos.

```text
chatio/
├── README.md
├── ROADMAP.md
├── CLAUDE.md
├── .env.example
├── .gitignore
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DATA_MODEL.md
│   ├── API.md
│   ├── ALEXA_SKILL.md
│   ├── ALEXA_REMINDERS.md
│   ├── SECURITY.md
│   ├── TESTING.md
│   └── FRONTEND.md
├── backend/                 # Iteración 1+
│   ├── src/
│   │   ├── config/          # env, db, logger
│   │   ├── models/          # esquemas Mongoose
│   │   ├── modules/         # auth, adults, medications, occurrences,
│   │   │                    # reminders, activity, help, agenda, reminderSync
│   │   ├── alexa/           # handlers de la skill (adaptadores, sin negocio)
│   │   ├── jobs/            # materializador de ocurrencias, sweeper
│   │   ├── middleware/      # auth, authorize, validate, rateLimit, errors
│   │   ├── lib/             # time, ids, mailer
│   │   ├── app.js
│   │   └── server.js
│   └── tests/
└── frontend/                # Iteración 8+
    ├── src/
    │   ├── app/             # router, providers
    │   ├── features/        # auth, dashboard, adults, medications,
    │   │                    # reminders, activity, settings
    │   ├── components/      # UI compartida
    │   ├── lib/             # apiClient, queryClient, formatters
    │   └── main.jsx
    └── tests/
```

Backend y frontend son dos paquetes npm independientes en un mismo repositorio,
sin workspaces ni monorepo tooling (ver decisión **D016** en `ROADMAP.md`).

---

## Reglas de trabajo

Antes de escribir código en cualquier sesión: leer `ROADMAP.md`, identificar la
iteración activa, trabajar **solo** la primera tarea sin marcar, verificar contra
los criterios de aceptación y tests, y actualizar `ROADMAP.md`. Las reglas
completas están en la sección *Reglas para futuras sesiones* de `ROADMAP.md`.
