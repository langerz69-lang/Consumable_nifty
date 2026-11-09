-- MariaDB Database Schema for Consumables Hub
-- Configured for MariaDB 10.x / 11.x (Local Air-Gapped Deployment)

CREATE DATABASE IF NOT EXISTS consumables_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE consumables_db;

-- 1. Users table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    password VARCHAR(120) NOT NULL,
    role ENUM('LOGISTICS', 'PRODUCTION', 'PRODUCTION_ENGINEERING') NOT NULL DEFAULT 'PRODUCTION',
    areaId VARCHAR(64) NULL,
    accessAllowed BOOLEAN NOT NULL DEFAULT TRUE,
    createdAt BIGINT NOT NULL,
    updatedAt BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Areas table
CREATE TABLE IF NOT EXISTS areas (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    description TEXT NULL,
    color VARCHAR(40) DEFAULT 'blue',
    icon VARCHAR(60) DEFAULT 'Wrench',
    imageUrl VARCHAR(255) NULL,
    notificationEmail VARCHAR(120) NULL,
    budgetLimit DECIMAL(10,2) DEFAULT 5000.00,
    currentSpend DECIMAL(10,2) DEFAULT 0.00,
    createdAt BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Categories table
CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    createdAt BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    createdAt BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Products table
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    cNumber VARCHAR(60) NOT NULL DEFAULT '',
    categoryId VARCHAR(64) NOT NULL,
    packSize VARCHAR(60) DEFAULT '1 pk',
    consumedPerUnit VARCHAR(60) DEFAULT '1',
    binLocation VARCHAR(60) DEFAULT 'A-01',
    imageUrl VARCHAR(255) DEFAULT '',
    isArchived BOOLEAN NOT NULL DEFAULT FALSE,
    purchaseRate DECIMAL(10,2) DEFAULT 0.00,
    unitsPerPurchase INT DEFAULT 1,
    sku VARCHAR(60) NOT NULL DEFAULT '',
    stockLevel INT NOT NULL DEFAULT 0,
    minStockThreshold INT NOT NULL DEFAULT 5,
    maxStockThreshold INT NOT NULL DEFAULT 100,
    unitCost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    supplierId VARCHAR(64) NOT NULL,
    isAdr BOOLEAN NOT NULL DEFAULT FALSE,
    adrScore DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    allowedAreaIds JSON NULL,
    areaConfigs JSON NULL,
    createdAt BIGINT NOT NULL,
    updatedAt BIGINT NOT NULL,
    INDEX idx_category (categoryId),
    INDEX idx_supplier (supplierId),
    INDEX idx_cnumber (cNumber)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Orders table
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(64) PRIMARY KEY,
    userId VARCHAR(64) NOT NULL,
    areaId VARCHAR(64) NOT NULL,
    status ENUM('PENDING', 'PARTIALLY_PICKED', 'PICKED', 'DELIVERED') NOT NULL DEFAULT 'PENDING',
    totalCost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    totalAdrScore DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    deliveryNoteGenerated BOOLEAN NOT NULL DEFAULT FALSE,
    createdAt BIGINT NOT NULL,
    INDEX idx_area (areaId),
    INDEX idx_status (status),
    INDEX idx_created (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Order Items table
CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    orderId VARCHAR(64) NOT NULL,
    productId VARCHAR(64) NOT NULL,
    name VARCHAR(160) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    pickedQuantity INT NOT NULL DEFAULT 0,
    unitCost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    adrScore DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    cNumber VARCHAR(60) DEFAULT '',
    binLocation VARCHAR(60) DEFAULT '',
    FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE,
    INDEX idx_order (orderId),
    INDEX idx_product (productId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Email Logs table
CREATE TABLE IF NOT EXISTS email_logs (
    id VARCHAR(64) PRIMARY KEY,
    orderId VARCHAR(64) NOT NULL,
    areaName VARCHAR(120) NOT NULL,
    notificationEmail VARCHAR(120) NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'sent',
    previewUrl TEXT NULL,
    messageId VARCHAR(120) NULL,
    error TEXT NULL,
    sentAt BIGINT NOT NULL,
    INDEX idx_order (orderId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- INITIAL SEED DATA (Self-Contained Local Manufacturing Demonstration Dataset)
-- ==============================================================================

-- Seed Categories
INSERT INTO categories (id, name, createdAt) VALUES
('cat_1', 'Fasteners & Fixings', 1710000000000),
('cat_2', 'Adhesives & Sealants', 1710000000000),
('cat_3', 'Lubricants & Oils', 1710000000000),
('cat_4', 'PPE & Safety Supplies', 1710000000000),
('cat_5', 'Abrasives & Cutting', 1710000000000),
('cat_6', 'Cleaning & Degreasing', 1710000000000)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Seed Suppliers
INSERT INTO suppliers (id, name, createdAt) VALUES
('sup_1', 'Brammer Buck & Hickman', 1710000000000),
('sup_2', 'RS Components Ltd', 1710000000000),
('sup_3', 'Henkel Loctite UK', 1710000000000),
('sup_4', 'Fuchs Lubricants PLC', 1710000000000),
('sup_5', '3M Industrial Safety', 1710000000000)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Seed Manufacturing Areas
INSERT INTO areas (id, name, description, color, icon, imageUrl, notificationEmail, budgetLimit, currentSpend, createdAt) VALUES
('area_1', 'Main Assembly Line 1', 'Chassis assembly, hydraulic integration, and torque fitting line.', 'blue', 'Wrench', '', 'line1-leads@company.local', 8500.00, 1420.50, 1710000000000),
('area_2', 'Welding & Fabrication Bay', 'MIG/TIG welding cells, structural jigging, and grinding bays.', 'amber', 'Flame', '', 'fabrication@company.local', 6000.00, 2180.00, 1710000000000),
('area_3', 'Paint & Surface Treatment', 'Spray booths, powder coating, degreasing, and prep bays.', 'emerald', 'Sparkles', '', 'paintshop@company.local', 9500.00, 3110.00, 1710000000000),
('area_4', 'Electrical & Loom Assembly', 'Control boxes, harness routing, testing, and telematics fitting.', 'indigo', 'Zap', '', 'electrical@company.local', 5000.00, 680.00, 1710000000000),
('area_5', 'PDI & Final Inspection', 'Pre-delivery inspection, functional testing, and decal applications.', 'purple', 'CheckCircle2', '', 'pdi@company.local', 4000.00, 420.00, 1710000000000)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Seed Users
INSERT INTO users (id, name, email, password, role, areaId, accessAllowed, createdAt, updatedAt) VALUES
('usr-admin-1', 'Logistics Admin', 'admin@logistics.co', 'admin', 'LOGISTICS', NULL, TRUE, 1710000000000, 1710000000000),
('usr-admin-local', 'System Admin', 'admin@consumables.local', 'admin123', 'LOGISTICS', NULL, TRUE, 1710000000000, 1710000000000),
('usr-admin-user', 'System Administrator', 'langerz69@gmail.com', 'admin123', 'LOGISTICS', NULL, TRUE, 1710000000000, 1710000000000),
('usr-langford', 'C Langford', 'clangford@niftylift.com', 'admin', 'LOGISTICS', NULL, TRUE, 1710000000000, 1710000000000),
('usr-worker-1', 'Production Worker', 'worker@production.co', 'worker', 'PRODUCTION', 'area_1', TRUE, 1710000000000, 1710000000000),
('usr-worker-2', 'Dave Miller', 'dave@production.co', 'worker', 'PRODUCTION', 'area_2', TRUE, 1710000000000, 1710000000000),
('usr-eng-1', 'Production Engineer', 'eng@production.co', 'engineer', 'PRODUCTION_ENGINEERING', NULL, TRUE, 1710000000000, 1710000000000)
ON DUPLICATE KEY UPDATE name=VALUES(name), password=VALUES(password), role=VALUES(role), accessAllowed=VALUES(accessAllowed);


-- Seed Products
INSERT INTO products (id, name, cNumber, categoryId, packSize, consumedPerUnit, binLocation, imageUrl, isArchived, purchaseRate, unitsPerPurchase, sku, stockLevel, minStockThreshold, maxStockThreshold, unitCost, supplierId, isAdr, adrScore, allowedAreaIds, areaConfigs, createdAt, updatedAt) VALUES
('prod_1', 'Loctite 243 Medium Strength Threadlocker 50ml', 'C-10024', 'cat_2', '50ml Bottle', '0.05', 'B-12-04', '', FALSE, 14.50, 1, 'LOC-243-50', 38, 10, 80, 14.50, 'sup_3', FALSE, 0.00, '["area_1","area_2","area_4"]', '{"area_1":{"maxOrderQuantity":5},"area_2":{"maxOrderQuantity":10}}', 1710000000000, 1710000000000),
('prod_2', 'Loctite 577 Thread Sealant Gel 50ml', 'C-10057', 'cat_2', '50ml Tube', '0.08', 'B-12-06', '', FALSE, 16.20, 1, 'LOC-577-50', 24, 8, 60, 16.20, 'sup_3', FALSE, 0.00, '["area_1","area_2"]', '{"area_1":{"maxOrderQuantity":4}}', 1710000000000, 1710000000000),
('prod_3', 'Aerosol Brake & Parts Cleaner 500ml', 'C-20091', 'cat_6', '500ml Can', '1', 'C-04-01', '', FALSE, 4.80, 12, 'BRK-CLN-500', 142, 30, 250, 4.80, 'sup_1', TRUE, 2.50, '["area_1","area_2","area_3","area_5"]', '{"area_1":{"maxOrderQuantity":12},"area_3":{"maxOrderQuantity":24}}', 1710000000000, 1710000000000),
('prod_4', 'M10 x 30mm Grade 8.8 High Tensile Hex Bolts', 'C-30110', 'cat_1', 'Box of 100', '1', 'A-02-14', '', FALSE, 18.90, 1, 'BOLT-M10-30', 85, 20, 150, 18.90, 'sup_2', FALSE, 0.00, '["area_1","area_2","area_5"]', '{"area_1":{"maxOrderQuantity":10}}', 1710000000000, 1710000000000),
('prod_5', 'M10 Nyloc Locking Nuts Zinc Plated', 'C-30112', 'cat_1', 'Box of 100', '1', 'A-02-16', '', FALSE, 11.40, 1, 'NUT-NYL-M10', 94, 25, 200, 11.40, 'sup_2', FALSE, 0.00, '["area_1","area_2","area_5"]', '{"area_1":{"maxOrderQuantity":10}}', 1710000000000, 1710000000000),
('prod_6', 'ISO 46 Anti-Wear Hydraulic Fluid 20L Drum', 'C-40046', 'cat_3', '20L Drum', '1', 'OIL-BAY-1', '', FALSE, 48.00, 1, 'HYD-ISO46-20', 16, 5, 40, 48.00, 'sup_4', TRUE, 5.00, '["area_1","area_5"]', '{"area_1":{"maxOrderQuantity":2}}', 1710000000000, 1710000000000),
('prod_7', 'Multi-Purpose EP2 Lithium Grease Cartridge 400g', 'C-40082', 'cat_3', '400g Tube', '1', 'B-08-02', '', FALSE, 3.95, 10, 'GRS-EP2-400', 65, 15, 120, 3.95, 'sup_4', FALSE, 0.00, '["area_1","area_2","area_5"]', '{"area_1":{"maxOrderQuantity":6}}', 1710000000000, 1710000000000),
('prod_8', '3M Cubitron II Fibre Sanding Discs 125mm 60G', 'C-50060', 'cat_5', 'Pack of 25', '1', 'D-01-08', '', FALSE, 28.50, 1, '3M-CUB-60G', 18, 10, 50, 28.50, 'sup_5', FALSE, 0.00, '["area_2","area_3"]', '{"area_2":{"maxOrderQuantity":5}}', 1710000000000, 1710000000000),
('prod_9', 'Heavy Duty Black Nitrile Powder-Free Gloves (Large)', 'C-60090', 'cat_4', 'Box of 100', '1', 'PPE-01-02', '', FALSE, 9.20, 1, 'GLV-NIT-LG', 52, 15, 100, 9.20, 'sup_5', FALSE, 0.00, '["area_1","area_2","area_3","area_4","area_5"]', '{"area_1":{"maxOrderQuantity":4},"area_2":{"maxOrderQuantity":4}}', 1710000000000, 1710000000000),
('prod_10', 'High-Temp Zinc Cold Galvanising Primer Spray 400ml', 'C-70014', 'cat_6', '400ml Can', '1', 'C-04-08', '', FALSE, 8.40, 6, 'SPR-ZNC-400', 32, 10, 60, 8.40, 'sup_1', TRUE, 3.00, '["area_2","area_3"]', '{"area_2":{"maxOrderQuantity":4}}', 1710000000000, 1710000000000)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Seed Sample Active Orders
INSERT INTO orders (id, userId, areaId, status, totalCost, totalAdrScore, deliveryNoteGenerated, createdAt) VALUES
('ord-1001', 'usr-worker-1', 'area_1', 'PENDING', 58.10, 2.50, FALSE, 1710001000000),
('ord-1002', 'usr-worker-2', 'area_2', 'PICKED', 84.80, 5.50, TRUE, 1710000500000),
('ord-1003', 'usr-worker-1', 'area_1', 'DELIVERED', 45.60, 0.00, TRUE, 1709995000000)
ON DUPLICATE KEY UPDATE id=id;

-- Seed Sample Order Items
INSERT INTO order_items (orderId, productId, name, quantity, pickedQuantity, unitCost, adrScore, cNumber, binLocation) VALUES
('ord-1001', 'prod_1', 'Loctite 243 Medium Strength Threadlocker 50ml', 2, 0, 14.50, 0.00, 'C-10024', 'B-12-04'),
('ord-1001', 'prod_3', 'Aerosol Brake & Parts Cleaner 500ml', 1, 0, 4.80, 2.50, 'C-20091', 'C-04-01'),
('ord-1001', 'prod_4', 'M10 x 30mm Grade 8.8 High Tensile Hex Bolts', 1, 0, 18.90, 0.00, 'C-30110', 'A-02-14'),
('ord-1001', 'prod_5', 'M10 Nyloc Locking Nuts Zinc Plated', 1, 0, 11.40, 0.00, 'C-30112', 'A-02-16'),
('ord-1002', 'prod_8', '3M Cubitron II Fibre Sanding Discs 125mm 60G', 2, 2, 28.50, 0.00, 'C-50060', 'D-01-08'),
('ord-1002', 'prod_3', 'Aerosol Brake & Parts Cleaner 500ml', 2, 2, 4.80, 2.50, 'C-20091', 'C-04-01'),
('ord-1002', 'prod_10', 'High-Temp Zinc Cold Galvanising Primer Spray 400ml', 1, 1, 8.40, 3.00, 'C-70014', 'C-04-08'),
('ord-1003', 'prod_1', 'Loctite 243 Medium Strength Threadlocker 50ml', 2, 2, 14.50, 0.00, 'C-10024', 'B-12-04'),
('ord-1003', 'prod_7', 'Multi-Purpose EP2 Lithium Grease Cartridge 400g', 4, 4, 3.95, 0.00, 'C-40082', 'B-08-02')
ON DUPLICATE KEY UPDATE id=id;
