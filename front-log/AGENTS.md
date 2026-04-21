
You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

## TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

## Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.

## Accessibility Requirements

- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

### Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `computed()` for derived state
- Set `changeDetection: ChangeDetectionStrategy.OnPush` in `@Component` decorator
- Prefer inline templates for small components
- Prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- When using external templates/styles, use paths relative to the component TS file.

## State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

## Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available.

## Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Use the `inject()` function instead of constructor injection

:root {
  /* Fondos */
  --bg-base:        #0d1117;   /* fondo general de la app */
  --bg-card:        #161b22;   /* tarjetas / paneles elevados */
  --bg-input:       #1c2230;   /* inputs y campos de texto */
  --bg-item:        #1e2535;   /* filas / items de lista */
  --bg-item-hover:  #252d3d;   /* hover sobre filas */

  /* Bordes */
  --border-subtle:  #2a3245;   /* borde suave para separadores */
  --border-focus:   #3a4a6b;   /* borde activo / focus */

  /* Texto */
  --text-primary:   #e6edf3;   /* texto principal */
  --text-secondary: #8b949e;   /* texto secundario / placeholders */
  --text-muted:     #58677a;   /* etiquetas muy sutiles */

  /* Acentos */
  --accent-blue:    #2f8fec;   /* acción primaria, valores destacados, slider */
  --accent-blue-bright: #58b0f5; /* hover sobre accent */
  --accent-green:   #3fb950;   /* métricas positivas (ej: total mensajes) */
  --accent-purple:  #7c3aed;   /* botón "Imprimir" / acción secundaria */
  --accent-purple-hover: #6d28d9;

  /* Feedback */
  --step-active:    #2f8fec;   /* indicador de paso activo */
  --step-inactive:  #2a3245;   /* indicadores inactivos */
}