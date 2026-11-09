export type Role = 'LOGISTICS' | 'PRODUCTION' | 'PRODUCTION_ENGINEERING';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: Role;
  areaId: string | null;
  password?: string;
  accessAllowed?: boolean;
}

export interface Area {
  id: string;
  name: string;
  imageUrl?: string;
  description?: string;
  color?: string;
  icon?: string;
  notificationEmail?: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface Supplier {
  id: string;
  name: string;
}

export interface AreaConfig {
  maxOrderQuantity: number;
}

export interface Product {
  id: string;
  name: string;
  cNumber: string;
  categoryId: string;
  packSize: string;
  consumedPerUnit: string;
  binLocation: string;
  imageUrl: string;
  isArchived: boolean;
  purchaseRate: number;
  unitsPerPurchase: number;
  sku: string;
  stockLevel: number;
  minStockThreshold: number;
  maxStockThreshold: number;
  unitCost: number;
  supplierId: string;
  supplier?: string; // For backwards compatibility during migration
  isAdr: boolean;
  adrScore: number;
  allowedAreaIds: string[];
  areaConfigs?: Record<string, AreaConfig>;
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  pickedQuantity?: number;
  unitCost: number;
  adrScore: number;
  cNumber?: string;
  binLocation?: string;
}

export interface Order {
  id: string;
  userId: string;
  areaId: string;
  status: 'PENDING' | 'PARTIALLY_PICKED' | 'PICKED' | 'DELIVERED';
  totalCost: number;
  totalAdrScore: number;
  createdAt: number;
  deliveryNoteGenerated: boolean;
  items: OrderItem[];
}
