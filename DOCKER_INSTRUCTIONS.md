# Consumables Hub - Local & Offline Docker Compose Guide

This application runs **100% offline and locally** without any external internet or third-party cloud services (Firebase removed, MariaDB database built-in).

---

## 🏗️ Architecture

- **App Service (`consumables-app`)**: Node.js 20 container serving the compiled React frontend and Express REST API on **port 3030**.
- **Database Service (`consumables-mariadb`)**: MariaDB 10.11 container exposed on **port 3310** (mapped `3310:3306`).
- **Data Persistence**: Uses a named volume `mariadb_data` so all inventory, users, areas, orders, and configuration persist across container restarts.
- **Initial Boot Data**: Automatically executes `schema.sql` on first launch, seeding full sample catalog, departments/areas, users, and suppliers.

---

## ⚡ Quick Start

Run the following command from the project root directory:

```bash
docker compose up -d --build
```

That's it! Both the database and application will build, initialize, and link together automatically.

---

## 🌐 URLs & Ports

| Service | Host Port | Internal Port | URL / Connection |
| :--- | :--- | :--- | :--- |
| **Web Application** | **`3030`** | `3030` | [http://localhost:3030](http://localhost:3030) |
| **MariaDB Database**| **`3310`** | `3306` | `mysql -h 127.0.0.1 -P 3310 -u consumables_user -pconsumables_pass consumables_db` |

---

## 🔑 Default User Accounts

The database comes pre-seeded with sample users for all roles:

| Role | Email | Password | Access / Area |
| :--- | :--- | :--- | :--- |
| **Logistics Admin** | `admin@consumables.local` | `admin123` | Master Inventory, Orders, Settings |
| **Logistics Specialist** | `sarah.logistics@consumables.local` | `password` | Goods In, Orders, Stock Take |
| **Production Eng** | `dave.eng@consumables.local` | `password` | Area Catalogs, Analytics |
| **Assembly Lead** | `john.doe@consumables.local` | `password` | Production Orders (Assembly Area) |
| **Machining Operator** | `alex.cnc@consumables.local` | `password` | Production Orders (Machining Area) |

*(You can also quickly select any user or use the test login buttons directly on the Login page).*

---

## 🗄️ Database Management & Queries

### Connect directly with MySQL / MariaDB Client from Host:
```bash
mysql -h 127.0.0.1 -P 3310 -u consumables_user -pconsumables_pass consumables_db
```

### Or connect inside the running Docker container:
```bash
docker compose exec mariadb mysql -u consumables_user -pconsumables_pass consumables_db
```

### Useful Queries:
```sql
-- Check total inventory items
SELECT id, cNumber, name, quantity, minQuantity, unit FROM products;

-- Check areas
SELECT id, name FROM areas;

-- Check submitted orders
SELECT id, orderNumber, areaName, status, createdBy, totalItems FROM orders ORDER BY createdAt DESC;
```

---

## 🛑 Stopping & Resetting

### Stop services:
```bash
docker compose down
```

### Stop and wipe data for a fresh reseed:
```bash
docker compose down -v
docker compose up -d --build
```

---

## 🔧 Troubleshooting: "Table 'consumables_db.users' does not exist"

If you encounter this error, it happens because the MariaDB Docker volume (`mariadb_data`) was initialized before `schema.sql` was ready. Docker's MariaDB container **only runs `/docker-entrypoint-initdb.d/` scripts on the very first creation of an empty data directory**. If a volume already existed, MariaDB skips running `schema.sql`.

### Solution 1: Wipe the stale volume and restart fresh (Recommended)
```bash
docker compose down -v
docker compose up -d --build
```
The `-v` flag removes the old/empty MariaDB volume so MariaDB re-creates the database and imports `schema.sql` automatically.

### Solution 2: Manually import schema into the existing container
If you do not want to remove the volume, run:
```bash
docker compose exec -T mariadb mysql -u consumables_user -pconsumables_pass consumables_db < schema.sql
```

### Solution 3: In-App Auto-Bootstrap
The Node.js server (`server/db.js`) has also been enhanced to automatically check if the `users` table exists upon connecting. If missing, it automatically reads and executes `schema.sql` directly over the database connection.
