# FrontLog

Frontend de gestión de mensajes para MotoBot. Aplicación Angular que permite visualizar y responder mensajes de chat, con autenticación de usuarios y gestión de alertas de mensajes pendientes.

## Características

- **Autenticación de usuarios**: Sistema de login con guards de protección de rutas
- **Visualización de mensajes históricos**: Consulta de mensajes pasados
- **Gestión de mensajes pendientes**: Vista de mensajes que requieren atención
- **Respuesta a mensajes**: Interfaz para responder mensajes específicos por sesión
- **Alertas en tiempo real**: Sistema de notificaciones para mensajes pendientes
- **Sidebar de navegación**: Menú lateral para navegación entre secciones
- **Diseño responsivo**: Interfaz adaptable a diferentes tamaños de pantalla

## Stack Tecnológico

- **Framework**: Angular 21.2.0
- **Lenguaje**: TypeScript 5.9.2
- **Estilos**: TailwindCSS 4.1.12
- **Testing**: Vitest 4.0.8
- **Contenedor**: Docker con Nginx
- **Gestión de estado**: Angular Signals

## Estructura del Proyecto

```
src/
├── app/
│   ├── app.ts                 # Componente principal
│   ├── app.routes.ts          # Configuración de rutas
│   ├── app.config.ts          # Configuración de la aplicación
│   ├── inicio/                # Vista de mensajes históricos
│   ├── log-in/                # Vista de login
│   ├── mensajes-pendientes/   # Vista de mensajes pendientes
│   ├── responder-mensaje-component/  # Componente de respuesta
│   └── shared/                # Servicios compartidos
│       ├── auth.service.ts    # Servicio de autenticación
│       ├── auth.guards.ts     # Guards de rutas
│       ├── mail.service.ts     # Servicio de correo
│       ├── handoff.service.ts  # Servicio de handoff
│       ├── pending-alert.service.ts  # Servicio de alertas
│       └── chat-log.store.ts   # Store de logs de chat
├── components/
│   ├── sidebar/               # Componente de sidebar
│   └── tabla-component/       # Componente de tabla
└── environments/
    ├── environment.ts         # Configuración desarrollo
    └── environment.prod.ts    # Configuración producción
```

## Rutas de la Aplicación

| Ruta | Descripción | Guard |
|------|-------------|-------|
| `/login` | Página de inicio de sesión | guestOnlyGuard |
| `/home` | Mensajes históricos | authGuard |
| `/mensajes-pendientes` | Lista de mensajes pendientes | authGuard |
| `/mensajes-pendientes/:sessionId` | Responder mensaje específico | authGuard |

## Desarrollo

### Prerrequisitos

- Node.js 20+
- npm 11.6.2+

### Instalación

```bash
npm install
```

### Servidor de desarrollo

Para iniciar el servidor de desarrollo local:

```bash
npm start
```

La aplicación estará disponible en `http://localhost:4200/`.

### Configuración del Backend

El frontend consume la API del backend a través de rutas relativas `/api`. En desarrollo, estas rutas se resuelven mediante el proxy configurado en `proxy.conf.json`:

**Desarrollo (local)**:
```json
{
  "/api/*": {
    "target": "http://127.0.0.1:8000",
    "secure": false,
    "logLevel": "debug"
  }
}
```

**Producción (GCP Cloud Run)**:
```
https://motobot-995204915971.us-central1.run.app/
```

Para ejecutar el frontend contra el backend local:

1. Inicia el backend en `http://127.0.0.1:8000`
2. Inicia el frontend con `npm start`
3. Abre `http://localhost:4200`

## Testing

### Tests unitarios

```bash
npm test
```

### Tests end-to-end

```bash
ng e2e
```

## Build

Para compilar el proyecto para producción:

```bash
npm run build
```

Los artefactos de compilación se almacenan en el directorio `dist/`.

## Docker

### Construir imagen

```bash
docker build -t front-log .
```

### Ejecutar contenedor

```bash
docker run -p 80:80 front-log
```

El Dockerfile utiliza una build multi-stage:
1. **Stage build**: Node.js Alpine para compilar la aplicación
2. **Stage runtime**: Nginx Alpine para servir los archivos estáticos

## Code Scaffolding

Angular CLI incluye herramientas de scaffolding. Para generar un nuevo componente:

```bash
ng generate component component-name
```

Para ver todos los schematics disponibles:

```bash
ng generate --help
```

## Convenciones del Proyecto

- **Componentes standalone**: Se usan componentes standalone por defecto (Angular v20+)
- **Signals**: Se usan signals para gestión de estado
- **OnPush**: Estrategia de detección de cambios OnPush en todos los componentes
- **Lazy loading**: Carga diferida de componentes de rutas
- **TailwindCSS**: Framework de estilos preferido
- **TypeScript strict**: Type checking estricto habilitado

## Recursos Adicionales

- [Angular CLI Overview](https://angular.dev/tools/cli)
- [Angular Documentation](https://angular.dev)
- [TailwindCSS Documentation](https://tailwindcss.com/docs)
