# Contexto de desarrollo — MotoBot Front + Backend

Fecha: 2026-07-23  
Rama activa: `frontend-ivan` (GitHub: `Danunu04/MotoBot-Front`)

---

## Repositorios

| Repo | Ruta local | Descripción |
|---|---|---|
| `Danunu04/MotoBot-Front` | `~/Desktop/est/Estani/MotoBot/MotoBot-Front/front-log` | Frontend Angular 21 |
| `Motorola-Empresas/BTN_bot` | `~/Desktop/est/Estani/MotoBot/Motorola-Empresas/BTN_bot` | Backend FastAPI (compañero de Ivan) |

**Ramas relevantes del front:**
- `main` — rama original sin los nuevos editores
- `ivan` — rama base de trabajo (ya tenía editor-mensajes)
- `frontend-ivan` — rama con todo el trabajo nuevo (basada en `ivan`)

---

## Stack técnico

### Frontend
- Angular **21.2.0** standalone components
- Signals (`signal()`, `computed()`), `ChangeDetectionStrategy.OnPush`
- `ReactiveFormsModule`, `inject()`, control flow nativo (`@if`, `@for`)
- Build: `@angular/build:dev-server` con **Vite 7.3**
- Dev server: `npm start` (script en `package.json` → `ng serve --proxy-config proxy.conf.mjs`)

### Backend
- **FastAPI** + Python, corre en `localhost:8000`
- Base de datos: **BigQuery** (proyecto `consultora-485520`, dataset `inspectia_logs`)
- Tablas: `mensajes_editables`, `option_bindings`, `option_group_config`
- Auth Google Cloud ADC: cuenta `dana.perelmuter@inspectia.ai`

---

## Cómo levantar el entorno local

### Backend
```bash
cd ~/Desktop/est/Estani/MotoBot/Motorola-Empresas/BTN_bot
source venv/bin/activate
uvicorn bot:app --reload --reload-dir . --reload-exclude venv
```
> **Importante:** sin `--reload-exclude venv`, watchfiles entra en loop infinito recargando por los archivos del venv.

### Frontend
```bash
cd ~/Desktop/est/Estani/MotoBot/MotoBot-Front/front-log
npm start
# Abre en localhost:4200 (si está ocupado, Angular ofrece otro puerto)
```

---

## Proxy — problema crítico resuelto

### Problema
Angular 21 / Vite 7 **ignora `pathRewrite`** en `proxy.conf.json`. La opción existe en el código de `@angular/build` (convierte `pathRewrite` a una función `rewrite`), pero en la práctica **no se aplica**. El request llega al backend con el prefijo `/api` intacto → FastAPI devuelve 404.

**Síntoma:** La UI muestra "Not Found" al cargar cualquier sección que llame a la API.

**Cómo diagnosticarlo:**
```bash
curl http://localhost:8000/options/groups       # → 200 OK con datos ✓
curl http://localhost:8000/api/options/groups   # → {"detail":"Not Found"} ✗
curl http://localhost:4200/api/options/groups   # → {"detail":"Not Found"} ✗ (mismo error = proxy no reescribe)
```

### Solución
Usar `proxy.conf.mjs` (ES module) con la función `rewrite` nativa de Vite en lugar de `pathRewrite` en JSON:

```js
// proxy.conf.mjs
export default {
  '/api': {
    target: 'http://localhost:8000',
    secure: false,
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, ''),
  },
};
```

Actualizar también `package.json` y `angular.json`:
- `package.json` → `"start": "ng serve --proxy-config proxy.conf.mjs"`
- `angular.json` → `"proxyConfig": "proxy.conf.mjs"`

---

## Arquitectura del backend — endpoints completos

Todos los endpoints están en `bot.py` sin prefijo (no hay `/api/` en el backend).

### Mensajes (`/messages`)
| Método | Ruta | Body / Params | Respuesta |
|---|---|---|---|
| GET | `/messages` | — | `{ ok, messages: ApiMessage[] }` |
| PUT | `/messages/{key}` | `{ content, updated_by }` | `{ ok, message_key }` |
| POST | `/messages/{key}/reset` | `{ updated_by }` | `{ ok, message_key }` |
| POST | `/messages` | `CreateMessagePayload` | `{ ok, message_key }` |
| PATCH | `/messages/reorder` | `{ orders: [{ message_key, orden }] }` | `{ ok, updated }` |

**`ApiMessage` fields:** `message_key, message_type, state_name, flujo_identificacion_mensaje, label, content, default_content, orden, updated_at?, updated_by?, source?`

**Tipos de mensaje (`message_type`):** `text | button | button_text | list_row_title | list_row_description | list_section_title`

**Límites de caracteres:** `text: 2000, button: 20, button_text: 2000, list_row_title: 24, list_row_description: 72, list_section_title: 24`

### Opciones (`/options`)
| Método | Ruta | Body / Params | Respuesta |
|---|---|---|---|
| GET | `/options/groups` | — | `{ ok, groups: OptionGroupSummary[] }` |
| GET | `/options/groups/{group}/config` | — | `{ ok, config: OptionGroupConfig }` |
| PUT | `/options/groups/{group}/config` | `{ button_text_key, section_title_key, updated_by }` | `{ ok, config }` |
| GET | `/options/{group}` | — | `{ ok, option_group, option_count, interactive_type, options[] }` |
| POST | `/options/{group}` | `OptionCreateRequest` | mismo que GET |
| PUT | `/options/{group}/{id}` | `OptionUpdateRequest` | mismo que GET |
| DELETE | `/options/{group}/{id}` | `?updated_by=` (query param) | mismo que GET |

**Regla de tipo interactivo:** 1–3 opciones → `button`, 4–10 → `list`, 0 → `null`

**`OptionBinding` fields resueltos:** `option_id, orden, title_key, button_title_key, description_key, target_state, target_vars, stay_in_state, target_substep_key, target_substep_value, reply_key, extra_flags` + resueltos: `title, button_title, description`

### Estados de flujo
| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/flow/states` | `{ ok, states: [{ state_name, state_class }], count }` |

### Chat log
| Método | Ruta | Params | Respuesta |
|---|---|---|---|
| GET | `/chatlog` | — | `{ ok, source, logs: ChatLogItem[] }` |
| GET | `/chatlog/download` | `from, to, format, session_id?` | Blob (csv/json/pdf/txt) |

### Handoff / Agente
| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| GET | `/handoff/sessions` | — | `{ ok, sessions: [{ session_id, phone, user_name }] }` |
| POST | `/agent/send` | `{ session_id, message }` | `{ ok }` |
| POST | `/bot/send` | `{ session_id, message?, handoff? }` | `{ ok }` |
| POST | `/resume` | `{ session_id }` | `{ ok, session_id, human_handoff }` |

---

## Servicios Angular y su mapeo

| Servicio | Archivo | Endpoints que consume |
|---|---|---|
| `BotMessagesService` | `shared/bot-messages.service.ts` | `/messages*` |
| `BotOptionsService` | `shared/bot-options.service.ts` | `/options*`, `/flow/states` |
| `ChatLogStore` | `shared/chat-log.store.ts` | `/chatlog` |
| `ChatLogDownloadService` | `shared/chat-log-download.service.ts` | `/chatlog/download` |
| `HandoffService` | `shared/handoff.service.ts` | `/handoff/sessions`, `/agent/send`, `/resume` |

### Detalle importante — `BotMessage` en la rama `ivan`
La rama `ivan` mapea los campos de la API a nombres más cortos:

```typescript
// API devuelve → BotMessage en el front usa
message_key  → key
message_type → type
```

Esto significa que en los templates y componentes hay que usar `msg.key` y `msg.type`, NO `msg.message_key` / `msg.message_type`.

Los payloads de escritura (create, reorder) sí usan los nombres originales de la API (`message_key`, `message_type`).

---

## Componentes nuevos agregados

### `editor-opciones` (`/editor-opciones`)
- Lista todos los grupos de opciones con tipo interactivo y cantidad
- Al hacer click navega a la ruta de detalle

### `editor-opciones-detalle` (`/editor-opciones/:group`)
- Carga en paralelo: grupo, config, estados de flujo y mensajes (con `forkJoin`)
- Permite crear, editar y eliminar opciones
- Edita la config del grupo (button_text_key, section_title_key)
- Valida reglas de negocio: `stay_in_state` requiere `reply_key` + `target_substep_*`, `EstadoSoporte` requiere `extra_flags: { handoff: true }`
- `CURRENT_USER` hardcodeado como `'sitecnosa'`

---

## Variables de entorno (`environment.ts`)

```typescript
export const environment = {
  production: false,
  apiBaseUrl: '/api',
  chatlogApiUrl: '/api/chatlog',
  chatlogDownloadApiUrl: '/api/chatlog/download',
  messagesApiUrl: '/api/messages',
  optionsApiUrl: '/api/options',
  flowStatesApiUrl: '/api/flow/states',
  handoffSessionsApiUrl: '/api/handoff/sessions',
  agentSendApiUrl: '/api/agent/send',
  botSendApiUrl: '/api/bot/send',
  resumeApiUrl: '/api/resume',
};
```

---

## Convenciones del proyecto (CLAUDE.md)

- Standalone components (NO `standalone: true` — es default en Angular 20+)
- `input()` y `output()` en lugar de decoradores
- `computed()` para estado derivado
- `ChangeDetectionStrategy.OnPush` siempre
- Control flow nativo: `@if`, `@for`, `@switch`
- NO `ngClass` ni `ngStyle` — usar bindings `[class]` y `[style]`
- Reactive forms (no template-driven)
- `inject()` en lugar de constructor injection
- Sin comentarios salvo que el WHY sea no obvio

---

## Notas sobre el venv del backend

- macOS con Homebrew bloquea `pip3` global (PEP 668) → siempre usar el venv
- El venv está en `BTN_bot/venv/`
- `watchfiles` recarga en loop si el venv está dentro del directorio observado → usar `--reload-exclude venv`
- La cuenta ADC de Google Cloud debe estar autenticada (`dana.perelmuter@inspectia.ai`) para que BigQuery funcione
