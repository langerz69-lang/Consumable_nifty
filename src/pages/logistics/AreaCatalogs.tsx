import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../lib/api';
import { Area, Product, Category } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Search, Save, Check, Upload, Filter, ArrowUpDown } from 'lucide-react';
import AreaCSVImportModal from '../../components/AreaCSVImportModal';

export default function AreaCatalogs() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Record<string, Category>>({});
  
  const [selectedAreaId, setSelectedAreaId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterInclusion, setFilterInclusion] = useState<'all' | 'included' | 'excluded'>('all');
  const [loading, setLoading] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  
  // Local state for edits before saving
  const [editedConfigs, setEditedConfigs] = useState<Record<string, { maxOrderQuantity: number }>>({});
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ars, prods, cats] = await Promise.all([
        api.getAreas(),
        api.getProducts(),
        api.getCategories()
      ]);

      ars.sort((a, b) => a.name.localeCompare(b.name));
      setAreas(ars);
      setProducts(prods);

      const catMap: Record<string, Category> = {};
      cats.forEach(cat => {
        catMap[cat.id] = cat;
      });
      setCategories(catMap);

      if (ars.length > 0 && !selectedAreaId) {
        setSelectedAreaId(ars[0].id);
      }
    } catch (err) {
      console.error("Failed to load catalog data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    // Reset edits when selected area changes
    const configs: Record<string, { maxOrderQuantity: number }> = {};
    if (selectedAreaId) {
      products.forEach(p => {
        if (p.areaConfigs?.[selectedAreaId]) {
          configs[p.id] = { ...p.areaConfigs[selectedAreaId] };
        }
      });
    }
    setEditedConfigs(configs);
    setSaveSuccess(false);
  }, [selectedAreaId, products]);

  const handleToggleProduct = (productId: string) => {
    setEditedConfigs(prev => {
      const next = { ...prev };
      if (next[productId]) {
        delete next[productId];
      } else {
        next[productId] = { maxOrderQuantity: 10 }; // Default max
      }
      return next;
    });
    setSaveSuccess(false);
  };

  const handleQuantityChange = (productId: string, value: string) => {
    const num = parseInt(value) || 0;
    setEditedConfigs(prev => ({
      ...prev,
      [productId]: { maxOrderQuantity: Math.max(1, num) }
    }));
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    if (!selectedAreaId) return;
    setSaving(true);
    
    try {
      const updatePromises = products.map(product => {
        const oldConfig = product.areaConfigs?.[selectedAreaId];
        const newConfig = editedConfigs[product.id];
        const isAllowed = (product.allowedAreaIds || []).includes(selectedAreaId);
        
        // If nothing changed for this area, and no inconsistency in allowedAreaIds, skip
        if (!oldConfig && !newConfig && !isAllowed) return null;
        if (oldConfig && newConfig && oldConfig.maxOrderQuantity === newConfig.maxOrderQuantity && isAllowed) return null;

        // Needs update
        const updatedAreaConfigs = { ...(product.areaConfigs || {}) };

        if (newConfig) {
          updatedAreaConfigs[selectedAreaId] = newConfig;
        } else {
          delete updatedAreaConfigs[selectedAreaId];
        }

        const finalAllowedAreas = Array.from(new Set(Object.keys(updatedAreaConfigs)));

        return api.updateProduct(product.id, {
          areaConfigs: updatedAreaConfigs,
          allowedAreaIds: finalAllowedAreas
        });
      });

      await Promise.all(updatePromises.filter(p => p !== null));
      
      // Update local products state to match
      setProducts(prev => prev.map(p => {
        const newConfig = editedConfigs[p.id];
        const updatedAreaConfigs = { ...(p.areaConfigs || {}) };
        
        if (newConfig) {
          updatedAreaConfigs[selectedAreaId] = newConfig;
        } else {
          delete updatedAreaConfigs[selectedAreaId];
        }
        
        const finalAllowedAreas = Array.from(new Set(Object.keys(updatedAreaConfigs)));
        
        return { ...p, areaConfigs: updatedAreaConfigs, allowedAreaIds: finalAllowedAreas };
      }));

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to save area configs", err);
      alert("Failed to save changes.");
    }
    
    setSaving(false);
  };

  // Filter and sort products by C-Number in true numerical order
  const filteredProducts = useMemo(() => {
    const searchLower = searchQuery.toLowerCase();

    const list = products.filter(p => {
      if (p.isArchived) return false;

      const matchesSearch = p.name.toLowerCase().includes(searchLower) || (p.cNumber || '').toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;

      const isIncluded = !!editedConfigs[p.id];
      if (filterInclusion === 'included' && !isIncluded) return false;
      if (filterInclusion === 'excluded' && isIncluded) return false;

      return true;
    });

    // Sort numerically by C-Number (e.g. C-2 before C-10 before C-100)
    list.sort((a, b) => {
      const cA = a.cNumber || '';
      const cB = b.cNumber || '';

      const numA = parseInt(cA.replace(/\D/g, ''), 10);
      const numB = parseInt(cB.replace(/\D/g, ''), 10);

      if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
        return numA - numB;
      }
      return cA.localeCompare(cB, undefined, { numeric: true, sensitivity: 'base' });
    });

    return list;
  }, [products, searchQuery, filterInclusion, editedConfigs]);

  if (loading) return <div className="flex justify-center p-12 text-slate-500">Loading area catalogues...</div>;

  const totalActiveCount = products.filter(p => !p.isArchived).length;
  const totalIncludedCount = Object.keys(editedConfigs).length;
  const totalExcludedCount = totalActiveCount - totalIncludedCount;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Area Order Forms</h1>
          <p className="text-slate-500 text-sm mt-1">Configure which products each area can order and set their maximum limits.</p>
        </div>
        
        <div className="flex items-center gap-2">
          {saveSuccess && (
            <span className="text-sm text-green-700 flex items-center gap-1.5 font-bold bg-green-50 border border-green-200 px-3 py-2 rounded-lg shadow-sm">
              <Check className="h-4 w-4 text-green-600" /> Saved
            </span>
          )}
          <Button 
            variant="outline" 
            onClick={() => setShowImportModal(true)} 
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            Import Lists from CSV
          </Button>
          <Button onClick={handleSave} disabled={saving || !selectedAreaId} className="gap-2 bg-slate-900 text-white hover:bg-slate-800">
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="bg-slate-50/80 border-b border-slate-100 pb-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Area Selection */}
            <div className="w-full md:w-1/3 space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Select Production Area
              </label>
              <select 
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
                value={selectedAreaId}
                onChange={(e) => setSelectedAreaId(e.target.value)}
              >
                <option value="" disabled>Select an area...</option>
                {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>

            {/* Inclusion Filter */}
            <div className="w-full md:w-1/3 space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-slate-400" />
                Filter Form Status
              </label>
              <select
                value={filterInclusion}
                onChange={(e) => setFilterInclusion(e.target.value as any)}
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
              >
                <option value="all">All Products ({totalActiveCount})</option>
                <option value="included">Included on Form ({totalIncludedCount})</option>
                <option value="excluded">Excluded from Form ({totalExcludedCount})</option>
              </select>
            </div>
            
            {/* Search Products Input */}
            <div className="w-full md:w-1/3 space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Search Products
              </label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input 
                  className="pl-9 text-sm h-10 bg-white" 
                  placeholder="Search name or C-Number..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          {!selectedAreaId ? (
            <div className="p-12 text-center text-slate-500 font-medium">
              Please select a production area above to configure its order form.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 w-16 text-center">Include</th>
                    <th className="px-4 py-3">
                      <span className="flex items-center gap-1">
                        C-Number
                        <ArrowUpDown className="h-3.5 w-3.5 text-blue-600" />
                      </span>
                    </th>
                    <th className="px-4 py-3">Product Name</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3 w-48 text-right pr-6">Max Order Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredProducts.map(product => {
                    const isIncluded = !!editedConfigs[product.id];
                    return (
                      <tr key={product.id} className={`hover:bg-slate-50/80 transition-colors ${isIncluded ? 'bg-blue-50/30' : ''}`}>
                        <td className="px-4 py-3 text-center">
                          <input 
                            type="checkbox" 
                            className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-950 cursor-pointer"
                            checked={isIncluded}
                            onChange={() => handleToggleProduct(product.id)}
                          />
                        </td>
                        <td className="px-4 py-3 font-mono text-xs font-bold text-slate-700">
                          <span className="bg-slate-100 text-slate-800 px-2 py-1 rounded border border-slate-200/80">
                            {product.cNumber || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900 flex items-center gap-3">
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt="" className="h-8 w-8 rounded object-cover border border-slate-200 bg-white" />
                          ) : (
                            <div className="h-8 w-8 rounded bg-slate-100 border border-slate-200"></div>
                          )}
                          {product.name}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {categories[product.categoryId]?.name || 'Unknown'}
                        </td>
                        <td className="px-4 py-3 text-right pr-6">
                          <Input 
                            type="number" 
                            min="1"
                            disabled={!isIncluded}
                            value={editedConfigs[product.id]?.maxOrderQuantity || ''}
                            onChange={(e) => handleQuantityChange(product.id, e.target.value)}
                            className={`h-8 w-24 ml-auto text-right font-bold ${!isIncluded ? 'opacity-40 bg-slate-100' : 'bg-white'}`}
                            placeholder="Max Qty"
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {filteredProducts.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-slate-400 font-medium">
                        No products found matching your current filter criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {showImportModal && (
        <AreaCSVImportModal
          onClose={() => setShowImportModal(false)}
          onImportComplete={() => {
            fetchData();
          }}
          existingProducts={products}
          existingAreas={areas}
        />
      )}
    </div>
  );
}
