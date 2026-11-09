import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../components/AuthContext';
import { Product, OrderItem } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { ShoppingCart, ShieldAlert, CheckCircle2, Lock, Star, MapPin, Mail, FileText, Download, ExternalLink, Send } from 'lucide-react';
import { generateAndDownloadOrderPdf, OrderPdfData } from '../../utils/orderEmailPdf';
import OrderEmailPdfModal from '../../components/OrderEmailPdfModal';

export default function Catalog() {
  const { profile, availableAreas } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [pendingQuantities, setPendingQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [notificationSentTo, setNotificationSentTo] = useState<string | null>(null);
  const [lastCreatedOrderData, setLastCreatedOrderData] = useState<OrderPdfData | null>(null);
  const [showEmailModalData, setShowEmailModalData] = useState<OrderPdfData | null>(null);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  useEffect(() => {
    if (profile?.areaId) {
      const savedFavorites = localStorage.getItem(`favorites_${profile.areaId}`);
      if (savedFavorites) {
        setFavorites(JSON.parse(savedFavorites));
      }
    }
  }, [profile?.areaId]);

  const toggleFavorite = (productId: string) => {
    setFavorites(prev => {
      const newFavs = prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId];
      if (profile?.areaId) {
        localStorage.setItem(`favorites_${profile.areaId}`, JSON.stringify(newFavs));
      }
      return newFavs;
    });
  };

  const loadCatalog = useCallback(async () => {
    if (!profile?.areaId) return;
    try {
      const [prods, orders] = await Promise.all([
        api.getProducts(),
        api.getOrders()
      ]);

      const areaProds = prods.filter(p => (p.allowedAreaIds || []).includes(profile.areaId!) && !p.isArchived);
      setProducts(areaProds);

      const pQty: Record<string, number> = {};
      orders
        .filter(o => o.areaId === profile.areaId && (o.status === 'PENDING' || o.status === 'PARTIALLY_PICKED'))
        .forEach(order => {
          order.items?.forEach((item: any) => {
            const unpickedQty = item.quantity - (item.pickedQuantity || 0);
            pQty[item.productId] = (pQty[item.productId] || 0) + unpickedQty;
          });
        });

      setPendingQuantities(pQty);
    } catch (err) {
      console.error("Failed to load catalog items:", err);
    } finally {
      setLoading(false);
    }
  }, [profile?.areaId]);

  useEffect(() => {
    loadCatalog();
    const interval = setInterval(loadCatalog, 6000);
    return () => clearInterval(interval);
  }, [loadCatalog]);


  const getAvailableLimit = (product: Product, currentCart: OrderItem[] = cart) => {
    if (!profile?.areaId) return 0;
    const config = product.areaConfigs?.[profile.areaId];
    
    // Default to 10 if no area config exists, or if maxOrderQuantity is falsy/unconfigured
    const maxAllowed = (config && config.maxOrderQuantity) ? config.maxOrderQuantity : 10;
    const currentlyPending = pendingQuantities[product.id] || 0;
    const inCart = currentCart.find(i => i.productId === product.id)?.quantity || 0;
    
    return Math.max(0, maxAllowed - currentlyPending - inCart);
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const remainingLimit = getAvailableLimit(product, prev);
      const existing = prev.find(item => item.productId === product.id);
      const currentInCart = existing?.quantity || 0;
      
      const isStockAvailable = product.stockLevel < 0 || currentInCart < product.stockLevel;
      if (remainingLimit <= 0 || !isStockAvailable) return prev; // Guardrails
      
      if (existing) {
        return prev.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { 
        productId: product.id, 
        name: product.name, 
        quantity: 1, 
        unitCost: product.unitCost, 
        adrScore: product.isAdr ? product.adrScore : 0,
        cNumber: product.cNumber,
        binLocation: product.binLocation
      }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === productId);
      if (existing && existing.quantity > 1) {
        return prev.map(item => item.productId === productId ? { ...item, quantity: item.quantity - 1 } : item);
      }
      return prev.filter(item => item.productId !== productId);
    });
  };

  const totalCost = cart.reduce((sum, item) => sum + (item.unitCost * item.quantity), 0);
  const totalAdr = cart.reduce((sum, item) => sum + (item.adrScore * item.quantity), 0);

  const placeOrder = async () => {
    if (!profile?.areaId || cart.length === 0) return;
    setError('');
    setNotificationSentTo(null);
    
    const activeArea = availableAreas.find(a => a.id === profile?.areaId);
    
    try {
      // Validate sufficient stock
      for (const item of cart) {
        const prod = products.find(p => p.id === item.productId);
        if (prod && prod.stockLevel < item.quantity) {
          throw new Error(`Insufficient stock for ${item.name} (Available: ${prod.stockLevel}, Requested: ${item.quantity})`);
        }
      }

      // Create order via local MariaDB API (which automatically decrements stock atomically)
      const createdOrder = await api.createOrder({
        userId: profile.id,
        areaId: profile.areaId,
        status: 'PENDING',
        totalCost,
        totalAdrScore: totalAdr,
        createdAt: Date.now(),
        deliveryNoteGenerated: false,
        items: cart
      });

      const createdOrderId = createdOrder.id;

      // Generate PDF & Launch Interactive Email Modal
      const targetEmail = activeArea?.notificationEmail || 'spares@factory.local';
      const totalItemsCount = cart.reduce((s, i) => s + i.quantity, 0);

      const pdfData: OrderPdfData = {
        orderId: createdOrderId,
        areaName: activeArea?.name || 'Production Area',
        recipientEmail: targetEmail,
        userName: profile.name || 'Production Worker',
        items: [...cart],
        totalCost,
        totalAdrScore: totalAdr,
        createdAt: Date.now()
      };

      setLastCreatedOrderData(pdfData);
      setShowEmailModalData(pdfData);
      setNotificationSentTo(targetEmail);

      // Download PDF immediately
      try {
        generateAndDownloadOrderPdf(pdfData);
      } catch (pdfErr) {
        console.error('PDF Download Error:', pdfErr);
      }

      // Write audit log to local MariaDB
      try {
        await api.createEmailLog({
          orderId: createdOrderId,
          areaName: activeArea?.name || 'Production Area',
          notificationEmail: targetEmail,
          sentAt: Date.now(),
          status: 'DISPATCHED'
        });
      } catch (auditErr) {
        console.error('Audit log write error:', auditErr);
      }

      setCart([]);
      setOrderPlaced(true);
      setTimeout(() => {
        setOrderPlaced(false);
      }, 10000);
      loadCatalog();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) return <div>Loading catalogue...</div>;

  const searchLower = searchQuery.toLowerCase();
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchLower) || p.cNumber.toLowerCase().includes(searchLower);
    const matchesFavorites = showFavoritesOnly ? favorites.includes(p.id) : true;
    return matchesSearch && matchesFavorites;
  });

  const activeArea = availableAreas.find(a => a.id === profile?.areaId);

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Catalogue */}
      <div className="flex-1 space-y-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Area Catalogue</h1>
            {activeArea ? (
              <div className="text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                <span>Order consumables for</span>
                <Link 
                  to="/select-area" 
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-full border border-blue-200 shadow-sm transition-all"
                >
                  <MapPin className="h-3 w-3" />
                  {activeArea.name} (Change)
                </Link>
              </div>
            ) : (
              <p className="text-slate-500 mt-1">Order consumables for your designated production area.</p>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <Button 
              variant="outline" 
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              className={`gap-2 ${showFavoritesOnly ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 hover:text-amber-800' : ''}`}
            >
              <Star className={`h-4 w-4 ${showFavoritesOnly ? 'fill-amber-500 text-amber-500' : ''}`} />
              Favourites
            </Button>
            <div className="w-full sm:w-64">
              <Input 
                placeholder="Search by name or C-Number..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200">
            <p className="font-semibold">Order Failed</p>
            <p className="text-sm">{error}</p>
          </div>
        )}
        
        {orderPlaced && (
          <div className="bg-emerald-50 text-emerald-900 p-4 rounded-xl border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 flex-shrink-0" />
              <div>
                <p className="font-bold text-sm text-emerald-950">Order Submitted &amp; PDF Generated!</p>
                <p className="text-xs text-emerald-800 mt-0.5">
                  Official PDF Order Note downloaded &amp; pre-filled email client opened for <strong className="font-mono">{notificationSentTo || 'notification target'}</strong>.
                </p>
              </div>
            </div>
            {lastCreatedOrderData && (
              <div className="flex items-center gap-2">
                <Button 
                  size="sm" 
                  onClick={() => setShowEmailModalData(lastCreatedOrderData)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold gap-1.5 h-8 whitespace-nowrap"
                >
                  <Mail className="h-3.5 w-3.5" />
                  <Download className="h-3.5 w-3.5" />
                  Email &amp; Download PDF
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredProducts.map(product => (
            <Card key={product.id}>
              {product.imageUrl && (
                <div className="w-full h-40 bg-slate-100 rounded-t-xl overflow-hidden border-b border-slate-200">
                  <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                </div>
              )}
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg flex items-center justify-between w-full">
                      <span>{product.name}</span>
                      <button 
                        onClick={() => toggleFavorite(product.id)}
                        className={`p-1 -mr-2 rounded-full hover:bg-slate-100 transition-colors ${favorites.includes(product.id) ? 'text-amber-500' : 'text-slate-300'}`}
                      >
                        <Star className={`h-5 w-5 ${favorites.includes(product.id) ? 'fill-amber-500' : ''}`} />
                      </button>
                    </CardTitle>
                    <p className="text-xs text-slate-500 font-mono mt-1">{product.sku ? `${product.sku} • ` : ''}{product.cNumber}</p>
                  </div>
                  {product.isAdr && <Badge variant="destructive" className="gap-1 mt-1"><ShieldAlert className="h-3 w-3" /> ADR</Badge>}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-end mb-6">
                  <div className="space-y-1">
                    <p className="text-sm text-slate-500">Available Limit</p>
                    <p className="text-xl font-medium">{getAvailableLimit(product)}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-sm text-slate-500">Cost</p>
                    <p className="font-medium">£{product.unitCost.toFixed(2)}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Button 
                    className="w-full" 
                    disabled={product.stockLevel === 0 || getAvailableLimit(product) === 0}
                    onClick={() => addToCart(product)}
                  >
                    {product.stockLevel === 0 
                      ? 'Out of Stock (Global)' 
                      : getAvailableLimit(product) === 0 
                        ? 'Area Limit Reached' 
                        : 'Add to Order'
                    }
                  </Button>
                  {(pendingQuantities[product.id] || 0) > 0 && (
                     <p className="text-xs text-slate-500 text-center flex items-center justify-center gap-1">
                        <Lock className="h-3 w-3" /> {pendingQuantities[product.id]} currently processing
                     </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {products.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-500 border-2 border-dashed border-slate-200 rounded-xl">
              No products assigned to your area yet.
            </div>
          )}
        </div>
      </div>

      {/* Cart Sidebar */}
      <div className="w-full lg:w-80 xl:w-96">
        <Card className="sticky top-8 border-slate-300 shadow-md">
          <CardHeader className="bg-slate-50 border-b border-slate-100 rounded-t-xl">
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" /> Current Order
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {cart.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                Your order is empty.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {cart.map(item => (
                  <div key={item.productId} className="p-4 flex justify-between items-center">
                    <div>
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-xs text-slate-500">£{item.unitCost.toFixed(2)} each</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center bg-slate-50 rounded-md border border-slate-200">
                        <button onClick={() => removeFromCart(item.productId)} className="px-2 py-1 text-slate-500 hover:text-slate-900">-</button>
                        <span className="text-sm font-medium w-4 text-center">{item.quantity}</span>
                        <button onClick={() => {
                          const product = products.find(p => p.id === item.productId);
                          if (product) addToCart(product);
                        }} className="px-2 py-1 text-slate-500 hover:text-slate-900">+</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="p-6 bg-slate-50 border-t border-slate-200 rounded-b-xl space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Total Items</span>
                  <span className="font-medium">{cart.reduce((s, i) => s + i.quantity, 0)}</span>
                </div>
                {totalAdr > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 flex items-center gap-1"><ShieldAlert className="h-3 w-3 text-red-500"/> ADR Score</span>
                    <span className="font-medium text-red-600">{totalAdr} pts</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold pt-2 border-t border-slate-200">
                  <span>Total Cost</span>
                  <span>£{totalCost.toFixed(2)}</span>
                </div>
              </div>
              
              <Button 
                className="w-full" 
                size="lg" 
                disabled={cart.length === 0}
                onClick={placeOrder}
              >
                Submit Order
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Email PDF Order Dispatch Modal */}
      {showEmailModalData && (
        <OrderEmailPdfModal 
          data={showEmailModalData}
          onClose={() => setShowEmailModalData(null)}
        />
      )}
    </div>
  );
}
