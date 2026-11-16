# Evaluación técnica: sistema de inventario

Sistema para gestionar el inventario de una empresa: productos, categorías y movimientos de stock.

- **Frontend:** [evaluacion-frontend.up.railway.app](https://evaluacion-frontend.up.railway.app/)
- **API:** [evaluaciondeveloper-production.up.railway.app/productos](https://evaluaciondeveloper-production.up.railway.app/productos)
- **Respuestas a la consigna:** [docs/respuestas.md](docs/respuestas.md)

## Respuestas

Todas las respuestas, con las decisiones de diseño y su justificación, están en [docs/respuestas.md](docs/respuestas.md):

| Parte | Tema |
| --- | --- |
| 1 | [Base de datos](docs/respuestas.md#11-diseño-del-modelo): modelo, ORM, stock no negativo, [historial de cambios](docs/respuestas.md#12-historial-de-cambios) y [escalado](docs/respuestas.md#13-si-el-sistema-crece) |
| 2 | [Backend](docs/respuestas.md#21-decisiones-de-arquitectura): arquitectura, [deploy](docs/respuestas.md#22-deploy), [seguridad](docs/respuestas.md#23-seguridad-roles-perfiles-y-contraseñas), [logs](docs/respuestas.md#24-logs-del-sistema) y [endpoint](docs/respuestas.md#25-endpoint-implementado) |
| 3 | [Frontend](docs/respuestas.md#31-elección-de-tecnología): tecnología y [pantallas](docs/respuestas.md#32-pantallas) |
| 4 | [Git](docs/respuestas.md#4-git) |
| 5 | [Uso de IA](docs/respuestas.md#5-uso-de-ia) |

## Stack

| Capa | Tecnología |
| --- | --- |
| Base de datos | PostgreSQL 17 |
| Backend | NestJS (TypeScript), Drizzle ORM, drizzle-kit |
| Frontend | React, Vite, TypeScript, Tailwind, Recharts |
| Deploy | Docker + Railway |

## Estructura

```text
.
├── backend/             # API en NestJS
├── frontend/            # aplicación en React
├── docs/respuestas.md   # respuestas a la consigna
└── docker-compose.yml   # Postgres para desarrollo local
```

## Cómo levantarlo en local

Requisitos: Node 24 y Docker.

**1. Base de datos**

```bash
docker compose up -d
```

Postgres queda en el puerto `5433`, para no chocar con una instalación local de Postgres.

**2. Backend**

```bash
cd backend
cp .env.example .env
npm install
npm run db:migrate
npm run db:seed      # opcional: carga categorías y productos de prueba
npm run start:dev
```

La API queda en `http://localhost:3000`.

**3. Frontend**

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

La aplicación queda en `http://localhost:5173`.

## Endpoints

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/productos` | Listado de productos con su stock y su categoría |
| `GET` | `/productos?categoria=<slug>` | Filtra por categoría (por ejemplo, `?categoria=electronica`) |
| `GET` | `/health` | Health check que usa Railway antes de mandar tráfico |
