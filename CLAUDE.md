# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repositorio

GitHub: `https://github.com/nestgrowo-commits/NESTGROW.git` (cuenta `nestgrowo-commits`)

## Common Commands

```bash
# Install dependencies
pip install -r requirements.txt

# Database
python manage.py makemigrations
python manage.py migrate

# Load initial data
python manage.py loaddata apps/content/fixtures/initial_vocabulary.json
python manage.py loaddata apps/games/fixtures/logros_iniciales.json
python manage.py loaddata apps/games/fixtures/tienda_inicial.json
python manage.py loaddata apps/historia/fixtures/logros_historia.json
python manage.py loaddata apps/historia/fixtures/modo_historia.json

# Seed historia content
python manage.py seed_historia

# Dev server
python manage.py runserver  # http://127.0.0.1:8000/

# Tests
python manage.py test
python manage.py test apps.games

# Sincronización local → Railway PostgreSQL (requiere DATABASE_RAILWAY_URL en .env)
python manage.py push_railway           # todas las apps
python manage.py push_railway --app games  # solo una app
python manage.py pull_railway           # Railway → local
```

## Architecture Overview

**Project layout:** `config/` holds settings and root URLs; `apps/` holds all Django apps; `manage.py` is at the root.

**Settings:** `config/settings/base.py` (shared) + `config/settings/development.py` (SQLite o PostgreSQL vía DATABASE_URL, DEBUG=True).
`config/settings/__init__.py` imports from development by default.
Production uses `config/settings/production.py` — activated in Railway via `DJANGO_SETTINGS_MODULE=config.settings.production`.
Environment variables loaded from `.env` via `django-environ`.

**External API keys:**
- `GEMINI_API_KEY` — Gemini 2.0 Flash (IA principal)
- `GROQ_API_KEY` — Groq / Llama 3.3 70B (fallback de IA)
- `MYMEMORY_API_KEY` — traducción automática
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — media en producción
- `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD` — SMTP Gmail
- `DATABASE_URL` — PostgreSQL en Railway (producción) o SQLite (dev sin esta var)
- `SECRET_KEY`, `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS` — producción

**Apps:**
- `accounts` — custom user model con roles profesor/estudiante, profiles, salones (classrooms)
- `content` — vocabulario bilingüe (ES/EN), categorías e ítems con imágenes/audio
- `games` — minijuegos: scoring, logros, tienda, habitación virtual, museo
- `talleres` — talleres creados por profesor + sistema de Períodos
- `historia` — modo historia: secciones, lecciones, progreso por actividad
- `asistente` — asistente IA Milo para profesores (chat de planeación, análisis, generador de talleres)
- `core` — modelos base abstractos, context processors, páginas estáticas, sync Railway

**URL prefixes:**
```
/accounts/    → auth, dashboards, profiles, salones
/contenido/   → categorías de vocabulario
/juegos/      → catálogo de minijuegos, ranking, tienda, habitacion, museo, logros
/talleres/    → talleres (CRUD) + Períodos + panel "Mis Actividades" del estudiante
/historia/    → mapa modo historia, lección, panel de desbloqueo del profesor
/asistente/   → chat de planeación, análisis de resultados, generador de talleres con IA
/admin/       → Django admin
```

## Deployment (Railway)

- **Plataforma:** Railway con PostgreSQL y Cloudinary para media.
- **Build:** `nixpacks.toml` — corre `python manage.py collectstatic --noinput` en fase build.
- **Start:** `python manage.py migrate --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 2 --timeout 120`
- **Static files:** WhiteNoise `CompressedManifestStaticFilesStorage` + `WHITENOISE_MANIFEST_STRICT = False`.
- **Media files:** `cloudinary_storage.storage.MediaCloudinaryStorage` (producción). En desarrollo usa la carpeta `/media/` local.
- **WebSockets:** `InMemoryChannelLayer` tanto en desarrollo como en producción (sin Redis).
- **Cache:** `FileBasedCache` en desarrollo (`.django_cache/`, TTL 24h). `LocMemCache` en producción.
- **Email:** SMTP Gmail en ambos entornos (`EMAIL_HOST_USER` + `EMAIL_HOST_PASSWORD`).
- **SSL:** `SECURE_PROXY_SSL_HEADER`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE` activos en producción.

## Key Patterns

**Custom user model:** `accounts.CustomUser` (extends AbstractUser).
Fields: `role` (profesor/estudiante), `huesos` (moneda virtual "huesos de Milo"), `avatar`.
Always use `AUTH_USER_MODEL` / `get_user_model()`.

**Auto-created profiles via signals** (`apps/accounts/signals.py`):
When a `CustomUser` is saved, a `ProfesorProfile` or `EstudianteProfile` is auto-created.
Never create profiles manually.

**Role-based access:** Use `@profesor_required` / `@estudiante_required` decorators from `apps.accounts.decorators`.

**Leveling system:** Students earn points → levels (non-linear scaling). Level-up awards 5 bones and logs a `HuesoTransaccion`.
Max level: 50. Points per level defined in `EstudianteProfile.PUNTOS_POR_NIVEL`.
Tiers: Principiante (1–10), Intermedio (11–20), Avanzado (21–30), Experto (31–40), Maestro (41–49).

**Minigame types** (defined in `Game.GAME_TYPES`):
`drag_and_drop`, `word_search`, `puzzle`, `audio_matching`, `painting`,
`memoria`, `ahorcado`, `globos`, `comparacion`.
Each type maps to its own template in `apps/games/templates/games/`.
The `game_detail` and `game_embed` views route to the correct template via `template_map`.
Note: `quiz` and `ordenar_letras` do NOT exist as game types — they have no model entry nor template.

**Minigame completion flow:**
1. Student plays → JS calls `save_score` (AJAX POST to `/juegos/save-score/`)
2. `save_score` saves `Score` + `UserProgress`, creates `RegistroMinijuegoPeriodo` if game belongs to active period, returns `registro_pk`
3. Win overlay shows single button "✔️ Volver al panel" → redirects to `/talleres/mis-talleres/?revisado=<pk>`
4. `mis_talleres` view marks `RegistroMinijuegoPeriodo.revisado = True` → game disappears from both the panel and `/juegos/` list

**Game scoring utilities** (`apps/games/models.py`):
`clasificar_puntaje()` converts score% to letter grade; `pct_to_nota()` converts to Colombian 1–5 scale.

**Abstract base models** (`apps/core/models.py`):
`TimeStampedModel` (adds `created_at`/`updated_at`) and `ActiveModel` (adds `is_active` + custom manager).
Most models inherit from one or both.

**Context processors** (registered globally):
`milo_messages` (random Milo character greetings) and `global_context` (app name, slogan, user role).

**WebSockets (Django Channels):** `apps/core/consumers.py` — `NotificationConsumer` pushes real-time events per user via group `usuario_<pk>`.
Events: `nivel_subido`, `huesos_ganados`, `taller_disponible`, `seccion_desbloqueada`.

**Railway sync** (`apps/core/sync.py`):
Señales `post_save` / `post_delete` replican automáticamente cambios de modelos propios a la base de datos `railway` cuando está configurada en `settings.DATABASES`.
Apps sincronizadas: `accounts`, `content`, `games`, `talleres`, `historia`, `core`, `asistente`.
Comandos manuales: `push_railway` (local→Railway), `pull_railway` (Railway→local).

**Talleres (Workshops):**
A `Taller` has ordered `BloqueTaller` records. Each bloque is `pregunta` or `minijuego`.
`BloquePregunta` supports opcion_multiple / casillas / parrafo.
`BloqueMinijuego` embeds an existing `Game`.
Student answers → `RespuestaEstudiante`; session state → `SesionTaller` (fields: `completada`, `revisado`, `puntos_obtenidos`, `bloque_actual`).
Completing a taller unlocks vocabulary from `categorias_vocabulario`.
After completion, student is redirected to `resultado_sesion` — clicking "Entendido" marks `SesionTaller.revisado = True` and the taller disappears from the panel.

**Generador de talleres con IA:**
Vista en `/asistente/` → llama a `AsistenteMilo.generar_taller()` que envía un prompt a Gemini (fallback Groq) en JSON mode y devuelve la estructura del taller lista para importar.
El profesor puede editar el taller generado antes de guardarlo.

**Períodos (Periods system) — `apps/talleres/`:**
A `Periodo` belongs to a `Salon` and has a `fecha_fin` deadline.
It assigns up to 5 talleres (`AsignacionTaller`) and up to 5 minigames (`AsignacionMinijuego`), plus an optional `meta_historia` (star target).
`RegistroMinijuegoPeriodo` tracks per-student minigame completion within a period.
Student panel (`/talleres/mis-talleres/`) shows only the active period's pending activities.
Completed + revisited activities disappear automatically.
Professor results (`/talleres/periodos/<pk>/resultados/`) shows a table: student × taller grade + minigame % + history stars.
Period is closed manually by professor (sets `cerrado=True`, freezes results).

Professor URL routes:
- `GET/POST /talleres/periodos/crear/` → `crear_periodo`
- `GET /talleres/periodos/` → `lista_periodos`
- `GET /talleres/periodos/<pk>/resultados/` → `resultados_periodo`
- `POST /talleres/periodos/<pk>/cerrar/` → `cerrar_periodo`

Student URL routes:
- `GET /talleres/mis-talleres/` → `mis_talleres` (filtered by active period)
- `GET/POST /talleres/sesion/<pk>/resultado/` → `resultado_sesion` (marks taller as revisado)

**Historia (Story Mode):**
Content hierarchy: `SeccionHistoria` → `Leccion` → `ActividadLeccion`.
Sections unlocked per `Salon` by professor (`SeccionDesbloqueada`) or flagged `is_desbloqueada_por_defecto`.
Activity `datos` is a free-form JSONField (schema depends on `tipo`: introduccion, vocabulario, listening, reading, writing, minijuego_embed, dialogo, pronunciacion).
Progress: `ProgresoLeccion` (per student × lesson, estrellas 1–3) + `RespuestaActividad`.
Achievement logic: `apps/historia/services.py` (`verificar_logros_historia`); PKs 101–118 must match `logros_historia.json`.

**Asistente IA (`apps/asistente/`):**
Exclusivo para profesores. Modelos:
- `MensajeChat` — historial de conversación por profesor y modo (`planeacion` / `analisis`)
- `PromptTemplate` — system prompts editables desde el admin de Django sin redeploy (nombres: `planeacion`, `correccion`, `generar_taller`, `insights_periodo`)
- `LlamadaIA` — registro de cada llamada real a la IA (motor, latencia, éxito, cache hit)

`AsistenteMilo` service (`apps/asistente/services.py`):
- Intenta Gemini 2.0 Flash → fallback Groq (Llama 3.3 70B)
- Cachea respuestas (FileBasedCache dev / LocMemCache prod)
- Métodos: `chat_planeacion`, `analizar_resultados`, `generar_taller`, `generar_insights_periodo`
- `milo_correccion` endpoint (`/asistente/milo-correccion/`) — corrección de respuestas incorrectas para estudiantes

Asistente URL routes:
- `GET /asistente/` → `index` (panel del asistente)
- `POST /asistente/chat/` → `chat` (chat de planeación, async)
- `POST /asistente/analizar/` → `analizar` (análisis de resultados)
- `POST /asistente/limpiar/` → `limpiar_historial`
- `POST /asistente/milo-correccion/` → `milo_correccion` (usado por minijuegos del estudiante)

**Tienda (Store):** `TiendaItem` — items with `precio_huesos`, `imagen`, `posicion_habitacion`, optional `juego_desbloqueado`.
`InventarioEstudiante` tracks purchased items. Items loaded via `tienda_inicial.json` (13 items, PKs 1–13).
Items 9–13 correspond to the 5 newer minigames (Memoria, Ordenar Letras, Quiz, Globos, Ahorcado).

**Naming conventions (UI):**
- "Minijuegos" = the learning games at `/juegos/` (NOT "Juegos")
- "Mis Actividades" = the student panel at `/talleres/mis-talleres/` (NOT "Talleres")
- "Juegos de la Habitación" = the decoration/entertainment games in Habitación de Milo

**Custom password validator:** `apps/accounts/validators.ContainsNumberValidator` — enforces at least one digit.

**Static/media:**
- Desarrollo: WhiteNoise sirve estáticos; media se sirve desde `/media/` local.
- Producción: WhiteNoise `CompressedManifestStaticFilesStorage` para estáticos; Cloudinary para media.
- Correr `collectstatic` antes de desplegar (en Railway lo hace nixpacks automáticamente).

**Language/locale:** Spanish (es-co), timezone America/Bogota. All user-facing strings must be in Spanish.

**`simple_history`:** desactivado (comentado en `INSTALLED_APPS` y `MIDDLEWARE`). Requiere habilitar Windows Long Paths antes de reactivar.
