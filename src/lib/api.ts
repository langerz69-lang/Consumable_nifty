import { UserProfile, Area, Category, Supplier, Product, Order } from '../types';

const BASE_URL = '/api';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    let errorMsg = `API Error ${res.status}: ${res.statusText}`;
    try {
      const body = await res.json();
      if (body.error) errorMsg = body.error;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  return res.json();
}

export const api = {
  // Auth
  async login(email: string, password: string): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  // Users
  async getUsers(): Promise<UserProfile[]> {
    return request<UserProfile[]>('/users');
  },
  async createUser(data: Partial<UserProfile>): Promise<UserProfile> {
    return request<UserProfile>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async updateUser(id: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    return request<UserProfile>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },
  async deleteUser(id: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/users/${id}`, {
      method: 'DELETE',
    });
  },

  // Areas
  async getAreas(): Promise<Area[]> {
    return request<Area[]>('/areas');
  },
  async createArea(data: Partial<Area>): Promise<Area> {
    return request<Area>('/areas', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async updateArea(id: string, updates: Partial<Area>): Promise<Area> {
    return request<Area>(`/areas/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },
  async deleteArea(id: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/areas/${id}`, {
      method: 'DELETE',
    });
  },

  // Categories
  async getCategories(): Promise<Category[]> {
    return request<Category[]>('/categories');
  },
  async createCategory(data: string | { id?: string; name: string }): Promise<Category> {
    const payload = typeof data === 'string' ? { name: data } : data;
    return request<Category>('/categories', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  async deleteCategory(id: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/categories/${id}`, {
      method: 'DELETE',
    });
  },

  // Suppliers
  async getSuppliers(): Promise<Supplier[]> {
    return request<Supplier[]>('/suppliers');
  },
  async createSupplier(data: string | { id?: string; name: string }): Promise<Supplier> {
    const payload = typeof data === 'string' ? { name: data } : data;
    return request<Supplier>('/suppliers', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  async deleteSupplier(id: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/suppliers/${id}`, {
      method: 'DELETE',
    });
  },

  // Products
  async getProducts(): Promise<Product[]> {
    return request<Product[]>('/products');
  },
  async createProduct(data: Partial<Product>): Promise<Product> {
    return request<Product>('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
    return request<Product>(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },
  async deleteProduct(id: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/products/${id}`, {
      method: 'DELETE',
    });
  },
  async batchUpsertProducts(items: Partial<Product>[]): Promise<{ success: boolean; count: number; items: Product[] }> {
    return request<{ success: boolean; count: number; items: Product[] }>('/products/batch', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  },

  // Orders
  async getOrders(): Promise<Order[]> {
    return request<Order[]>('/orders');
  },
  async createOrder(data: Partial<Order>): Promise<Order> {
    return request<Order>('/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async updateOrder(id: string, updates: Partial<Order>): Promise<Order> {
    return request<Order>(`/orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },
  async deleteOrder(id: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/orders/${id}`, {
      method: 'DELETE',
    });
  },

  // Email Logs
  async getEmailLogs(): Promise<any[]> {
    return request<any[]>('/email-logs');
  },
  async createEmailLog(log: any): Promise<any> {
    return request<any>('/email-logs', {
      method: 'POST',
      body: JSON.stringify(log),
    });
  },
  async sendOrderEmail(payload: any): Promise<any> {
    return request<any>('/send-order-email', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
