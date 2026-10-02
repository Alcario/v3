# Frontend — Chatio MVP

Versión 1.0 · Iteración 0 · 2026-09-29 · React 18 + Vite + Tailwind + TanStack Query

---

## 1. Quién usa este panel

**No** el adulto mayor: el adulto usa la voz y nunca abre esta aplicación. El panel
lo usa un familiar o cuidador, que típicamente:

- No es técnico. No sabe qué es una zona horaria IANA ni un cron.
- Entra poco y con apuro: quiere saber si su madre tomó la pastilla y cerrar.
- Puede estar en otro país, con varias horas de diferencia.
- Está preocupado. Si hay un pedido de ayuda, tiene que verlo de inmediato.
- Usa el teléfono tanto como la computadora.

De esto salen tres reglas que gobiernan todo el diseño:

1. **Lo urgente primero y sin scroll.** Un pedido de ayuda abierto no se esconde en
   una pestaña.
2. **Las horas son las del adulto, siempre, y se dice de quién son.** Es el error más
   fácil de cometer y el más peligroso.
3. **El lenguaje no miente.** Nunca "Medicamento tomado": *"María confirmó que tomó
   Losartán 50 mg"*. Lo único que tenemos es una declaración del adulto, no una
   verificación de que el medicamento se ingirió. Lo mismo con los avisos: *"aviso
   programado"* nunca se muestra como *"aviso escuchado"*. La diferencia importa (ver
   `SECURITY.md` §12, riesgo R03).

   Vocabulario obligatorio, y es normativo para todo texto de la UI:

   | Nunca | Siempre |
   | :--- | :--- |
   | "Medicamento tomado" | "Confirmó que lo tomó" |
   | "María tomó Losartán" | "María confirmó que tomó Losartán 50 mg" |
   | "No tomó el medicamento" | "No confirmó la toma" |
   | "Avisado" / "Escuchó el aviso" | "Aviso programado en Alexa" |
   | "Ayuda enviada" | "Aviso por email enviado a los cuidadores" |

---

## 2. Arquitectura del frontend

```text
src/
├── app/            router, providers (Auth, Adult, QueryClient), ErrorBoundary
├── features/
│   ├── auth/       login, useAuth
│   ├── dashboard/  vista principal
│   ├── adults/     listado, formulario, contactos
│   ├── medications/listado, formulario, editor de horarios
│   ├── reminders/  listado, formulario
│   ├── activity/   timeline
│   ├── help/       tarjeta de solicitud, acciones
│   └── settings/   cuidadores, Alexa, datos básicos
├── components/     UI compartida sin lógica de dominio
└── lib/            apiClient, queryKeys, time, format, validation
```

Cada `feature` agrupa sus componentes, sus hooks de datos (`useMedications`,
`useConfirmOccurrence`) y sus tipos. Nada de carpetas globales `hooks/` o `utils/`
que se convierten en cajones de sastre.

### Estado

| Tipo de estado | Dónde vive |
| :--- | :--- |
| Datos del servidor | **TanStack Query**, única fuente de verdad. Sin copiarlos a estado local |
| Access token | Memoria, en `AuthProvider` (**nunca** `localStorage`, D001) |
| Adulto seleccionado | `AdultProvider`; solo el **id** se persiste en `localStorage` |
| Estado de formularios | `react-hook-form` |
| Estado de UI (modales, tabs) | `useState` local |

No hay Redux ni Zustand: no hay estado global compartido que lo justifique
(**D020**).

### Claves de query

Centralizadas en `lib/queryKeys.js` y **siempre** con el `adultId` incluido, para que
cambiar de adulto no muestre datos del anterior:

```js
export const qk = {
  me: ['me'],
  today: (adultId, date) => ['adults', adultId, 'today', date ?? 'hoy'],
  medications: (adultId, opts) => ['adults', adultId, 'medications', opts],
  reminders: (adultId, opts) => ['adults', adultId, 'reminders', opts],
  occurrences: (adultId, filters) => ['adults', adultId, 'occurrences', filters],
  activity: (adultId, filters) => ['adults', adultId, 'activity', filters],
  helpOpen: ['help-requests', 'open'],
  caregivers: (adultId) => ['adults', adultId, 'caregivers'],
  alexaLink: (adultId) => ['adults', adultId, 'alexa-link'],
};
```

Confirmar una toma invalida `today`, `occurrences` y `activity` de ese adulto. Nada
de `queryClient.invalidateQueries()` sin argumentos.

### Cliente de API

`lib/apiClient.js`: wrapper sobre `fetch` con `credentials: 'include'`, que agrega el
`Authorization`, desempaqueta `{ data }`, y convierte `{ error }` en una excepción
`ApiError` con `code`, `message` y `details`. Ante un 401, intenta el refresh **una
sola vez**, reintenta la request original, y si el refresh falla limpia la sesión y
redirige a login sin bucle.

---

## 3. Sistema de diseño

Los usuarios no son adultos mayores, pero muchos son personas de 50 a 70 años
leyendo en un teléfono con apuro. El diseño es sobrio y grande, no denso.

| Token | Valor |
| :--- | :--- |
| Tipografía | Sistema (`ui-sans-serif`), base **16 px**; nada por debajo de 14 px |
| Escala | `text-base` para contenido, `text-lg`/`text-xl` para datos importantes |
| Contraste | Mínimo **4.5:1** en texto; 3:1 en elementos gráficos (WCAG AA) |
| Área táctil | Mínimo **44 × 44 px** en todo lo clickeable |
| Espaciado | Escala de 4 px; aire generoso, sin tablas apretadas |
| Radios | `rounded-lg` uniforme |
| Sombras | Una sola elevación para tarjetas; nada decorativo |

Paleta semántica (no decorativa):

```text
neutral   texto y superficies
primary   acciones principales
success   toma confirmada
warning   toma pendiente / vencida sin confirmar
danger    solicitud de ayuda
info      recordatorios
```

**El color nunca es el único portador de significado**: todo estado lleva además
texto y, cuando ayuda, un ícono. Un familiar con daltonismo tiene que distinguir
"confirmado" de "no confirmado".

### Accesibilidad (requisito, no mejora)

- HTML semántico: `main`, `nav`, `h1`–`h3` en orden, `button` para acciones y `a`
  para navegación.
- Todo input con `<label>` asociada. Sin placeholders como etiqueta.
- Errores de validación asociados con `aria-describedby` y anunciados con
  `role="alert"`.
- Foco visible siempre (nunca `outline: none` sin reemplazo).
- Modales con foco atrapado, cierre con `Escape` y retorno del foco al disparador.
- Estados de carga anunciados con `aria-busy` / `aria-live="polite"`.
- Operable **completamente con teclado**; se verifica en cada iteración de frontend.
- Los tests usan `getByLabelText` y `getByRole`: si el test no encuentra el campo por
  su etiqueta, un lector de pantalla tampoco.

### Responsive

Mobile-first. Un solo breakpoint significativo (`md`, 768 px): una columna en
teléfono, dos o tres en escritorio. Sin scroll horizontal a 360 px. En teléfono las
tablas se vuelven tarjetas apiladas, no tablas con scroll.

---

## 4. Pantallas

### 4.1 Login

Una sola columna centrada: logo, email, contraseña, botón. Sin "crear cuenta" (no
hay registro público, **D002**). Sin "olvidé mi contraseña" en el MVP (**DT03**):
en su lugar, una línea con el contacto de soporte.

Errores: mensaje genérico *"Email o contraseña incorrectos"*, en `role="alert"`.
Estado de carga que deshabilita el botón para evitar el doble envío.

### 4.2 Dashboard

La pantalla que más se usa. Jerarquía de arriba hacia abajo:

```text
┌──────────────────────────────────────────────────────────────┐
│ Chatio        [Rosa Gómez ▾]              Ana ▾  (salir)     │
├──────────────────────────────────────────────────────────────┤
│  ⚠  PEDIDO DE AYUDA                                          │
│     Rosa pidió ayuda hoy a las 21:17 (hora de Rosa)          │
│     Insistió 2 veces · Avisado por email 21:17               │
│     [ Estoy atendiendo ]  [ Marcar resuelta ]                │
├──────────────────────────────────────────────────────────────┤
│  Hoy, lunes 29 de septiembre        Hora de Rosa: 14:32      │
│                                                               │
│  Medicación       1 confirmada · 1 pendiente · 0 sin confirmar│
├───────────────────────────────┬───────────────────────────────┤
│  PRÓXIMA MEDICACIÓN           │  PRÓXIMOS RECORDATORIOS       │
│  Metformina  500 mg           │  16:00  Tomar agua            │
│  Hoy 13:00 · pendiente        │  Mañana 10:30  Cardiólogo     │
│  [ Registrar que la tomó ]    │                               │
├───────────────────────────────┴───────────────────────────────┤
│  ÚLTIMAS ACTIVIDADES                          (ver todo →)    │
│  09:02  Confirmó Losartán 50 mg           por voz             │
│  10:14  Consultó su agenda del día        por voz             │
└──────────────────────────────────────────────────────────────┘
```

Detalles que importan:

- El bloque de ayuda solo aparece si hay una solicitud abierta, y aparece **arriba de
  todo**, con `role="alert"`.
- "Hora de Rosa" se muestra siempre que la zona del adulto difiera de la del
  navegador. Si coinciden, se omite para no ensuciar.
- Nunca se dice "Rosa tomó"; se dice "confirmó". Y el botón del cuidador dice
  "Registrar que la tomó", porque eso es literalmente lo que hace.
- Máximo 5 bloques. Si hace falta un sexto, algo tiene que salir.
- Polling de solicitudes abiertas cada 30 s (`refetchInterval`), y `refetchOnWindowFocus`
  para que al volver a la pestaña esté actualizado.

### 4.3 Adultos

Listado en tarjetas: nombre, estado, zona horaria, si tiene Alexa vinculada, rol del
usuario sobre ese adulto. Alta y edición en formulario: nombre, apellido, fecha de
nacimiento (opcional, y se aclara que es opcional), zona horaria con selector
buscable de zonas comunes, notas (con el texto de ayuda *"información útil para
conversar, no datos médicos"*), y contactos (hasta 5, uno principal).

En el alta, la casilla de **consentimiento**: *"Confirmo que cuento con el
consentimiento de la persona, o su representación legal, para gestionar su
información"*. Obligatoria (`SECURITY.md` §1).

Activar/desactivar con confirmación explícita que explica la consecuencia: *"Alexa
dejará de responderle"*. Sin botón de borrar (**D014**).

### 4.4 Medicación

Listado por medicamento, con el patrón horario en **lenguaje natural**, no en datos
crudos:

```text
Losartán · 50 mg                                    [Activo]
1 comprimido · Después del desayuno
Todos los días a las 09:00 (hora de Rosa) · desde el 1/9
                                    [ Editar ] [ Pausar ] [ ⋯ ]
```

El formulario es el punto más delicado del panel: un error acá se convierte en
información equivocada en la boca de Alexa (**R10**). Por eso:

- Campos: nombre, dosis + unidad, cantidad + unidad, instrucciones, horarios, días,
  vigencia, y ventana de confirmación (`graceMinutes`) en una sección "avanzado" con
  un default sensato.
- **Editor de horarios**: chips de hora que se agregan con un selector; impide
  duplicados y formatos inválidos antes de enviar.
- **Días**: siete botones alternables con un atajo "todos los días".
- **Vista previa obligatoria antes de guardar**, en lenguaje natural:
  *"Todos los días a las 09:00, hora de Rosa, desde el 29/9, sin fecha de fin."*
  Es la defensa más efectiva contra la carga incorrecta.
- Los errores del backend se mapean al campo correspondiente usando `details[].path`.

Pausar explica qué hace: *"No se le va a mencionar más, y el historial se
conserva."*

### 4.5 Recordatorios

Listado agrupado por tipo (único / recurrente) con la categoría visible como ícono +
texto. El formulario cambia según el tipo: `ONE_OFF` pide fecha y hora;
`RECURRING`, hora, días y vigencia. Misma vista previa en lenguaje natural.

### 4.6 Actividad

Timeline cronológico agrupado por día, igual al ejemplo del brief:

```text
HOY — lunes 29 de septiembre            (hora de Rosa)

09:02   Medicamento confirmado          por voz
        Losartán 50 mg

10:14   Consultó la agenda del día      por voz

13:03   Medicamento confirmado          por voz
        Metformina 500 mg

21:17   Pidió ayuda                     por voz
        Atendida por Ana a las 21:22

AYER — domingo 28 de septiembre
...
```

Filtros: tipo de evento (multi-selección) y rango de fechas. Scroll infinito por
cursor. Cada evento muestra la fuente ("por voz" / "desde el panel, por Ana") porque
es la información que el familiar realmente quiere: ¿lo confirmó ella o lo anoté yo?

Estado vacío: *"Todavía no hay actividad registrada para Rosa."*

### 4.7 Configuración

Tres secciones:

**Cuidadores.** Lista con rol y fecha de alta. Agregar por email. Cambiar rol.
Revocar con confirmación. El último `OWNER` no se puede revocar, y la UI explica por
qué en lugar de solo deshabilitar el botón.

**Alexa.** Estado del vínculo (vinculado desde / última vez que se usó, o no
vinculado), **estado de los avisos proactivos** y botón de vinculación.

Bloque de avisos proactivos, alimentado por `GET /adults/:id/alexa-reminders`:

```text
AVISOS DE MEDICACIÓN EN ALEXA                    Permiso: activo

  09:00   todos los días    Losartán, Metformina        Activo
  21:00   todos los días    Metformina                  Pendiente de activación

  El aviso de las 21:00 se va a activar la próxima vez que Rosa
  use Chatio desde su Echo. Alexa no permite crear avisos a distancia.

                                          [ Volver a intentar ]
```

Tres estados con copy propio, y ninguno miente sobre lo que está pasando:

- **Permiso activo + franja `SYNCED`** → "Activo". Es lo único que se muestra como
  funcionando.
- **Franja `PENDING_*`** → "Pendiente de activación", con la explicación de por qué y qué
  hace que se active. No se muestra como activo, porque no lo está
  (`ALEXA_REMINDERS.md` §1).
- **Permiso `DENIED` / `REVOKED` / franja `FAILED`** → aviso en color de advertencia, con
  instrucciones concretas: cómo activar el permiso desde la app Alexa, o pedirle al adulto
  que diga "Alexa, abre chatio" una vez.

Si el permiso no está otorgado, el bloque explica que **Chatio sigue funcionando**: el
adulto puede preguntar cuando quiera, pero no va a recibir el aviso.

Botón "Vincular un Echo" que abre un modal con instrucciones paso a paso
y el código de 4 dígitos grande, con el tiempo restante visible:

```text
   Código:  4 7 2 3        (vence en 14:32)

   1. Andá al Echo de Rosa.
   2. Decí: "Alexa, abre chatio".
   3. Cuando te lo pida, decí: "mi código es cuatro, siete, dos, tres".
```

Aviso de que el código se muestra una sola vez. Botón de revocar con explicación de
la consecuencia.

**Datos básicos.** Atajo al formulario del adulto.

---

## 5. Patrones transversales

**Carga.** Skeletons con la forma del contenido, no un spinner centrado que hace
saltar el layout. En acciones, el botón muestra estado de envío y queda
deshabilitado.

**Error.** Componente `ErrorState` con el mensaje del backend (que ya viene en
español y apto para el usuario) y un botón de reintento. Nunca un código de error
crudo. Si es un 5xx: *"Hubo un problema de nuestro lado. Probá de nuevo en un
momento."*

**Vacío.** `EmptyState` con qué significa y qué hacer:
*"Rosa no tiene medicamentos cargados. Agregá el primero para que Chatio pueda
recordárselo."* Nunca una tabla vacía muda.

**Acciones destructivas.** Siempre un modal que nombra el objeto y la consecuencia.
Nada de `window.confirm` (no se puede estilar ni hacer accesible de forma
consistente, y bloquea).

**Fechas y horas.** Un único componente `TimeDisplay` que recibe el instante UTC y la
zona del adulto y renderiza la hora local, con la zona indicada cuando difiere de la
del navegador. **Prohibido** formatear fechas a mano en un componente: es donde se
cuelan los bugs de zona horaria.

**Permisos.** Un hook `useAdultRole()` esconde las acciones que el rol no permite.
Con la aclaración explícita: **la UI no es el control de acceso** — el backend
rechaza igual. Esconder el botón es cortesía, no seguridad.

---

## 6. Lo que el frontend no hace

- No calcula ocurrencias, próximas tomas ni agendas: todo viene del backend
  (`/today` ya trae `items` y `summary`).
- No habla con Alexa ni con la Reminders API: solo lee el estado de sincronización que le
  da la API de Chatio.
- No convierte zonas horarias para decidir lógica; solo para mostrar.
- No guarda el access token en disco.
- No usa `dangerouslySetInnerHTML` en ningún caso.
- No tiene modo oscuro en el MVP (registrado como mejora, no como deuda).
- No tiene animaciones más allá de transiciones de 150 ms en hover y foco.
