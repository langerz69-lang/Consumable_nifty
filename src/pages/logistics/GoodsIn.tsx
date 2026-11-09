import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Product } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Search, Download, CheckCircle2, ArrowRight } from 'lucide-react';

export default function GoodsIn() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // List inline receiving state
  const [listQuantities, setListQuantities] = useState<Record<string, string>>({});
  const [receivingId, setReceivingId] = useState<string | null>(null);
  
  // Selection state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [receiveQuantity, setReceiveQuantity] = useState<string>('');
  const [receiving, setReceiving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchProducts = async () => {
    try {
      const prods = await api.getProducts();
      setProducts(prods);
    } catch (err) {
      console.error("Failed to fetch products:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleReceiveStock = async () => {
    if (!selectedProduct) return;
    
    const qty = parseInt(receiveQuantity, 10);
    if (isNaN(qty) || qty <= 0) {
      setErrorMsg("Please enter a valid positive quantity.");
      return;
    }

    setReceiving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const newStock = (selectedProduct.stockLevel || 0) + qty;
      await api.updateProduct(selectedProduct.id, {
        stockLevel: newStock
      });
      
      setSuccessMsg(`Successfully received ${qty} units of ${selectedProduct.name}.`);
      setReceiveQuantity('');
      setSelectedProduct(null);
      setSearchQuery('');
      
      // Refresh product list to show new stock level
      await fetchProducts();
      
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      console.error("Error receiving stock:", err);
      setErrorMsg(err.message || "Failed to receive stock. Please try again.");
    } finally {
      setReceiving(false);
    }
  };

  const handleInlineReceive = async (product: Product) => {
    const qtyStr = listQuantities[product.id];
    if (!qtyStr) return;
    
    const qty = parseInt(qtyStr, 10);
    if (isNaN(qty) || qty <= 0) {
      setErrorMsg("Please enter a valid positive quantity.");
      return;
    }

    setReceivingId(product.id);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const newStock = (product.stockLevel || 0) + qty;
      await api.updateProduct(product.id, {
        stockLevel: newStock
      });
      
      setSuccessMsg(`Successfully received ${qty} units of ${product.name}.`);
      setListQuantities(prev => ({ ...prev, [product.id]: '' }));
      
      // Refresh product list to show new stock level
      await fetchProducts();
      
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      console.error("Error receiving stock:", err);
      setErrorMsg(err.message || "Failed to receive stock. Please try again.");
    } finally {
      setReceivingId(null);
    }
  };

  if (loading) return <div>Loading...</div>;

  const searchLower = searchQuery.toLowerCase();
  const filteredProducts = searchQuery.length > 1 
    ? products.filter(p => 
        !p.isArchived &&
        (p.name.toLowerCase().includes(searchLower) || 
         p.cNumber.toLowerCase().includes(searchLower) ||
         (p.sku && p.sku.toLowerCase().includes(searchLower)))
      ).slice(0, 5) // Show top 5 matches
    : [];

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Goods In</h1>
        <p className="text-slate-500 mt-1">Receive new stock deliveries and update inventory levels.</p>
      </div>

      {successMsg && (
        <div className="bg-green-50 text-green-700 p-4 rounded-lg border border-green-200 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" />
          <p className="font-medium">{successMsg}</p>
        </div>
      )}
      
      {errorMsg && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200 flex items-center gap-2">
          <p className="font-medium">{errorMsg}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Search & Select Section */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
            <CardTitle className="text-lg">Find Product</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search by name, C-Number, or SKU..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (selectedProduct) setSelectedProduct(null);
                }}
                className="pl-10"
              />
            </div>
            
            {!selectedProduct && searchQuery.length > 1 && (
              <div className="space-y-2 mt-4">
                {filteredProducts.length > 0 ? (
                  filteredProducts.map(product => (
                    <button
                      key={product.id}
                      onClick={() => setSelectedProduct(product)}
                      className="w-full text-left p-3 rounded-md border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-colors flex items-center justify-between group"
                    >
                      <div>
                        <p className="font-medium text-slate-900">{product.name}</p>
                        <p className="text-xs text-slate-500">{product.sku ? `${product.sku} • ` : ''}{product.cNumber}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))
                ) : (
                  <div className="text-center p-4 text-sm text-slate-500 border border-dashed border-slate-200 rounded-md">
                    No products found matching "{searchQuery}"
                  </div>
                )}
              </div>
            )}
            
            {!selectedProduct && searchQuery.length <= 1 && (
              <div className="text-center p-8 text-sm text-slate-400 border border-dashed border-slate-200 rounded-md bg-slate-50/50">
                Type at least 2 characters to search for a product to receive.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Receive Action Section */}
        <Card className={`border-slate-200 shadow-sm transition-opacity duration-200 ${selectedProduct ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
          <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
            <CardTitle className="text-lg">Receive Details</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {selectedProduct ? (
              <div className="space-y-6">
                <div className="flex gap-4 items-start">
                  {selectedProduct.imageUrl ? (
                    <img src={selectedProduct.imageUrl} alt="" className="h-16 w-16 rounded object-cover border border-slate-200" />
                  ) : (
                    <div className="h-16 w-16 rounded bg-slate-100 border border-slate-200 flex items-center justify-center">
                      <Download className="h-6 w-6 text-slate-300" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-slate-900 text-lg">{selectedProduct.name}</h3>
                    <p className="text-sm text-slate-500 font-mono mt-1">{selectedProduct.sku ? `${selectedProduct.sku} • ` : ''}{selectedProduct.cNumber}</p>
                    <div className="flex items-center gap-2 mt-2 text-sm">
                      <span className="text-slate-500">Current Stock:</span>
                      <span className="font-bold text-slate-900">{selectedProduct.stockLevel}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <label className="text-sm font-medium text-slate-700">Quantity Received</label>
                  <div className="flex gap-3">
                    <Input 
                      type="number"
                      min="1"
                      placeholder="e.g. 50"
                      value={receiveQuantity}
                      onChange={(e) => setReceiveQuantity(e.target.value)}
                      className="w-32 text-lg font-medium"
                      autoFocus
                    />
                    <Button 
                      onClick={handleReceiveStock}
                      disabled={receiving || !receiveQuantity || parseInt(receiveQuantity, 10) <= 0}
                      className="flex-1 gap-2"
                    >
                      <Download className="h-4 w-4" />
                      {receiving ? 'Processing...' : 'Confirm Receipt'}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center min-h-[200px] text-center text-slate-400">
                <Download className="h-8 w-8 mb-3 text-slate-300" />
                <p>Select a product from the search<br/>to receive stock.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Receive List Section */}
      <Card className="border-slate-200 shadow-sm mt-8">
        <CardHeader className="bg-slate-50 border-b border-slate-100 pb-4">
          <CardTitle className="text-lg">Quick Receive (All Products)</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">SKU / C-Number</th>
                <th className="px-4 py-3 font-medium text-right">Current Stock</th>
                <th className="px-4 py-3 font-medium text-right">Receive Qty</th>
                <th className="px-4 py-3 font-medium w-32"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.filter(p => !p.isArchived).map(product => (
                <tr key={product.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-slate-900 flex items-center gap-3">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt="" className="h-8 w-8 rounded object-cover border border-slate-200 bg-white" />
                    ) : (
                      <div className="h-8 w-8 rounded bg-slate-100 border border-slate-200"></div>
                    )}
                    {product.name}
                  </td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                    {product.sku ? `${product.sku} • ` : ''}{product.cNumber}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">
                    {product.stockLevel}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Input 
                      type="number" 
                      min="1"
                      placeholder="Qty" 
                      className="w-24 ml-auto text-center"
                      value={listQuantities[product.id] || ''}
                      onChange={(e) => setListQuantities(prev => ({ ...prev, [product.id]: e.target.value }))}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button 
                      size="sm"
                      disabled={receivingId === product.id || !listQuantities[product.id] || parseInt(listQuantities[product.id], 10) <= 0}
                      onClick={() => handleInlineReceive(product)}
                      className="w-full"
                    >
                      {receivingId === product.id ? '...' : 'Receive'}
                    </Button>
                  </td>
                </tr>
              ))}
              {products.filter(p => !p.isArchived).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No active products found in inventory.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
