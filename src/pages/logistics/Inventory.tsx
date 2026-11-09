import React, { useState, useEffect } from 'react';
import { Plus, Edit2, AlertCircle, ShieldAlert, Package, Archive, ArchiveRestore, FileSpreadsheet, FileMinus, Check, RotateCcw } from 'lucide-react';
import { api } from '../../lib/api';
import { Product, Category, Supplier, Area } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import CSVImportModal from '../../components/CSVImportModal';

export default function Inventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCSVModal, setShowCSVModal] = useState(false);
  
  // Pulling product states
  const [pullConfirmId, setPullConfirmId] = useState<string | null>(null);
  const [pullSuccessMsg, setPullSuccessMsg] = useState<string | null>(null);

  // Filters
  const [filterSupplier, setFilterSupplier] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterFormStatus, setFilterFormStatus] = useState<'all' | 'assigned' | 'pulled'>('all');
  const [filterLowStock, setFilterLowStock] = useState<boolean>(false);
  const [filterAdr, setFilterAdr] = useState<boolean>(false);

  // Product Form State
  const defaultProduct = {
    name: '', cNumber: '', categoryId: '', packSize: '', consumedPerUnit: '', binLocation: '', imageUrl: '', isArchived: false, purchaseRate: 0, unitsPerPurchase: 1, sku: '', stockLevel: 0, minStockThreshold: 10, maxStockThreshold: 100, unitCost: 0, supplierId: '', isAdr: false, adrScore: 0, allowedAreaIds: [], areaConfigs: {}
  };
  const [formData, setFormData] = useState<Partial<Product>>(defaultProduct);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [prods, cats, sups, ars] = await Promise.all([
        api.getProducts(),
        api.getCategories(),
        api.getSuppliers(),
        api.getAreas()
      ]);
      setProducts(prods);
      setCategories(cats);
      setSuppliers(sups);
      setAreas(ars);
    } catch (err) {
      console.error("Failed to fetch inventory data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const scaleSize = MAX_WIDTH / img.width;
        if (scaleSize < 1) {
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
        } else {
          canvas.width = img.width;
          canvas.height = img.height;
        }
        
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setFormData(prev => ({ ...prev, imageUrl: dataUrl }));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.updateProduct(editingId, formData);
      } else {
        await api.createProduct(formData);
      }
      setIsAdding(false);
      setEditingId(null);
      setFormData(defaultProduct);
      fetchData();
    } catch (err) {
      console.error("Failed to save product:", err);
    }
  };

  const handleEditClick = (product: Product) => {
    setFormData(product);
    setEditingId(product.id);
    setIsAdding(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStockUpdate = async (id: string, newStock: number) => {
    try {
      await api.updateProduct(id, { stockLevel: newStock });
      fetchData();
    } catch (err) {
      console.error("Failed to update stock:", err);
    }
  };

  const handleArchiveToggle = async (id: string, currentArchived: boolean) => {
    try {
      await api.updateProduct(id, { isArchived: !currentArchived });
      fetchData();
    } catch (err) {
      console.error("Failed to toggle archive:", err);
    }
  };

  // Pull Product: removes product from all area forms in a single operation
  const handlePullProduct = async (productId: string, productName: string) => {
    try {
      await api.updateProduct(productId, {
        allowedAreaIds: [],
        areaConfigs: {}
      });
      setPullConfirmId(null);
      setPullSuccessMsg(`"${productName}" has been pulled from all area forms.`);
      setTimeout(() => setPullSuccessMsg(null), 4500);
      fetchData();
    } catch (err) {
      console.error("Failed to pull product from area forms", err);
    }
  };

  // Unpull Product: restores product access to area forms
  const handleUnpullProduct = async (productId: string, productName: string) => {
    try {
      const areaIds = areas.length > 0 ? areas.map(a => a.id) : ['area_1'];
      const defaultConfig: Record<string, { maxOrderQuantity: number }> = {};
      areaIds.forEach(id => {
        defaultConfig[id] = { maxOrderQuantity: 10 };
      });

      await api.updateProduct(productId, {
        allowedAreaIds: areaIds,
        areaConfigs: defaultConfig
      });
      setPullSuccessMsg(`"${productName}" has been unpulled and restored to area forms.`);
      setTimeout(() => setPullSuccessMsg(null), 4500);
      fetchData();
    } catch (err) {
      console.error("Failed to unpull product", err);
      alert("Failed to restore product to area forms.");
    }
  };


  // Helper to get total unique assigned area IDs from allowedAreaIds and areaConfigs keys
  const getAssignedAreaIds = (p: Partial<Product>): string[] => {
    const allowed = p.allowedAreaIds || [];
    const configKeys = Object.keys(p.areaConfigs || {});
    return Array.from(new Set([...allowed, ...configKeys]));
  };

  // Unpull All Products: batch restores all pulled products to area forms
  const handleUnpullAllProducts = async () => {
    const pulledProds = products.filter(p => getAssignedAreaIds(p).length === 0);
    if (pulledProds.length === 0) return;

    try {
      const areaIds = areas.length > 0 ? areas.map(a => a.id) : ['area_1'];
      const defaultConfig: Record<string, { maxOrderQuantity: number }> = {};
      areaIds.forEach(id => {
        defaultConfig[id] = { maxOrderQuantity: 10 };
      });

      const promises = pulledProds.map(p =>
        api.updateProduct(p.id, {
          allowedAreaIds: areaIds,
          areaConfigs: defaultConfig
        })
      );
      await Promise.all(promises);
      setPullSuccessMsg(`Successfully unpulled and restored ${pulledProds.length} product(s) to all area forms.`);
      setTimeout(() => setPullSuccessMsg(null), 4500);
      fetchData();
    } catch (err) {
      console.error("Failed to unpull all products", err);
      alert("Failed to restore products to area forms.");
    }
  };

  if (loading) return <div>Loading inventory...</div>;

  const filteredProducts = products.filter(p => {
    const matchesArchived = showArchived ? p.isArchived : !p.isArchived;
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = p.name.toLowerCase().includes(searchLower) || p.cNumber.toLowerCase().includes(searchLower);
    
    // Resolve supplier ID for filtering
    let resolvedSupplierId = p.supplierId;
    const directSup = suppliers.find(s => s.id === p.supplierId);
    if (directSup) {
      const linkedSup = suppliers.find(s => s.id === directSup.name);
      if (linkedSup) {
        resolvedSupplierId = linkedSup.id;
      }
    }
    const matchesSupplier = filterSupplier === 'all' || resolvedSupplierId === filterSupplier;

    // Resolve category ID for filtering
    let resolvedCategoryId = p.categoryId;
    const directCat = categories.find(c => c.id === p.categoryId);
    if (directCat) {
      const linkedCat = categories.find(c => c.id === directCat.name);
      if (linkedCat) {
        resolvedCategoryId = linkedCat.id;
      }
    }
    const matchesCategory = filterCategory === 'all' || resolvedCategoryId === filterCategory;
    const matchesLowStock = !filterLowStock || p.stockLevel <= p.minStockThreshold;
    const matchesAdr = !filterAdr || p.isAdr;

    const assignedCount = getAssignedAreaIds(p).length;
    const matchesFormStatus = 
      filterFormStatus === 'all' ? true :
      filterFormStatus === 'assigned' ? assignedCount > 0 :
      assignedCount === 0;

    return matchesArchived && matchesSearch && matchesSupplier && matchesCategory && matchesLowStock && matchesAdr && matchesFormStatus;
  });

  const lowStockProducts = filteredProducts.filter(p => p.stockLevel <= p.minStockThreshold && !p.isArchived);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Master Inventory</h1>
            <p className="text-slate-500 mt-1">Manage stock levels, product catalogue, and area form assignments</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <Input 
              placeholder="Search by name or C-Number..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-64"
            />
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button variant="outline" onClick={() => setShowArchived(!showArchived)} className="gap-2 flex-1 sm:flex-none">
                {showArchived ? <Package className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                {showArchived ? "Show Active" : "Show Archived"}
              </Button>
              <Button variant="outline" onClick={() => setShowCSVModal(true)} className="gap-2 flex-1 sm:flex-none border-emerald-250 hover:bg-emerald-50 text-emerald-700 font-medium">
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Import CSV
              </Button>
              <Button onClick={() => {
                setIsAdding(!isAdding);
                if (!isAdding) {
                  setEditingId(null);
                  setFormData(defaultProduct);
                }
              }} className="gap-2 flex-1 sm:flex-none">
                <Plus className="h-4 w-4" /> Add Product
              </Button>
            </div>
          </div>
        </div>

        {/* Success Toast */}
        {pullSuccessMsg && (
          <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg p-3.5 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
              <span>{pullSuccessMsg}</span>
            </div>
            <button onClick={() => setPullSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900 text-xs font-bold underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Banner for Pulled Products */}
        {(() => {
          const totalPulledCount = products.filter(p => getAssignedAreaIds(p).length === 0 && !p.isArchived).length;
          if (totalPulledCount === 0) return null;
          return (
            <div className="bg-amber-50/90 border border-amber-200 rounded-lg p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-2.5">
                <FileMinus className="h-5 w-5 text-amber-600 flex-shrink-0" />
                <div>
                  <span className="font-semibold text-slate-900 text-sm">{totalPulledCount} product(s) are currently pulled from area forms.</span>
                  <p className="text-xs text-slate-600">Unpulling will restore access so these products appear on area order forms again.</p>
                </div>
              </div>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1.5 flex-shrink-0"
                onClick={handleUnpullAllProducts}
              >
                <RotateCcw className="h-4 w-4" />
                Unpull All ({totalPulledCount})
              </Button>
            </div>
          );
        })()}

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">Category:</span>
            <select 
              className="h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="all">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">Supplier:</span>
            <select 
              className="h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
              value={filterSupplier}
              onChange={(e) => setFilterSupplier(e.target.value)}
            >
              <option value="all">All Suppliers</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">Area Forms:</span>
            <select 
              className="h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
              value={filterFormStatus}
              onChange={(e) => setFilterFormStatus(e.target.value as any)}
            >
              <option value="all">All Items</option>
              <option value="assigned">On Area Forms</option>
              <option value="pulled">Pulled from Forms</option>
            </select>
          </div>
          <div className="flex items-center gap-2 sm:ml-auto">
            <Button 
              variant={filterLowStock ? "default" : "outline"} 
              size="sm" 
              onClick={() => setFilterLowStock(!filterLowStock)}
              className="h-9"
            >
              <AlertCircle className="h-4 w-4 mr-2" />
              Low Stock
            </Button>
            <Button 
              variant={filterAdr ? "destructive" : "outline"} 
              size="sm" 
              onClick={() => setFilterAdr(!filterAdr)}
              className="h-9"
            >
              <ShieldAlert className="h-4 w-4 mr-2" />
              ADR
            </Button>
          </div>
        </div>
      </div>

      {lowStockProducts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3 items-start">
          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-800">Low Stock Alerts</h3>
            <p className="text-sm text-amber-700 mt-1">
              {lowStockProducts.length} product(s) are at or below their minimum stock threshold.
            </p>
          </div>
        </div>
      )}

      {isAdding && (
        <Card className="border-slate-300 shadow-md">
          <CardHeader>
            <CardTitle>{editingId ? "Edit Consumable" : "Add New Consumable"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveProduct} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g., Heavy Duty Gloves" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">C-Number</label>
                <Input required value={formData.cNumber} onChange={e => setFormData({...formData, cNumber: e.target.value})} placeholder="C-12345" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <select 
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                  required 
                  value={formData.categoryId} 
                  onChange={e => setFormData({...formData, categoryId: e.target.value})}
                >
                  <option value="" disabled>Select category...</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">SKU (Optional)</label>
                <Input value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} placeholder="GLV-001" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Pack Size</label>
                <Input required value={formData.packSize} onChange={e => setFormData({...formData, packSize: e.target.value})} placeholder="e.g., 100 pack" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Consumed Per Unit</label>
                <Input required value={formData.consumedPerUnit} onChange={e => setFormData({...formData, consumedPerUnit: e.target.value})} placeholder="e.g., 2 per shift" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Bin Location</label>
                <Input required value={formData.binLocation} onChange={e => setFormData({...formData, binLocation: e.target.value})} placeholder="Aisle 4, Shelf 2" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Supplier</label>
                <select 
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                  required 
                  value={formData.supplierId || ''} 
                  onChange={e => setFormData({...formData, supplierId: e.target.value})}
                >
                  <option value="" disabled>Select supplier...</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-2 row-span-2">
                <label className="text-sm font-medium">Product Image</label>
                <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center">
                  <Input type="file" accept="image/*" onChange={handleImageUpload} className="mb-2" />
                  {formData.imageUrl && (
                    <img src={formData.imageUrl} alt="Preview" className="h-24 w-auto mx-auto object-contain rounded-md" />
                  )}
                  {!formData.imageUrl && (
                     <span className="text-xs text-slate-400">Upload an image file (PNG, JPG)</span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Purchase Rate (£)</label>
                <Input type="number" step="0.01" required value={Number.isNaN(formData.purchaseRate) ? '' : (formData.purchaseRate ?? '')} onChange={e => setFormData({...formData, purchaseRate: parseFloat(e.target.value)})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Units per Purchase</label>
                <Input type="number" required value={Number.isNaN(formData.unitsPerPurchase) ? '' : (formData.unitsPerPurchase ?? '')} onChange={e => setFormData({...formData, unitsPerPurchase: parseInt(e.target.value)})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Cost Per Item (£)</label>
                <Input type="number" step="0.01" required value={Number.isNaN(formData.unitCost) ? '' : (formData.unitCost ?? '')} onChange={e => setFormData({...formData, unitCost: parseFloat(e.target.value)})} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Initial Qty on Hand</label>
                <Input type="number" required value={Number.isNaN(formData.stockLevel) ? '' : (formData.stockLevel ?? '')} onChange={e => setFormData({...formData, stockLevel: parseInt(e.target.value)})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Min Threshold</label>
                <Input type="number" required value={Number.isNaN(formData.minStockThreshold) ? '' : (formData.minStockThreshold ?? '')} onChange={e => setFormData({...formData, minStockThreshold: parseInt(e.target.value)})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Max Threshold</label>
                <Input type="number" required value={Number.isNaN(formData.maxStockThreshold) ? '' : (formData.maxStockThreshold ?? '')} onChange={e => setFormData({...formData, maxStockThreshold: parseInt(e.target.value)})} />
              </div>

              <div className="space-y-2 flex items-center justify-between col-span-1 md:col-span-2 lg:col-span-3 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="isAdr" checked={formData.isAdr} onChange={e => setFormData({...formData, isAdr: e.target.checked})} className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-950" />
                  <label htmlFor="isAdr" className="text-sm font-medium flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-red-500" />
                    ADR (Dangerous Goods) Item
                  </label>
                </div>
                {formData.isAdr && (
                  <div className="flex items-center gap-2">
                     <label className="text-sm font-medium text-slate-500">ADR Score per unit:</label>
                     <Input type="number" className="w-24" required value={Number.isNaN(formData.adrScore) ? '' : (formData.adrScore ?? '')} onChange={e => setFormData({...formData, adrScore: parseInt(e.target.value)})} />
                  </div>
                )}
              </div>

              {/* In Edit Form: Quick Option to Pull Product from all forms */}
              {editingId && (formData.allowedAreaIds || []).length > 0 && (
                <div className="col-span-1 md:col-span-2 lg:col-span-3 bg-amber-50/70 border border-amber-200/80 p-3 rounded-lg flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                    <FileMinus className="h-4 w-4 text-amber-600" />
                    This product is assigned to {(formData.allowedAreaIds || []).length} area form(s).
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs font-semibold text-amber-800 border-amber-300 bg-white hover:bg-amber-100"
                    onClick={() => setFormData({ ...formData, allowedAreaIds: [], areaConfigs: {} })}
                  >
                    Clear Form Assignments
                  </Button>
                </div>
              )}

              <div className="col-span-1 md:col-span-2 lg:col-span-3 flex justify-end gap-2 mt-4">
                <Button variant="outline" type="button" onClick={() => {
                  setIsAdding(false);
                  setEditingId(null);
                  setFormData(defaultProduct);
                }}>Cancel</Button>
                <Button type="submit">Save Product</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.map(product => {
          const directSupplier = suppliers.find(s => s.id === product.supplierId);
          let supplierName = '-';
          if (directSupplier) {
            const linkedSupplier = suppliers.find(s => s.id === directSupplier.name);
            supplierName = linkedSupplier ? linkedSupplier.name : directSupplier.name;
          } else if (product.supplier) {
            const linkedSupplier = suppliers.find(s => s.id === product.supplier);
            supplierName = linkedSupplier ? linkedSupplier.name : product.supplier;
          }

          const assignedAreasCount = getAssignedAreaIds(product).length;
          
          return (
            <Card key={product.id} className={product.stockLevel <= product.minStockThreshold && !product.isArchived ? "border-amber-200 bg-amber-50/30" : ""}>
              {product.imageUrl && (
                <div className="w-full h-40 bg-slate-100 rounded-t-xl overflow-hidden border-b border-slate-200">
                  <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                </div>
              )}
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <CardTitle className="text-lg">{product.name}</CardTitle>
                    <p className="text-xs text-slate-500 font-mono mt-1">{product.sku ? `${product.sku} • ` : ''}{product.cNumber}</p>
                  </div>
                  <div className="flex gap-1.5 flex-wrap justify-end">
                    {assignedAreasCount > 0 ? (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[11px] font-semibold">
                        {assignedAreasCount} Area Form{assignedAreasCount > 1 ? 's' : ''}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[11px] font-medium">
                        Pulled
                      </Badge>
                    )}
                    {product.isAdr && <Badge variant="destructive" className="gap-1"><ShieldAlert className="h-3 w-3" /> ADR</Badge>}
                    {product.isArchived && <Badge variant="secondary">Archived</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                  <div>
                    <p className="text-slate-500 text-xs">Bin Location</p>
                    <p className="font-medium">{product.binLocation || '-'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Supplier</p>
                    <p className="font-medium truncate" title={supplierName}>{supplierName}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Category</p>
                    <p className="font-medium truncate">
                      {(() => {
                        const directCategory = categories.find(c => c.id === product.categoryId);
                        if (directCategory) {
                          const linkedCategory = categories.find(c => c.id === directCategory.name);
                          return linkedCategory ? linkedCategory.name : directCategory.name;
                        }
                        return '-';
                      })()}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Pack Size</p>
                    <p className="font-medium">{product.packSize || '-'}</p>
                  </div>
                </div>

                <div className="flex justify-between items-end border-t border-slate-100 pt-4">
                  <div className="space-y-1">
                    <p className="text-sm text-slate-500">Stock Level</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-2xl font-bold ${(product.stockLevel <= product.minStockThreshold && !product.isArchived) ? 'text-amber-600' : 'text-slate-900'}`}>
                        {product.stockLevel}
                      </span>
                      <span className="text-xs text-slate-400">/ min {product.minStockThreshold}</span>
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-sm text-slate-500">Cost</p>
                    <p className="font-medium">£{product.unitCost?.toFixed(2)}</p>
                  </div>
                </div>
                
                <div className="mt-6 pt-4 border-t space-y-2">
                  {pullConfirmId === product.id ? (
                    <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-lg flex items-center justify-between gap-2 animate-fade-in">
                      <span className="text-xs font-semibold text-amber-900">
                        Pull from all {assignedAreasCount} area form(s)?
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 text-xs px-2 py-0 font-bold"
                          onClick={() => handlePullProduct(product.id, product.name)}
                        >
                          Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-2 py-0"
                          onClick={() => setPullConfirmId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex gap-1.5 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditClick(product)}
                        >
                          <Edit2 className="h-4 w-4 mr-1.5" /> Edit
                        </Button>

                        {assignedAreasCount > 0 ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-amber-700 border-amber-200 hover:bg-amber-50 hover:text-amber-800 font-semibold"
                            onClick={() => setPullConfirmId(product.id)}
                            title="Remove product from all area order forms"
                          >
                            <FileMinus className="h-4 w-4 mr-1 text-amber-600" />
                            Pull Product
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-emerald-700 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 font-semibold"
                            onClick={() => handleUnpullProduct(product.id, product.name)}
                            title="Restore product access to area order forms"
                          >
                            <RotateCcw className="h-4 w-4 mr-1 text-emerald-600" />
                            Unpull
                          </Button>
                        )}

                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className={product.isArchived ? "text-blue-600 hover:bg-blue-50" : "text-slate-500"} 
                          onClick={() => handleArchiveToggle(product.id, product.isArchived)}
                        >
                          {product.isArchived ? <ArchiveRestore className="h-4 w-4 mr-1" /> : <Archive className="h-4 w-4 mr-1" />}
                          {product.isArchived ? "Reinstate" : "Archive"}
                        </Button>
                      </div>

                      {!product.isArchived && (
                        <div className="flex items-center gap-1">
                          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => handleStockUpdate(product.id, Math.max(0, product.stockLevel - 1))}>-</Button>
                          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => handleStockUpdate(product.id, product.stockLevel + 1)}>+</Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      {filteredProducts.length === 0 && !isAdding && (
        <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
          <Package className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-900">No products found</h3>
          <p className="text-slate-500 mt-1">{showArchived ? "No archived products." : "Add your first product to build the catalogue."}</p>
        </div>
      )}
      
      {showCSVModal && (
        <CSVImportModal 
          onClose={() => setShowCSVModal(false)}
          onImportComplete={() => {
            setShowCSVModal(false);
            fetchData();
          }}
          existingProducts={products}
          existingCategories={categories}
          existingSuppliers={suppliers}
        />
      )}
    </div>
  );
}

