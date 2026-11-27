# Pensum Medicina UTESA · Planificador

PWA para estudiantes de Medicina de UTESA (pensum 2013): registrás tus notas, ves qué materias podés inscribir y **por qué** no podés inscribir las otras, armás el próximo cuatrimestre con secciones reales sin choques de horario y seguís tu índice y tu avance hacia cada bloque.

Funciona 100% en el navegador y sin conexión. No hay cuentas ni servidores: los datos del estudiante nunca salen de su dispositivo.

**Demo:** https://reyescoding.github.io/medicina-pwa-final/

## Qué resuelve

Un estudiante de Medicina se hace estas preguntas en cada cuatrimestre. La app las responde con las reglas del [pensum oficial](client/public/docs/pensum-medicina-2013.pdf):

| Pregunta | Cómo la responde |
|---|---|
| ¿Qué puedo inscribir? | Cada materia muestra si está disponible, aprobada, en curso o bloqueada, con el motivo concreto (prerrequisito que falta, bloque cerrado, índice insuficiente). |
| ¿Cuánto me falta para Básicas o Clínicas? | Tarjeta "Para entrar a…" con obligatorias pendientes, créditos de electivas e índice mínimo (2.5 para Básicas). |
| ¿Qué horario me conviene? | Sugeridor que prioriza las materias atrasadas y las que abren cadenas largas de prerrequisitos, respeta el tope de créditos, agrega los correquisitos juntos y elige secciones que no choquen. Grilla semanal. |
| ¿Cómo va mi índice? | Índice acumulado y por cuatrimestre, ponderado por créditos. D y F cuentan; los intentos repetidos también. |
| ¿Puedo planificar antes de tener las notas? | Sí: las materias en curso se pueden asumir aprobadas para planificar el cuatrimestre siguiente. |

También permite cargar un cuatrimestre entero de una vez (para quien empieza a usar la app con la carrera avanzada), exportar e importar un respaldo, y se instala en el celular como app.

## Stack

React 18 · TypeScript (strict) · Vite · Tailwind + Radix/shadcn · Zod · Vitest · Workbox (vite-plugin-pwa) · GitHub Pages

## Arquitectura

```
client/src/
├── domain/        Reglas del pensum: funciones puras, sin React ni almacenamiento
│   ├── curriculum.ts   Reglas oficiales (bloques, puertas, electivas, escala de notas)
│   ├── progress.ts     Estado de cada materia y de cada bloque, con motivos de bloqueo
│   ├── grades.ts       Índice ponderado por créditos (global y por cuatrimestre)
│   ├── planner.ts      Correquisitos, validación del plan y sugeridor
│   ├── schedule.ts     Choques de horario y formato
│   └── period.ts       Cuatrimestres UTESA (ene–abr, may–ago, sep–dic)
├── data/          Carga de JSON con validación de esquema (Zod)
├── state/         Persistencia versionada + migración, reducer y contexto React
├── features/      Vistas: catálogo, detalle de materia, planificador, progreso, ajustes
├── app/           Shell, rutas y aviso de actualización de la PWA
└── sw.ts          Service worker (precache + navegación offline)
scripts/build-sections.mjs   Convierte el export crudo de la oferta en sections.json
```

### Decisiones y por qué

- **El dominio separado de la UI.** Las reglas académicas son la parte que más importa que esté bien, así que viven en funciones puras que se testean sin navegador. La UI sólo consulta y muestra.
- **El estado se deriva y no se guarda.** Se persiste únicamente el historial (intentos con nota), lo que se está cursando y el plan. Disponibilidad, índice y puertas se recalculan siempre desde ahí, así nunca quedan desincronizados.
- **El plan se valida en vez de prohibir estados inválidos.** Un plan puede quedar viejo por razones externas (el estudiante corrige una nota, se publica otra oferta). `validatePlan` lo revisa en cada render y explica cada problema.
- **Los motivos de bloqueo son datos.** `evaluateProgress` devuelve *por qué* una materia está bloqueada (`prerequisites`, `blockLocked`, `firstTerm`…), no sólo un booleano. La UI los traduce a frases en español.
- **La validación ocurre en los bordes.** Los datasets descargados y los respaldos importados pasan por Zod. Un JSON roto falla con un mensaje claro en lugar de romper la app a mitad de camino.
- **La oferta de horarios se procesa en build.** El export de la universidad trae los horarios como texto libre, con más de cien variantes (`MA9:15,10:00 am`, `L10:00 a 12:15 am`, `Hosp. …`). Se parsea una vez con un script testeado y el navegador recibe un JSON normalizado (de 814 KB a 225 KB).
- **Rutas con hash (`#/plan`).** GitHub Pages no reescribe URLs a `index.html`, así que una ruta real daría 404 al recargar.
- **Almacenamiento con prefijo, sin `localStorage.clear()`.** En GitHub Pages todos los proyectos del usuario comparten el origen `reyescoding.github.io`. Borrar todo el almacenamiento o todos los caches afectaría a los demás proyectos.
- **El service worker no se activa solo.** Cuando hay una versión nueva, la app la ofrece y el estudiante elige cuándo recargar, así no se le cambia la app a mitad de una carga de notas.

## Reglas del pensum implementadas

- **Aprobación:** A, B o C. D y F no aprueban, pero quedan registradas y cuentan en el índice.
- **Correquisitos:** se cursan en el mismo cuatrimestre. Si uno ya está aprobado (por ejemplo, el laboratorio), el otro puede ir solo.
- **Premédica → Ciencias Básicas:** Premédica completa (obligatorias + 12 créditos de electivas generales) e índice acumulado ≥ 2.5.
- **Básicas → Clínicas → Internado:** el bloque anterior completo, incluidas sus electivas (8 créditos en Básicas y 8 en Clínicas).
- **Electivas generales:** a partir del segundo cuatrimestre.
- **ADM-900:** todas las obligatorias del 1º al 13º cuatrimestre.

Supuestos documentados (el PDF no los especifica):

- `DPG-020` (Proyecto de Grado) requiere `DPG-010`.
- Si el estudiante ya cursó materias de un bloque, una baja posterior del índice no le cierra el acceso.
- Sin ninguna nota registrada, el índice mínimo no bloquea; se muestra como "sin verificar".

## Desarrollo

Requiere Node 20.11 o superior.

```bash
npm install
npm run dev            # servidor de desarrollo
npm test               # 84 tests: dominio, persistencia, parser de horarios e integridad de datos
npm run check          # TypeScript (app + service worker)
npm run build          # check + build de producción en dist/
npm run preview        # sirve el build (para probar la PWA y el modo offline)
```

### Actualizar los datos

- **Materias** (`client/public/data/courses.json`): se editan a mano. `npm test` valida referencias, simetría de correquisitos, ausencia de ciclos, los créditos por bloque del PDF y que la carrera completa sea alcanzable aprobando en orden.
- **Oferta de secciones:** se reemplaza `docs/sections.txt` por el export nuevo y se corre `npm run data:sections`. El test de integridad comprueba que la carga semanal de cada sección coincida con las horas del pensum (hora académica de 45 min, 16 semanas), lo que detecta cualquier am/pm mal interpretado.

### Deploy

```bash
npm run deploy   # tests + build + publica dist/ en la rama gh-pages
```

La CI (`.github/workflows/ci.yml`) corre tests y build en cada push y pull request.

## Privacidad

Sin analítica, sin cuentas, sin servidores. Notas, plan y respaldo quedan en el dispositivo del estudiante.

## Aviso

Herramienta independiente, no oficial de UTESA. Las reglas salen del pensum publicado; la oferta de secciones es una referencia y hay que confirmarla en la selección oficial.

## Licencia

[MIT](LICENSE)
