import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'consumables_user',
  password: process.env.DB_PASSWORD || 'consumables_pass',
  database: process.env.DB_NAME || 'consumables_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 5000,
  multipleStatements: true
};

let pool = null;
let isConnected = false;

// Default Seed Data matching schema.sql
const memoryStore = {
  categories: [
    { id: 'cat_1', name: 'Fasteners & Fixings', createdAt: 1710000000000 },
    { id: 'cat_2', name: 'Adhesives & Sealants', createdAt: 1710000000000 },
    { id: 'cat_3', name: 'Lubricants & Oils', createdAt: 1710000000000 },
    { id: 'cat_4', name: 'PPE & Safety Supplies', createdAt: 1710000000000 },
    { id: 'cat_5', name: 'Abrasives & Cutting', createdAt: 1710000000000 },
    { id: 'cat_6', name: 'Cleaning & Degreasing', createdAt: 1710000000000 }
  ],
  suppliers: [
    { id: 'sup_1', name: 'Brammer Buck & Hickman', createdAt: 1710000000000 },
    { id: 'sup_2', name: 'RS Components Ltd', createdAt: 1710000000000 },
    { id: 'sup_3', name: 'Henkel Loctite UK', createdAt: 1710000000000 },
    { id: 'sup_4', name: 'Fuchs Lubricants PLC', createdAt: 1710000000000 },
    { id: 'sup_5', name: '3M Industrial Safety', createdAt: 1710000000000 }
  ],
  areas: [
    {
      id: 'area_1',
      name: 'Main Assembly Line 1',
      description: 'Chassis assembly, hydraulic integration, and torque fitting line.',
      color: 'blue',
      icon: 'Wrench',
      imageUrl: '',
      notificationEmail: 'line1-leads@company.local',
      budgetLimit: 8500.0,
      currentSpend: 1420.5,
      createdAt: 1710000000000
    },
    {
      id: 'area_2',
      name: 'Welding & Fabrication Bay',
      description: 'MIG/TIG welding cells, structural jigging, and grinding bays.',
      color: 'amber',
      icon: 'Flame',
      imageUrl: '',
      notificationEmail: 'fabrication@company.local',
      budgetLimit: 6000.0,
      currentSpend: 2180.0,
      createdAt: 1710000000000
    },
    {
      id: 'area_3',
      name: 'Paint & Surface Treatment',
      description: 'Spray booths, powder coating, degreasing, and prep bays.',
      color: 'emerald',
      icon: 'Sparkles',
      imageUrl: '',
      notificationEmail: 'paintshop@company.local',
      budgetLimit: 9500.0,
      currentSpend: 3110.0,
      createdAt: 1710000000000
    },
    {
      id: 'area_4',
      name: 'Electrical & Loom Assembly',
      description: 'Control boxes, harness routing, testing, and telematics fitting.',
      color: 'indigo',
      icon: 'Zap',
      imageUrl: '',
      notificationEmail: 'electrical@company.local',
      budgetLimit: 5000.0,
      currentSpend: 680.0,
      createdAt: 1710000000000
    },
    {
      id: 'area_5',
      name: 'PDI & Final Inspection',
      description: 'Pre-delivery inspection, functional testing, and decal applications.',
      color: 'purple',
      icon: 'CheckCircle2',
      imageUrl: '',
      notificationEmail: 'pdi@company.local',
      budgetLimit: 4000.0,
      currentSpend: 420.0,
      createdAt: 1710000000000
    }
  ],
  users: [
    {
      id: 'usr-admin-1',
      name: 'Logistics Admin',
      email: 'admin@logistics.co',
      password: 'admin',
      role: 'LOGISTICS',
      areaId: null,
      accessAllowed: true,
      createdAt: 1710000000000,
      updatedAt: 1710000000000
    },
    {
      id: 'usr-admin-local',
      name: 'System Admin',
      email: 'admin@consumables.local',
      password: 'admin123',
      role: 'LOGISTICS',
      areaId: null,
      accessAllowed: true,
      createdAt: 1710000000000,
      updatedAt: 1710000000000
    },
    {
      id: 'usr-admin-user',
      name: 'System Administrator',
      email: 'langerz69@gmail.com',
      password: 'admin123',
      role: 'LOGISTICS',
      areaId: null,
      accessAllowed: true,
      createdAt: 1710000000000,
      updatedAt: 1710000000000
    },
    {
      id: 'usr-langford',
      name: 'C Langford',
      email: 'clangford@niftylift.com',
      password: 'admin',
      role: 'LOGISTICS',
      areaId: null,
      accessAllowed: true,
      createdAt: 1710000000000,
      updatedAt: 1710000000000
    },
    {
      id: 'usr-worker-1',
      name: 'Production Worker',
      email: 'worker@production.co',
      password: 'worker',
      role: 'PRODUCTION',
      areaId: 'area_1',
      accessAllowed: true,
      createdAt: 1710000000000,
      updatedAt: 1710000000000
    },
    {
      id: 'usr-worker-2',
      name: 'Dave Miller',
      email: 'dave@production.co',
      password: 'worker',
      role: 'PRODUCTION',
      areaId: 'area_2',
      accessAllowed: true,
      createdAt: 1710000000000,
      updatedAt: 1710000000000
    },
    {
      id: 'usr-eng-1',
      name: 'Production Engineer',
      email: 'eng@production.co',
      password: 'engineer',
      role: 'PRODUCTION_ENGINEERING',
      areaId: null,
      accessAllowed: true,
      createdAt: 1710000000000,
      updatedAt: 1710000000000
    }
  ],
  products: [
    {
      id: 'prod_1',
      name: 'Loctite 243 Medium Strength Threadlocker 50ml',
      cNumber: 'C-10024',
      categoryId: 'cat_2',
      packSize: '50ml Bottle',
      consumedPerUnit: '0.05',
      binLocation: 'B-12-04',
      imageUrl: '',
      isArchived: false,
      purchaseRate: 14.50,
      unitsPerPurchase: 1,
      sku: 'LOC-243-50',
      stockLevel: 38,
      minStockThreshold: 10,
      maxStockThreshold: 80,
      unitCost: 14.50,
      supplierId: 'sup_3',
      isAdr: false,
      adrScore: 0.0,
      allowedAreaIds: ['area_1', 'area_2', 'area_4'],
      areaConfigs: { area_1: { maxOrderQuantity: 5 }, area_2: { maxOrderQuantity: 10 } },
      createdAt: 1710000000000,
      updatedAt: 1710000000000
    },
    {
      id: 'prod_2',
      name: 'Loctite 577 Thread Sealant Gel 50ml',
      cNumber: 'C-10057',
      categoryId: 'cat_2',
      packSize: '50ml Tube',
      consumedPerUnit: '0.08',
      binLocation: 'B-12-06',
      imageUrl: '',
      isArchived: false,
      purchaseRate: 16.20,
      unitsPerPurchase: 1,
      sku: 'LOC-577-50',
      stockLevel: 24,
      minStockThreshold: 8,
      maxStockThreshold: 60,
      unitCost: 16.20,
      supplierId: 'sup_3',
      isAdr: false,
      adrScore: 0.0,
      allowedAreaIds: ['area_1', 'area_2'],
      areaConfigs: { area_1: { maxOrderQuantity: 4 } },
      createdAt: 1710000000000,
      updatedAt: 1710000000000
    },
    {
      id: 'prod_3',
      name: 'Aerosol Brake & Parts Cleaner 500ml',
      cNumber: 'C-20091',
      categoryId: 'cat_6',
      packSize: '500ml Can',
      consumedPerUnit: '1',
      binLocation: 'C-04-01',
      imageUrl: '',
      isArchived: false,
      purchaseRate: 4.80,
      unitsPerPurchase: 12,
      sku: 'BRK-CLN-500',
      stockLevel: 142,
      minStockThreshold: 30,
      maxStockThreshold: 250,
      unitCost: 4.80,
      supplierId: 'sup_1',
      isAdr: true,
      adrScore: 2.5,
      allowedAreaIds: ['area_1', 'area_2', 'area_3', 'area_5'],
      areaConfigs: { area_1: { maxOrderQuantity: 12 }, area_3: { maxOrderQuantity: 24 } },
      createdAt: 1710000000000,
      updatedAt: 1710000000000
    },
    {
      id: 'prod_4',
      name: 'M10 x 30mm Grade 8.8 High Tensile Hex Bolts',
      cNumber: 'C-30110',
      categoryId: 'cat_1',
      packSize: 'Box of 100',
      consumedPerUnit: '1',
      binLocation: 'A-02-14',
      imageUrl: '',
      isArchived: false,
      purchaseRate: 18.90,
      unitsPerPurchase: 1,
      sku: 'BOLT-M10-30',
      stockLevel: 85,
      minStockThreshold: 20,
      maxStockThreshold: 150,
      unitCost: 18.90,
      supplierId: 'sup_2',
      isAdr: false,
      adrScore: 0.0,
      allowedAreaIds: ['area_1', 'area_2', 'area_5'],
      areaConfigs: { area_1: { maxOrderQuantity: 10 } },
      createdAt: 1710000000000,
      updatedAt: 1710000000000
    },
    {
      id: 'prod_5',
      name: 'M10 Nyloc Locking Nuts Zinc Plated',
      cNumber: 'C-30112',
      categoryId: 'cat_1',
      packSize: 'Box of 100',
      consumedPerUnit: '1',
      binLocation: 'A-02-16',
      imageUrl: '',
      isArchived: false,
      purchaseRate: 11.40,
      unitsPerPurchase: 1,
      sku: 'NUT-NYL-M10',
      stockLevel: 94,
      minStockThreshold: 25,
      maxStockThreshold: 200,
      unitCost: 11.40,
      supplierId: 'sup_2',
      isAdr: false,
      adrScore: 0.0,
      allowedAreaIds: ['area_1', 'area_2', 'area_5'],
      areaConfigs: { area_1: { maxOrderQuantity: 10 } },
      createdAt: 1710000000000,
      updatedAt: 1710000000000
    },
    {
      id: 'prod_6',
      name: 'ISO 46 Anti-Wear Hydraulic Fluid 20L Drum',
      cNumber: 'C-40046',
      categoryId: 'cat_3',
      packSize: '20L Drum',
      consumedPerUnit: '1',
      binLocation: 'OIL-BAY-1',
      imageUrl: '',
      isArchived: false,
      purchaseRate: 48.00,
      unitsPerPurchase: 1,
      sku: 'HYD-ISO46-20',
      stockLevel: 16,
      minStockThreshold: 5,
      maxStockThreshold: 40,
      unitCost: 48.00,
      supplierId: 'sup_4',
      isAdr: true,
      adrScore: 5.0,
      allowedAreaIds: ['area_1', 'area_5'],
      areaConfigs: { area_1: { maxOrderQuantity: 2 } },
      createdAt: 1710000000000,
      updatedAt: 1710000000000
    },
    {
      id: 'prod_7',
      name: 'Multi-Purpose EP2 Lithium Grease Cartridge 400g',
      cNumber: 'C-40082',
      categoryId: 'cat_3',
      packSize: '400g Tube',
      consumedPerUnit: '1',
      binLocation: 'B-08-02',
      imageUrl: '',
      isArchived: false,
      purchaseRate: 3.95,
      unitsPerPurchase: 10,
      sku: 'GRS-EP2-400',
      stockLevel: 65,
      minStockThreshold: 15,
      maxStockThreshold: 120,
      unitCost: 3.95,
      supplierId: 'sup_4',
      isAdr: false,
      adrScore: 0.0,
      allowedAreaIds: ['area_1', 'area_2', 'area_5'],
      areaConfigs: { area_1: { maxOrderQuantity: 6 } },
      createdAt: 1710000000000,
      updatedAt: 1710000000000
    },
    {
      id: 'prod_8',
      name: '3M Cubitron II Fibre Sanding Discs 125mm 60G',
      cNumber: 'C-50060',
      categoryId: 'cat_5',
      packSize: 'Pack of 25',
      consumedPerUnit: '1',
      binLocation: 'D-01-08',
      imageUrl: '',
      isArchived: false,
      purchaseRate: 28.50,
      unitsPerPurchase: 1,
      sku: '3M-CUB-60G',
      stockLevel: 18,
      minStockThreshold: 10,
      maxStockThreshold: 50,
      unitCost: 28.50,
      supplierId: 'sup_5',
      isAdr: false,
      adrScore: 0.0,
      allowedAreaIds: ['area_2', 'area_3'],
      areaConfigs: { area_2: { maxOrderQuantity: 5 } },
      createdAt: 1710000000000,
      updatedAt: 1710000000000
    },
    {
      id: 'prod_9',
      name: 'Heavy Duty Black Nitrile Powder-Free Gloves (Large)',
      cNumber: 'C-60090',
      categoryId: 'cat_4',
      packSize: 'Box of 100',
      consumedPerUnit: '1',
      binLocation: 'PPE-01-02',
      imageUrl: '',
      isArchived: false,
      purchaseRate: 9.20,
      unitsPerPurchase: 1,
      sku: 'GLV-NIT-LG',
      stockLevel: 52,
      minStockThreshold: 15,
      maxStockThreshold: 100,
      unitCost: 9.20,
      supplierId: 'sup_5',
      isAdr: false,
      adrScore: 0.0,
      allowedAreaIds: ['area_1', 'area_2', 'area_3', 'area_4', 'area_5'],
      areaConfigs: { area_1: { maxOrderQuantity: 4 }, area_2: { maxOrderQuantity: 4 } },
      createdAt: 1710000000000,
      updatedAt: 1710000000000
    },
    {
      id: 'prod_10',
      name: 'High-Temp Zinc Cold Galvanising Primer Spray 400ml',
      cNumber: 'C-70014',
      categoryId: 'cat_6',
      packSize: '400ml Can',
      consumedPerUnit: '1',
      binLocation: 'C-04-08',
      imageUrl: '',
      isArchived: false,
      purchaseRate: 8.40,
      unitsPerPurchase: 6,
      sku: 'SPR-ZNC-400',
      stockLevel: 32,
      minStockThreshold: 10,
      maxStockThreshold: 60,
      unitCost: 8.40,
      supplierId: 'sup_1',
      isAdr: true,
      adrScore: 3.0,
      allowedAreaIds: ['area_2', 'area_3'],
      areaConfigs: { area_2: { maxOrderQuantity: 4 } },
      createdAt: 1710000000000,
      updatedAt: 1710000000000
    }
  ],
  orders: [
    {
      id: 'ord-1001',
      userId: 'usr-worker-1',
      areaId: 'area_1',
      status: 'PENDING',
      totalCost: 58.10,
      totalAdrScore: 2.5,
      deliveryNoteGenerated: false,
      createdAt: 1710001000000,
      items: [
        { productId: 'prod_1', name: 'Loctite 243 Medium Strength Threadlocker 50ml', quantity: 2, pickedQuantity: 0, unitCost: 14.50, adrScore: 0.0, cNumber: 'C-10024', binLocation: 'B-12-04' },
        { productId: 'prod_3', name: 'Aerosol Brake & Parts Cleaner 500ml', quantity: 1, pickedQuantity: 0, unitCost: 4.80, adrScore: 2.5, cNumber: 'C-20091', binLocation: 'C-04-01' },
        { productId: 'prod_4', name: 'M10 x 30mm Grade 8.8 High Tensile Hex Bolts', quantity: 1, pickedQuantity: 0, unitCost: 18.90, adrScore: 0.0, cNumber: 'C-30110', binLocation: 'A-02-14' },
        { productId: 'prod_5', name: 'M10 Nyloc Locking Nuts Zinc Plated', quantity: 1, pickedQuantity: 0, unitCost: 11.40, adrScore: 0.0, cNumber: 'C-30112', binLocation: 'A-02-16' }
      ]
    },
    {
      id: 'ord-1002',
      userId: 'usr-worker-2',
      areaId: 'area_2',
      status: 'PICKED',
      totalCost: 84.80,
      totalAdrScore: 5.5,
      deliveryNoteGenerated: true,
      createdAt: 1710000500000,
      items: [
        { productId: 'prod_8', name: '3M Cubitron II Fibre Sanding Discs 125mm 60G', quantity: 2, pickedQuantity: 2, unitCost: 28.50, adrScore: 0.0, cNumber: 'C-50060', binLocation: 'D-01-08' },
        { productId: 'prod_3', name: 'Aerosol Brake & Parts Cleaner 500ml', quantity: 2, pickedQuantity: 2, unitCost: 4.80, adrScore: 2.5, cNumber: 'C-20091', binLocation: 'C-04-01' },
        { productId: 'prod_10', name: 'High-Temp Zinc Cold Galvanising Primer Spray 400ml', quantity: 1, pickedQuantity: 1, unitCost: 8.40, adrScore: 3.0, cNumber: 'C-70014', binLocation: 'C-04-08' }
      ]
    },
    {
      id: 'ord-1003',
      userId: 'usr-worker-1',
      areaId: 'area_1',
      status: 'DELIVERED',
      totalCost: 45.60,
      totalAdrScore: 0.0,
      deliveryNoteGenerated: true,
      createdAt: 1709995000000,
      items: [
        { productId: 'prod_1', name: 'Loctite 243 Medium Strength Threadlocker 50ml', quantity: 2, pickedQuantity: 2, unitCost: 14.50, adrScore: 0.0, cNumber: 'C-10024', binLocation: 'B-12-04' },
        { productId: 'prod_7', name: 'Multi-Purpose EP2 Lithium Grease Cartridge 400g', quantity: 4, pickedQuantity: 4, unitCost: 3.95, adrScore: 0.0, cNumber: 'C-40082', binLocation: 'B-08-02' }
      ]
    }
  ],
  email_logs: []
};

// Initialize DB Connection or Fallback
export async function initDatabase() {
  try {
    pool = mysql.createPool(DB_CONFIG);
    await pool.query('SELECT 1 as test');
    isConnected = true;
    console.log(`[DB] Successfully connected to MariaDB at ${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database}`);

    // Check if the required tables exist; if missing, execute schema.sql automatically
    try {
      const [tableCheck] = await pool.query(
        "SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = ? AND table_name = 'users'",
        [DB_CONFIG.database]
      );
      if (tableCheck[0].cnt === 0) {
        console.log(`[DB] Tables not found in '${DB_CONFIG.database}'. Automatically applying schema.sql...`);
        const schemaCandidates = [
          path.resolve(__dirname, '../schema.sql'),
          path.resolve(process.cwd(), 'schema.sql'),
          '/app/schema.sql'
        ];
        let schemaSql = null;
        for (const candidate of schemaCandidates) {
          if (fs.existsSync(candidate)) {
            schemaSql = fs.readFileSync(candidate, 'utf-8');
            break;
          }
        }
        if (schemaSql) {
          await pool.query(schemaSql);
          console.log('[DB] Schema and initial seed data applied successfully to MariaDB.');
        } else {
          console.warn('[DB] Could not find schema.sql to automatically bootstrap tables.');
        }
      } else {
        console.log(`[DB] Verified tables exist in '${DB_CONFIG.database}'.`);
      }
    } catch (schemaErr) {
      console.warn(`[DB] Schema verification notice: ${schemaErr.message}`);
    }
  } catch (err) {
    isConnected = false;
    console.warn(`[DB] MariaDB not reachable (${err.message}). Using resilient local in-memory store initialized from schema.`);
  }
}

export function getStatus() {
  return {
    database: isConnected ? 'mariadb' : 'memory',
    connected: isConnected,
    host: DB_CONFIG.host,
    port: DB_CONFIG.port,
    name: DB_CONFIG.database
  };
}

// ----------------------------------------------------------------------
// Users
// ----------------------------------------------------------------------
export async function getUsers() {
  if (isConnected) {
    const [rows] = await pool.query('SELECT * FROM users ORDER BY name ASC');
    return rows.map(r => ({ ...r, accessAllowed: Boolean(r.accessAllowed) }));
  }
  return [...memoryStore.users].sort((a, b) => a.name.localeCompare(b.name));
}

export async function getUserById(id) {
  if (isConnected) {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    return rows[0] ? { ...rows[0], accessAllowed: Boolean(rows[0].accessAllowed) } : null;
  }
  return memoryStore.users.find(u => u.id === id) || null;
}

export async function getUserByEmail(email) {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (isConnected) {
    const [rows] = await pool.query('SELECT * FROM users WHERE LOWER(email) = ?', [cleanEmail]);
    return rows[0] ? { ...rows[0], accessAllowed: Boolean(rows[0].accessAllowed) } : null;
  }
  return memoryStore.users.find(u => u.email.trim().toLowerCase() === cleanEmail) || null;
}

export async function createUser(data) {
  const now = Date.now();
  const id = data.id || `usr-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
  const newUser = {
    id,
    name: data.name,
    email: data.email.trim().toLowerCase(),
    password: data.password || 'worker',
    role: data.role || 'PRODUCTION',
    areaId: data.areaId || null,
    accessAllowed: data.accessAllowed !== false,
    createdAt: now,
    updatedAt: now
  };

  if (isConnected) {
    await pool.query(
      'INSERT INTO users (id, name, email, password, role, areaId, accessAllowed, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [newUser.id, newUser.name, newUser.email, newUser.password, newUser.role, newUser.areaId, newUser.accessAllowed, newUser.createdAt, newUser.updatedAt]
    );
  } else {
    memoryStore.users.push(newUser);
  }
  return newUser;
}

export async function updateUser(id, updates) {
  const now = Date.now();
  if (isConnected) {
    const allowed = ['name', 'email', 'password', 'role', 'areaId', 'accessAllowed'];
    const fields = [];
    const values = [];
    for (const key of allowed) {
      if (updates[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(updates[key]);
      }
    }
    fields.push('updatedAt = ?');
    values.push(now);
    values.push(id);
    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
    return getUserById(id);
  } else {
    const idx = memoryStore.users.findIndex(u => u.id === id);
    if (idx !== -1) {
      memoryStore.users[idx] = { ...memoryStore.users[idx], ...updates, updatedAt: now };
      return memoryStore.users[idx];
    }
    return null;
  }
}

export async function deleteUser(id) {
  if (isConnected) {
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
  } else {
    memoryStore.users = memoryStore.users.filter(u => u.id !== id);
  }
  return true;
}

// ----------------------------------------------------------------------
// Areas
// ----------------------------------------------------------------------
export async function getAreas() {
  if (isConnected) {
    const [rows] = await pool.query('SELECT * FROM areas ORDER BY name ASC');
    return rows;
  }
  return [...memoryStore.areas].sort((a, b) => a.name.localeCompare(b.name));
}

export async function createArea(data) {
  const id = data.id || `area_${Date.now()}`;
  const newArea = {
    id,
    name: data.name,
    description: data.description || '',
    color: data.color || 'blue',
    icon: data.icon || 'Wrench',
    imageUrl: data.imageUrl || '',
    notificationEmail: data.notificationEmail || '',
    budgetLimit: Number(data.budgetLimit || 5000),
    currentSpend: Number(data.currentSpend || 0),
    createdAt: Date.now()
  };

  if (isConnected) {
    await pool.query(
      'INSERT INTO areas (id, name, description, color, icon, imageUrl, notificationEmail, budgetLimit, currentSpend, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [newArea.id, newArea.name, newArea.description, newArea.color, newArea.icon, newArea.imageUrl, newArea.notificationEmail, newArea.budgetLimit, newArea.currentSpend, newArea.createdAt]
    );
  } else {
    memoryStore.areas.push(newArea);
  }
  return newArea;
}

export async function updateArea(id, updates) {
  if (isConnected) {
    const allowed = ['name', 'description', 'color', 'icon', 'imageUrl', 'notificationEmail', 'budgetLimit', 'currentSpend'];
    const fields = [];
    const values = [];
    for (const key of allowed) {
      if (updates[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(updates[key]);
      }
    }
    values.push(id);
    await pool.query(`UPDATE areas SET ${fields.join(', ')} WHERE id = ?`, values);
    const [rows] = await pool.query('SELECT * FROM areas WHERE id = ?', [id]);
    return rows[0] || null;
  } else {
    const idx = memoryStore.areas.findIndex(a => a.id === id);
    if (idx !== -1) {
      memoryStore.areas[idx] = { ...memoryStore.areas[idx], ...updates };
      return memoryStore.areas[idx];
    }
    return null;
  }
}

export async function deleteArea(id) {
  if (isConnected) {
    await pool.query('DELETE FROM areas WHERE id = ?', [id]);
  } else {
    memoryStore.areas = memoryStore.areas.filter(a => a.id !== id);
  }
  return true;
}

// ----------------------------------------------------------------------
// Categories & Suppliers
// ----------------------------------------------------------------------
export async function getCategories() {
  if (isConnected) {
    const [rows] = await pool.query('SELECT * FROM categories ORDER BY name ASC');
    return rows;
  }
  return [...memoryStore.categories].sort((a, b) => a.name.localeCompare(b.name));
}

export async function createCategory(name) {
  const id = `cat_${Date.now()}`;
  const record = { id, name, createdAt: Date.now() };
  if (isConnected) {
    await pool.query('INSERT INTO categories (id, name, createdAt) VALUES (?, ?, ?)', [id, name, record.createdAt]);
  } else {
    memoryStore.categories.push(record);
  }
  return record;
}

export async function deleteCategory(id) {
  if (isConnected) {
    await pool.query('DELETE FROM categories WHERE id = ?', [id]);
  } else {
    memoryStore.categories = memoryStore.categories.filter(c => c.id !== id);
  }
  return true;
}

export async function getSuppliers() {
  if (isConnected) {
    const [rows] = await pool.query('SELECT * FROM suppliers ORDER BY name ASC');
    return rows;
  }
  return [...memoryStore.suppliers].sort((a, b) => a.name.localeCompare(b.name));
}

export async function createSupplier(name) {
  const id = `sup_${Date.now()}`;
  const record = { id, name, createdAt: Date.now() };
  if (isConnected) {
    await pool.query('INSERT INTO suppliers (id, name, createdAt) VALUES (?, ?, ?)', [id, name, record.createdAt]);
  } else {
    memoryStore.suppliers.push(record);
  }
  return record;
}

export async function deleteSupplier(id) {
  if (isConnected) {
    await pool.query('DELETE FROM suppliers WHERE id = ?', [id]);
  } else {
    memoryStore.suppliers = memoryStore.suppliers.filter(s => s.id !== id);
  }
  return true;
}

// ----------------------------------------------------------------------
// Products
// ----------------------------------------------------------------------
function parseProductRow(r) {
  return {
    ...r,
    isArchived: Boolean(r.isArchived),
    isAdr: Boolean(r.isAdr),
    purchaseRate: Number(r.purchaseRate || 0),
    unitCost: Number(r.unitCost || 0),
    stockLevel: Number(r.stockLevel || 0),
    minStockThreshold: Number(r.minStockThreshold || 0),
    maxStockThreshold: Number(r.maxStockThreshold || 0),
    adrScore: Number(r.adrScore || 0),
    unitsPerPurchase: Number(r.unitsPerPurchase || 1),
    allowedAreaIds: typeof r.allowedAreaIds === 'string' ? JSON.parse(r.allowedAreaIds || '[]') : (r.allowedAreaIds || []),
    areaConfigs: typeof r.areaConfigs === 'string' ? JSON.parse(r.areaConfigs || '{}') : (r.areaConfigs || {})
  };
}

export async function getProducts() {
  if (isConnected) {
    const [rows] = await pool.query('SELECT * FROM products ORDER BY name ASC');
    return rows.map(parseProductRow);
  }
  return [...memoryStore.products].sort((a, b) => a.name.localeCompare(b.name));
}

export async function createProduct(data) {
  const now = Date.now();
  const id = data.id || `prod_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const prod = {
    id,
    name: data.name,
    cNumber: data.cNumber || '',
    categoryId: data.categoryId || '',
    packSize: data.packSize || '1',
    consumedPerUnit: data.consumedPerUnit || '1',
    binLocation: data.binLocation || '',
    imageUrl: data.imageUrl || '',
    isArchived: Boolean(data.isArchived),
    purchaseRate: Number(data.purchaseRate || 0),
    unitsPerPurchase: Number(data.unitsPerPurchase || 1),
    sku: data.sku || '',
    stockLevel: Number(data.stockLevel || 0),
    minStockThreshold: Number(data.minStockThreshold || 5),
    maxStockThreshold: Number(data.maxStockThreshold || 100),
    unitCost: Number(data.unitCost || 0),
    supplierId: data.supplierId || '',
    isAdr: Boolean(data.isAdr),
    adrScore: Number(data.adrScore || 0),
    allowedAreaIds: data.allowedAreaIds || [],
    areaConfigs: data.areaConfigs || {},
    createdAt: now,
    updatedAt: now
  };

  if (isConnected) {
    await pool.query(
      `INSERT INTO products (
        id, name, cNumber, categoryId, packSize, consumedPerUnit, binLocation, imageUrl,
        isArchived, purchaseRate, unitsPerPurchase, sku, stockLevel, minStockThreshold,
        maxStockThreshold, unitCost, supplierId, isAdr, adrScore, allowedAreaIds, areaConfigs,
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        prod.id, prod.name, prod.cNumber, prod.categoryId, prod.packSize, prod.consumedPerUnit, prod.binLocation, prod.imageUrl,
        prod.isArchived, prod.purchaseRate, prod.unitsPerPurchase, prod.sku, prod.stockLevel, prod.minStockThreshold,
        prod.maxStockThreshold, prod.unitCost, prod.supplierId, prod.isAdr, prod.adrScore, JSON.stringify(prod.allowedAreaIds), JSON.stringify(prod.areaConfigs),
        prod.createdAt, prod.updatedAt
      ]
    );
  } else {
    memoryStore.products.push(prod);
  }
  return prod;
}

export async function updateProduct(id, updates) {
  const now = Date.now();
  if (isConnected) {
    const allowed = [
      'name', 'cNumber', 'categoryId', 'packSize', 'consumedPerUnit', 'binLocation',
      'imageUrl', 'isArchived', 'purchaseRate', 'unitsPerPurchase', 'sku', 'stockLevel',
      'minStockThreshold', 'maxStockThreshold', 'unitCost', 'supplierId', 'isAdr', 'adrScore'
    ];
    const fields = [];
    const values = [];
    for (const key of allowed) {
      if (updates[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(updates[key]);
      }
    }
    if (updates.allowedAreaIds !== undefined) {
      fields.push('allowedAreaIds = ?');
      values.push(JSON.stringify(updates.allowedAreaIds));
    }
    if (updates.areaConfigs !== undefined) {
      fields.push('areaConfigs = ?');
      values.push(JSON.stringify(updates.areaConfigs));
    }
    fields.push('updatedAt = ?');
    values.push(now);
    values.push(id);

    await pool.query(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, values);
    const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [id]);
    return rows[0] ? parseProductRow(rows[0]) : null;
  } else {
    const idx = memoryStore.products.findIndex(p => p.id === id);
    if (idx !== -1) {
      memoryStore.products[idx] = { ...memoryStore.products[idx], ...updates, updatedAt: now };
      return memoryStore.products[idx];
    }
    return null;
  }
}

export async function deleteProduct(id) {
  if (isConnected) {
    await pool.query('DELETE FROM products WHERE id = ?', [id]);
  } else {
    memoryStore.products = memoryStore.products.filter(p => p.id !== id);
  }
  return true;
}

export async function batchUpsertProducts(items) {
  const results = [];
  for (const item of items) {
    if (item.id) {
      const existing = isConnected 
        ? (await pool.query('SELECT id FROM products WHERE id = ?', [item.id]))[0][0]
        : memoryStore.products.find(p => p.id === item.id);
      if (existing) {
        results.push(await updateProduct(item.id, item));
        continue;
      }
    }
    results.push(await createProduct(item));
  }
  return results;
}

// ----------------------------------------------------------------------
// Orders & Order Items
// ----------------------------------------------------------------------
export async function getOrders() {
  if (isConnected) {
    const [orders] = await pool.query('SELECT * FROM orders ORDER BY createdAt DESC');
    const [items] = await pool.query('SELECT * FROM order_items');

    const itemsByOrder = {};
    for (const item of items) {
      if (!itemsByOrder[item.orderId]) itemsByOrder[item.orderId] = [];
      itemsByOrder[item.orderId].push({
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        pickedQuantity: item.pickedQuantity,
        unitCost: Number(item.unitCost),
        adrScore: Number(item.adrScore),
        cNumber: item.cNumber,
        binLocation: item.binLocation
      });
    }

    return orders.map(o => ({
      ...o,
      totalCost: Number(o.totalCost),
      totalAdrScore: Number(o.totalAdrScore),
      deliveryNoteGenerated: Boolean(o.deliveryNoteGenerated),
      items: itemsByOrder[o.id] || []
    }));
  }

  return [...memoryStore.orders].sort((a, b) => b.createdAt - a.createdAt);
}

export async function createOrder(data) {
  const orderId = data.id || `ord-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
  const createdAt = data.createdAt || Date.now();
  const order = {
    id: orderId,
    userId: data.userId,
    areaId: data.areaId,
    status: data.status || 'PENDING',
    totalCost: Number(data.totalCost || 0),
    totalAdrScore: Number(data.totalAdrScore || 0),
    deliveryNoteGenerated: Boolean(data.deliveryNoteGenerated),
    createdAt,
    items: data.items || []
  };

  if (isConnected) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        'INSERT INTO orders (id, userId, areaId, status, totalCost, totalAdrScore, deliveryNoteGenerated, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [order.id, order.userId, order.areaId, order.status, order.totalCost, order.totalAdrScore, order.deliveryNoteGenerated, order.createdAt]
      );

      for (const item of order.items) {
        await conn.query(
          'INSERT INTO order_items (orderId, productId, name, quantity, pickedQuantity, unitCost, adrScore, cNumber, binLocation) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [order.id, item.productId, item.name, item.quantity, item.pickedQuantity || 0, item.unitCost || 0, item.adrScore || 0, item.cNumber || '', item.binLocation || '']
        );
        // Deduct inventory stock level
        await conn.query('UPDATE products SET stockLevel = GREATEST(0, stockLevel - ?) WHERE id = ?', [item.quantity, item.productId]);
      }

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } else {
    // In-memory deduction and addition
    memoryStore.orders.unshift(order);
    for (const item of order.items) {
      const prod = memoryStore.products.find(p => p.id === item.productId);
      if (prod) {
        prod.stockLevel = Math.max(0, prod.stockLevel - item.quantity);
      }
    }
  }

  return order;
}

export async function updateOrder(id, updates) {
  if (isConnected) {
    const allowed = ['status', 'deliveryNoteGenerated'];
    const fields = [];
    const values = [];
    for (const key of allowed) {
      if (updates[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(updates[key]);
      }
    }
    if (fields.length > 0) {
      values.push(id);
      await pool.query(`UPDATE orders SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    if (updates.items && Array.isArray(updates.items)) {
      for (const item of updates.items) {
        if (item.productId && item.pickedQuantity !== undefined) {
          await pool.query('UPDATE order_items SET pickedQuantity = ? WHERE orderId = ? AND productId = ?', [item.pickedQuantity, id, item.productId]);
        }
      }
    }

    const all = await getOrders();
    return all.find(o => o.id === id) || null;
  } else {
    const idx = memoryStore.orders.findIndex(o => o.id === id);
    if (idx !== -1) {
      memoryStore.orders[idx] = { ...memoryStore.orders[idx], ...updates };
      return memoryStore.orders[idx];
    }
    return null;
  }
}

export async function deleteOrder(id) {
  if (isConnected) {
    await pool.query('DELETE FROM orders WHERE id = ?', [id]);
  } else {
    memoryStore.orders = memoryStore.orders.filter(o => o.id !== id);
  }
  return true;
}

// ----------------------------------------------------------------------
// Email Logs
// ----------------------------------------------------------------------
export async function getEmailLogs() {
  if (isConnected) {
    const [rows] = await pool.query('SELECT * FROM email_logs ORDER BY sentAt DESC LIMIT 100');
    return rows;
  }
  return [...memoryStore.email_logs].sort((a, b) => b.sentAt - a.sentAt);
}

export async function createEmailLog(log) {
  const entry = {
    id: log.id || `log-${Date.now()}`,
    orderId: log.orderId || '',
    areaName: log.areaName || '',
    notificationEmail: log.notificationEmail || '',
    status: log.status || 'sent',
    previewUrl: log.previewUrl || null,
    messageId: log.messageId || null,
    error: log.error || null,
    sentAt: log.sentAt || Date.now()
  };

  if (isConnected) {
    await pool.query(
      'INSERT INTO email_logs (id, orderId, areaName, notificationEmail, status, previewUrl, messageId, error, sentAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [entry.id, entry.orderId, entry.areaName, entry.notificationEmail, entry.status, entry.previewUrl, entry.messageId, entry.error, entry.sentAt]
    );
  } else {
    memoryStore.email_logs.unshift(entry);
  }
  return entry;
}
