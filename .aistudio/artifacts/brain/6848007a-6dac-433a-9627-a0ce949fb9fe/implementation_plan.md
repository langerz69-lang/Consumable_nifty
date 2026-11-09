# Migration to Local MariaDB & Two-Container Docker Architecture

Comprehensive architectural migration plan to eliminate all dependencies on Firebase (Firestore, Auth) and external cloud CDNs, transitioning the application to run completely local and air-gapped on **MariaDB** using a two-container **Docker Compose** deployment with the web application on port **3030** and MariaDB exposed on port **3310**.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions were confirmed via interactive clarification:
> - **Container Strategy**: Two dedicated containers via `docker-compose.yml` (`mariadb` container exposed on host port `3310` and `app` container exposed on host port `3030`).
> - **Offline & Air-Gapped Media**: All external image URLs (e.g., Unsplash) replaced with bundled local SVG/CSS visual assets and default system icons to guarantee 100% offline functionality without internet access.
> - **Data Seeding**: MariaDB initialization will automatically execute `schema.sql` on first boot, pre-populating a complete production catalog, manufacturing areas, user roles (Admin, Logistics, Production, Engineering), suppliers, and categories.

---

## 1. Overview & Core Concept

- **What It Does**: Consumables Hub is an internal manufacturing supply-chain and consumable ordering system. It enables production line workers to order assembly consumables, track ADR dangerous goods compliance, and allows logistics administrators to manage goods-in, pick lists, supplier records, and inventory replenishment.
- **Target Audience / Persona**: Production Line Operators, Logistics & Warehouse Managers, and Production Engineering Specialists working in on-premises manufacturing facilities.
- **Key Value**: Operates completely self-contained within an on-premises local network without any internet connection, telemetry, or external cloud services, persisting all state to a localized MariaDB database.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Authentication & Session**: Worker/Admin selects or types credentials against local MariaDB users table. Immediate validation with role-based routing (`LOGISTICS` to Inventory/Orders, `PRODUCTION` to Area Catalog).
  2. **Area-Specific Consumable Ordering**: Production workers browse categorized consumables filtered by assigned area, review real-time stock levels, check ADR compliance limits, and place batch orders.
  3. **Warehouse Order Fulfillment & Pick Slips**: Logistics operators view pending orders in real-time, mark items as picked or partially picked, decrement inventory counts atomically in MariaDB, and generate delivery notes.
  4. **Settings & Master Data Management**: Administrators manage user permissions, production areas, approved suppliers, categories, and bulk CSV imports.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Industrial utilitarian, crisp enterprise dashboard with high visual density and clean tabular layout.
  - *Palette*: Deep slate canvas (`#0f172a`), clean card surfaces (`#ffffff` / `#1e293b`), dark borders (`#e2e8f0` / `#334155`), with blue (`#2563eb`) and emerald (`#10b981`) accent indicators.
  - *Typography*: Structured sans display (`Plus Jakarta Sans`), readable body (`Public Sans` / `DM Sans`), and tabular numerals (`font-mono tabular-nums`) across all inventory quantities and currency figures.
  - *Zero-Pill Discipline*: Unboxed text metadata separated by subtle typographic dividers (`·`), eliminating floating pill cards.
- **Offline Assets**: All area and consumable item cards will use bundled SVG vector icons and localized fallback visuals, eliminating external HTTP requests.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Direct Express API Gateway vs. Client-Side DB Access**
  - *Chosen Approach*: The Node.js Express server (`server.js`) hosts the MariaDB connection pool (`mysql2/promise`) and exposes clean, typed REST endpoints (`/api/*`), while Vite dev server proxies `/api` during local development.
  - *Why*: Browsers cannot speak the raw MySQL/MariaDB protocol directly; a lightweight server proxy keeps DB credentials secure and enables atomic multi-table order transactions.
- **Decision 2: Docker Compose Multi-Container Orchestration**
  - *Chosen Approach*: Standard `docker-compose.yml` linking `mariadb` (internal 3306, host mapped to **3310**) and `app` (internal 3030, host mapped to **3030**) with a Docker healthcheck (`mysqladmin ping`) to ensure the web service waits for database readiness before starting.
  - *Why*: Provides clean separation of concerns, persistent data volume mounting (`mariadb_data`), and reproducible one-command deployment (`docker compose up -d`).
- **Decision 3: Complete Removal of Firebase SDKs**
  - *Chosen Approach*: Remove `@firebase/*` and `firebase` npm packages and delete Firebase configuration artifacts (`firebase-applet-config.json`, `firebase-blueprint.json`, `firestore.rules`).
  - *Why*: Eliminates bundle bloat, prevents background network pings to Google Cloud, and removes runtime initialization errors when disconnected from the internet.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Local Docker Compose                            │
│                                                                        │
│   ┌────────────────────────────────┐   ┌───────────────────────────┐   │
│   │  Web App Container (Port 3030) │   │ Database (Host Port 3310) │   │
│   │                                │   │                           │   │
│   │   React 19 SPA (Vite / Dist)   │   │   MariaDB 10.11 Server    │   │
│   │               │                │   │             ▲             │   │
│   │               ▼                │   │             │             │   │
│   │     API Client (src/lib/api.ts)│   │   Named Persistent Volume │   │
│   │               │                │   │     (mariadb_data:/var/   │   │
│   │               ▼                │   │            lib/mysql)     │   │
│   │      Express Server Gateway    │───┼─────────────┘             │   │
│   │      (Port 3030 Node.js)       │   │    Initial Schema & Seeds │   │
│   │      Pool: mysql2/promise      │   │    (/docker-entrypoint-   │   │
│   │                                │   │     initdb.d/schema.sql)  │   │
│   └────────────────────────────────┘   └───────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

### Relational Schema (MariaDB)
1. `users`: `id`, `name`, `email`, `password`, `role`, `areaId`, `accessAllowed`, `createdAt`, `updatedAt`
2. `areas`: `id`, `name`, `description`, `color`, `icon`, `imageUrl`, `notificationEmail`, `budgetLimit`, `currentSpend`, `createdAt`
3. `categories`: `id`, `name`, `createdAt`
4. `suppliers`: `id`, `name`, `createdAt`
5. `products`: `id`, `name`, `cNumber`, `categoryId`, `packSize`, `consumedPerUnit`, `binLocation`, `imageUrl`, `isArchived`, `purchaseRate`, `unitsPerPurchase`, `sku`, `stockLevel`, `minStockThreshold`, `maxStockThreshold`, `unitCost`, `supplierId`, `isAdr`, `adrScore`, `allowedAreaIds` (JSON), `areaConfigs` (JSON), `createdAt`, `updatedAt`
6. `orders`: `id`, `userId`, `areaId`, `status`, `totalCost`, `totalAdrScore`, `createdAt`, `deliveryNoteGenerated`, `createdAtTs`
7. `order_items`: `id`, `orderId`, `productId`, `name`, `quantity`, `pickedQuantity`, `unitCost`, `adrScore`, `cNumber`, `binLocation`
8. `email_logs`: `id`, `orderId`, `areaName`, `notificationEmail`, `status`, `previewUrl`, `messageId`, `error`, `sentAt`

### Migration Execution Steps
1. **Database Schema & Seed File**: Update `schema.sql` to include full relational tables with sample catalog data, users, and areas.
2. **Server & Database Layer**:
   - Install `mysql2` and remove `firebase`.
   - Update `server.js` with a connection pool, healthcheck endpoint, and CRUD routes for all entities.
   - Configure port fallback to `process.env.PORT || 3030`.
3. **Client API Layer**:
   - Create `src/lib/api.ts` providing typed helper functions (`api.getProducts()`, `api.createOrder()`, `api.login()`, etc.).
   - Refactor `AuthContext.tsx` to authenticate against `/api/auth` and manage user state via local API.
   - Refactor all logistics and production pages to replace Firestore calls with `api.*` methods.
4. **Docker Configurations**:
   - Create `docker-compose.yml` defining the two services: `mariadb` (port 3310:3306) and `app` (port 3030:3030).
   - Update `Dockerfile` to build and serve the app via `server.js` on port 3030.
   - Update `DOCKER_INSTRUCTIONS.md` with detailed local setup, compose instructions, and troubleshooting.
5. **Clean Up & Verification**:
   - Remove unused Firebase helper files and dependencies.
   - Run verification builds and tests.
