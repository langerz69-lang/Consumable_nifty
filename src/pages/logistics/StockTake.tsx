import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Product } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { 
  ClipboardCheck, 
  Search, 
  RotateCcw, 
  Layers, 
  MapPin, 
  CheckCircle2, 
  AlertCircle, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Plus, 
  HelpCircle,
  FileCheck,
  ShieldAlert
} from 'lucide-react';

export default function StockTake() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Filtering & Selection
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Physical counted levels state (productId -> countedQty)
  const [countedQuantities, setCountedQuantities] = useState<Record<string, number>>({});
  
  // Blanket figure tools
  const [blanketValue, setBlanketValue] = useState<string>('');
  const [blanketMode, setBlanketMode] = useState<'add' | 'set'>('add');
  const [blanketTarget, setBlanketTarget] = useState<'filtered' | 'all'>('filtered');
  const [showBlanketConfirm, setShowBlanketConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  
  // Operation Status
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch products from database
  const fetchProducts = async () => {
    setLoading(true);
    try {
      const prods = await api.getProducts();
      const activeProds = prods.filter(p => !p.isArchived);
      
      setProducts(activeProds);
      
      // Initialize counted quantities with current stock values
      const initialCounts: Record<string, number> = {};
      activeProds.forEach(p => {
        initialCounts[p.id] = p.stockLevel;
      });
      setCountedQuantities(initialCounts);
    } catch (err) {
      console.error('Failed to load products for stock take:', err);
      setErrorMsg('Error fetching inventory items. Please reload.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Extract unique sorted bin locations
  const locations = React.useMemo(() => {
    const locSet = new Set<string>();
    products.forEach(p => {
      const loc = (p.binLocation || '').trim();
      if (loc) locSet.add(loc);
    });
    return Array.from(locSet).sort();
  }, [products]);

  // Filter products based on selected location & search query
  const filteredProducts = React.useMemo(() => {
    return products.filter(p => {
      const bin = (p.binLocation || '').trim();
      const matchesLocation = 
        selectedLocation === 'all' ||
        (selectedLocation === 'empty' && !bin) ||
        bin.toLowerCase() === selectedLocation.toLowerCase();

      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        !searchQuery ||
        p.name.toLowerCase().includes(searchLower) ||
        (p.cNumber || '').toLowerCase().includes(searchLower) ||
        (p.sku || '').toLowerCase().includes(searchLower);

      return matchesLocation && matchesSearch;
    });
  }, [products, selectedLocation, searchQuery]);

  // Adjust count for a specific product
  const handleCountChange = (productId: string, val: number) => {
    setCountedQuantities(prev => ({
      ...prev,
      [productId]: Number.isNaN(val) ? 0 : val
    }));
  };

  const handleIncrement = (productId: string) => {
    setCountedQuantities(prev => ({
      ...prev,
      [productId]: (prev[productId] || 0) + 1
    }));
  };

  const handleDecrement = (productId: string) => {
    setCountedQuantities(prev => ({
      ...prev,
      [productId]: Math.max(0, (prev[productId] || 0) - 1)
    }));
  };

  // Reset current physical counted state back to database expected levels
  const handleResetCounts = () => {
    const initialCounts: Record<string, number> = {};
    products.forEach(p => {
      initialCounts[p.id] = p.stockLevel;
    });
    setCountedQuantities(initialCounts);
    setSuccessMsg('Count values reset to current database levels.');
    setShowResetConfirm(false);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // Set physical counts directly back to database
  const handleSaveStockTake = async () => {
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const updatePromises: Promise<any>[] = [];
      let updatedCount = 0;

      filteredProducts.forEach(p => {
        const counted = countedQuantities[p.id];
        if (counted !== undefined && counted !== p.stockLevel) {
          updatePromises.push(api.updateProduct(p.id, { stockLevel: counted }));
          updatedCount++;
        }
      });

      if (updatedCount === 0) {
        setSuccessMsg('No stock adjustments detected. Everything matches expectation!');
        setSaving(false);
        return;
      }

      await Promise.all(updatePromises);
      setSuccessMsg(`Successfully completed stock take! Adjusted stock figures for ${updatedCount} products.`);
      
      // Reload matching products from server to align base stock figures
      await fetchProducts();
    } catch (err) {
      console.error('Failed to commit stock take updates:', err);
      setErrorMsg('Could not write updates. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Apply Blanket figure to filtered products or all products
  const applyBlanketAdjustment = () => {
    const numValue = parseInt(blanketValue);
    if (Number.isNaN(numValue)) {
      setErrorMsg('Please enter a valid numeric blanket value.');
      return;
    }

    const targetList = blanketTarget === 'filtered' ? filteredProducts : products;
    if (targetList.length === 0) {
      setErrorMsg('No products found to apply this blanket adjustment to.');
      return;
    }

    setCountedQuantities(prev => {
      const updated = { ...prev };
      targetList.forEach(p => {
        if (blanketMode === 'add') {
          updated[p.id] = p.stockLevel + numValue;
        } else {
          updated[p.id] = Math.max(0, numValue);
        }
      });
      return updated;
    });

    setSuccessMsg(`Applied blanket figure to ${targetList.length} items. Don't forget to submit updates!`);
    setBlanketValue('');
    setShowBlanketConfirm(false);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-6">
      
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-600 rounded-full text-xs font-semibold mb-2">
            <ClipboardCheck className="h-3.5 w-3.5 text-blue-600" /> Physical Inventory Audit
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Inventory Stock Take</h1>
          <p className="text-sm text-slate-500 mt-1">
            Perform scheduled stock audits, adjust item levels by bin location, or apply blanket volume values.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {showResetConfirm ? (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 p-1.5 rounded-lg">
              <span className="text-[11px] text-amber-850 font-bold">Discard draft counts?</span>
              <Button
                variant="outline"
                onClick={handleResetCounts}
                disabled={saving || loading}
                className="text-[10px] h-7 px-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold border-none"
              >
                Yes, Discard
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowResetConfirm(false)}
                disabled={saving || loading}
                className="text-[10px] h-7 px-2.5"
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button 
              variant="outline" 
              onClick={() => setShowResetConfirm(true)}
              disabled={saving || loading}
              className="text-xs flex items-center gap-1.5 h-9"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Discard Counts
            </Button>
          )}
          <Button 
            onClick={handleSaveStockTake}
            disabled={saving || loading}
            className="text-xs bg-slate-900 hover:bg-slate-800 flex items-center gap-1.5 h-9"
          >
            <FileCheck className="h-3.5 w-3.5" /> {saving ? 'Submitting...' : 'Submit Stock Take'}
          </Button>
        </div>
      </div>

      {/* Operation Feedback */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm font-semibold flex items-center gap-2.5">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl text-sm font-semibold flex items-center gap-2.5">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Controls Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Selection & Filters panel */}
        <Card className="border-slate-200 lg:col-span-1 shadow-sm">
          <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-xs uppercase tracking-wider font-bold text-slate-600 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-slate-400" /> Scope Selection
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            
            {/* Filter by Location */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Target Warehouse Location</label>
              <select
                className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400"
                value={selectedLocation}
                onChange={e => setSelectedLocation(e.target.value)}
              >
                <option value="all">All Bin Locations</option>
                <option value="empty">No Location Assigned (Empty)</option>
                {locations.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400 leading-normal">
                Filtering by location helps you audit specific aisle racks or bins systematically.
              </p>
            </div>

            {/* Quick Search */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Filter Consumables</label>
              <div className="relative">
                <Input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by name, code..."
                  className="pl-8 text-xs h-9"
                />
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Matching Consumables:</span>
              <span className="font-bold text-slate-800">{filteredProducts.length} items</span>
            </div>

          </CardContent>
        </Card>

        {/* Blanket Adjustment Tool panel */}
        <Card className="border-slate-200 lg:col-span-2 shadow-sm">
          <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-xs uppercase tracking-wider font-bold text-slate-600 flex items-center gap-2">
              <Layers className="h-4 w-4 text-slate-400" /> Bulk Blanket Adjustment Tool
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <p className="text-xs text-slate-500 leading-relaxed">
              Quickly apply stock adjustments across multiple items. Use this to seed bulk items, add standard shipping boxes, or override figures simultaneously.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {/* Scope Target */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase">Apply Scope</label>
                <select
                  value={blanketTarget}
                  onChange={e => setBlanketTarget(e.target.value as any)}
                  className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 h-9"
                >
                  <option value="filtered">Filtered List ({filteredProducts.length} items)</option>
                  <option value="all">Full Warehouse ({products.length} items)</option>
                </select>
              </div>

              {/* Adjustment Mode */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase">Action Mode</label>
                <select
                  value={blanketMode}
                  onChange={e => setBlanketMode(e.target.value as any)}
                  className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 h-9"
                >
                  <option value="add">Add to current stock (+ / -)</option>
                  <option value="set">Set to exact stock level</option>
                </select>
              </div>

              {/* Blanket Value */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase">Blanket Qty</label>
                <Input
                  type="number"
                  value={blanketValue}
                  onChange={e => setBlanketValue(e.target.value)}
                  placeholder="e.g. 50 or -10"
                  className="text-xs h-9"
                />
              </div>

              {/* Submit Trigger */}
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowBlanketConfirm(true)}
                  disabled={!blanketValue || loading}
                  className="w-full text-xs font-semibold h-9 border-slate-300 hover:bg-slate-50 text-slate-700"
                >
                  Apply Blanket Adjust
                </Button>
              </div>
            </div>

            {/* Blanket Adjustment Safety Warning Dialog */}
            {showBlanketConfirm && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg space-y-2 text-xs">
                <div className="flex items-center gap-2 text-amber-800 font-bold">
                  <ShieldAlert className="h-4 w-4" /> Confirm Blanket Override
                </div>
                <p className="text-amber-700 leading-normal">
                  You are about to {blanketMode === 'add' ? 'add' : 'set'} a blanket amount of <strong className="underline">{blanketValue}</strong> to{' '}
                  <strong>{blanketTarget === 'filtered' ? `${filteredProducts.length} filtered` : `${products.length} total`}</strong> items. 
                  This will override current counts in memory.
                </p>
                <div className="flex justify-end gap-2 pt-1">
                  <button 
                    onClick={() => setShowBlanketConfirm(false)}
                    className="px-2.5 py-1 text-[11px] font-bold text-slate-500 hover:text-slate-800"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={applyBlanketAdjustment}
                    className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] rounded transition-all"
                  >
                    Yes, Apply to memory
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Main Stock Take Sheet */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-sm font-bold text-slate-800">Physical Stock Count Sheet</CardTitle>
            <p className="text-xs text-slate-500 mt-1">Adjust counted figures for each item below. Discrepancies are highlighted in real-time.</p>
          </div>
          <Badge variant="outline" className="text-xs px-2.5 py-1 text-slate-600 self-start sm:self-center">
            Auditing {filteredProducts.length} items
          </Badge>
        </CardHeader>

        <CardContent className="p-0 overflow-hidden">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              <ClipboardCheck className="h-8 w-8 animate-pulse mx-auto mb-2 text-slate-300" />
              Loading inventory items...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              <HelpCircle className="h-8 w-8 mx-auto mb-2 text-slate-300" />
              No matching active items found for the current location or query.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-semibold text-[10px] uppercase tracking-wider border-b border-slate-100">
                    <th className="py-3 px-4">Item Details</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4 text-center">Expected Stock</th>
                    <th className="py-3 px-4 text-center w-48">Counted (Physical)</th>
                    <th className="py-3 px-4 text-right">Discrepancy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {filteredProducts.map((p) => {
                    const counted = countedQuantities[p.id] ?? p.stockLevel;
                    const diff = counted - p.stockLevel;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                        
                        {/* Item Details */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            {p.imageUrl ? (
                              <img 
                                src={p.imageUrl} 
                                alt={p.name} 
                                className="h-9 w-9 rounded object-cover border border-slate-100"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="h-9 w-9 rounded bg-slate-100 text-slate-300 flex items-center justify-center">
                                <Layers className="h-4 w-4" />
                              </div>
                            )}
                            <div>
                              <p className="font-bold text-slate-800 leading-snug">{p.name}</p>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400 font-medium">
                                <span>C-No: {p.cNumber || 'N/A'}</span>
                                {p.sku && <span>• SKU: {p.sku}</span>}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Location */}
                        <td className="py-3 px-4 font-semibold text-slate-600">
                          {p.binLocation ? (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-slate-400" />
                              {p.binLocation}
                            </span>
                          ) : (
                            <span className="text-slate-350 italic">Unassigned</span>
                          )}
                        </td>

                        {/* Expected Stock */}
                        <td className="py-3 px-4 text-center font-semibold text-slate-500">
                          {p.stockLevel}
                        </td>

                        {/* Counted Physical */}
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleDecrement(p.id)}
                              className="h-7 w-7 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <Input
                              type="number"
                              value={counted}
                              onChange={e => handleCountChange(p.id, parseInt(e.target.value))}
                              className="w-16 h-7 text-center text-xs font-bold"
                            />
                            <button
                              type="button"
                              onClick={() => handleIncrement(p.id)}
                              className="h-7 w-7 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-all"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>

                        {/* Discrepancy Indicator */}
                        <td className="py-3 px-4 text-right font-bold">
                          {diff === 0 ? (
                            <span className="text-slate-400 text-[11px] font-semibold">Balanced</span>
                          ) : diff > 0 ? (
                            <span className="text-emerald-600 inline-flex items-center gap-0.5 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded text-[11px]">
                              <TrendingUp className="h-3 w-3" /> +{diff}
                            </span>
                          ) : (
                            <span className="text-rose-600 inline-flex items-center gap-0.5 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded text-[11px]">
                              <TrendingDown className="h-3 w-3" /> {diff}
                            </span>
                          )}
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
