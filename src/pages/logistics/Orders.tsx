import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/api';
import { Order, OrderItem } from '../../types';
import { useAuth } from '../../components/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ShieldAlert, PackageCheck, Clock, Truck, FileText, CheckCircle2, AlertCircle, Download, Loader2, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { Input } from '../../components/ui/Input';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import { generateAndDownloadOrderPdf, OrderPdfData } from '../../utils/orderEmailPdf';
import OrderEmailPdfModal from '../../components/OrderEmailPdfModal';

const StatusIcon = ({ status }: { status: string }) => {
  switch(status) {
    case 'PENDING': return <Clock className="h-4 w-4 text-amber-500" />;
    case 'PARTIALLY_PICKED': return <AlertCircle className="h-4 w-4 text-orange-500" />;
    case 'PICKED': return <PackageCheck className="h-4 w-4 text-blue-500" />;
    case 'DELIVERED': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    default: return null;
  }
};

function OrderCard({ order, areaName, areaNotificationEmail, onUpdate, onPrint, onEmailModal, productsMap = {} }: { key?: React.Key, order: Order, areaName: string, areaNotificationEmail?: string, onUpdate: () => void, onPrint: (o: Order) => void, onEmailModal: (data: OrderPdfData) => void, productsMap?: Record<string, { cNumber: string, binLocation: string }> }) {
  const isEditable = order.status === 'PENDING' || order.status === 'PARTIALLY_PICKED';
  
  // Local state for pick quantities, defaulting to item.quantity or already picked quantity
  const [pickQuantities, setPickQuantities] = useState<Record<number, string>>({});

  useEffect(() => {
    const initial: Record<number, string> = {};
    order.items.forEach((item, idx) => {
      initial[idx] = (item.pickedQuantity ?? item.quantity).toString();
    });
    setPickQuantities(initial);
  }, [order]);

  const handlePickQuantityChange = (idx: number, val: string) => {
    setPickQuantities(prev => ({ ...prev, [idx]: val }));
  };

  const handleSavePick = async () => {
    let allFullyPicked = true;
    let somePicked = false;
    
    const updatedItems = order.items.map((item, idx) => {
      const picked = parseInt(pickQuantities[idx], 10) || 0;
      if (picked < item.quantity) allFullyPicked = false;
      if (picked > 0) somePicked = true;
      
      return {
        ...item,
        pickedQuantity: Math.min(picked, item.quantity) // clamp to max requested
      };
    });

    let newStatus = order.status;
    if (allFullyPicked) {
      newStatus = 'PICKED';
    } else if (somePicked || order.status === 'PENDING') {
      newStatus = 'PARTIALLY_PICKED';
    }

    try {
      await api.updateOrder(order.id, {
        items: updatedItems,
        status: newStatus
      });
      onUpdate();
    } catch (err) {
      console.error("Failed to save pick", err);
    }
  };

  const handleMarkDelivered = async () => {
    try {
      await api.updateOrder(order.id, { status: 'DELIVERED' });
      onUpdate();
    } catch (err) {
      console.error("Failed to mark delivered", err);
    }
  };

  const handleDeliverPartial = async () => {
    try {
      const deliveredItems: OrderItem[] = [];
      const shortageItems: OrderItem[] = [];

      order.items.forEach((item) => {
        const picked = item.pickedQuantity !== undefined ? item.pickedQuantity : item.quantity;
        const shortage = item.quantity - picked;

        if (picked > 0) {
          deliveredItems.push({
            ...item,
            quantity: picked,
            pickedQuantity: picked
          });
        }

        if (shortage > 0) {
          shortageItems.push({
            ...item,
            quantity: shortage,
            pickedQuantity: 0
          });
        }
      });

      if (deliveredItems.length === 0) {
        throw new Error("Cannot deliver partial order with 0 picked items. Please pick at least 1 item first or cancel the order.");
      }

      const deliveredTotalCost = deliveredItems.reduce((sum, item) => sum + (item.unitCost * item.quantity), 0);
      const deliveredTotalAdr = deliveredItems.reduce((sum, item) => sum + (item.adrScore * item.quantity), 0);

      const shortageTotalCost = shortageItems.reduce((sum, item) => sum + (item.unitCost * item.quantity), 0);
      const shortageTotalAdr = shortageItems.reduce((sum, item) => sum + (item.adrScore * item.quantity), 0);

      // Update current order as DELIVERED with exactly the picked/delivered quantities
      await api.updateOrder(order.id, {
        status: 'DELIVERED',
        items: deliveredItems,
        totalCost: deliveredTotalCost,
        totalAdrScore: deliveredTotalAdr
      });

      // Create shortage order as PENDING with remaining quantities
      if (shortageItems.length > 0) {
        await api.createOrder({
          userId: order.userId,
          areaId: order.areaId,
          status: 'PENDING',
          totalCost: shortageTotalCost,
          totalAdrScore: shortageTotalAdr,
          createdAt: Date.now(),
          deliveryNoteGenerated: false,
          items: shortageItems
        });
      }

      onUpdate();
    } catch (err: any) {
      console.error("Failed to deliver partial order", err);
      alert(err.message || "Failed to process partial delivery");
    }
  };

  return (
    <Card className="overflow-hidden border-slate-300">
      <div className="bg-slate-100 px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <StatusIcon status={order.status} />
            <span className="font-semibold text-slate-900 tracking-wide">{order.status.replace('_', ' ')}</span>
          </div>
          <div className="h-4 w-px bg-slate-300 hidden sm:block"></div>
          <span className="text-sm text-slate-600 font-medium">Area: {areaName}</span>
          <div className="h-4 w-px bg-slate-300 hidden sm:block"></div>
          <span className="text-slate-500 text-sm">{format(order.createdAt, 'PP p')}</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
           {isEditable && (
             <Button size="sm" onClick={handleSavePick} className="bg-blue-600 hover:bg-blue-700">
               Save Pick
             </Button>
           )}
           {order.status === 'PICKED' && (
             <Button size="sm" onClick={handleMarkDelivered} className="bg-green-600 hover:bg-green-700">
               Mark Delivered
             </Button>
           )}
           {order.status === 'PARTIALLY_PICKED' && (
             <Button size="sm" onClick={handleDeliverPartial} className="bg-orange-600 hover:bg-orange-700">
               Deliver Picked Portion
             </Button>
           )}
           <Button size="sm" variant="outline" onClick={() => onPrint(order)} className="gap-2">
             <FileText className="h-4 w-4" /> {order.deliveryNoteGenerated ? 'Re-print Note' : 'Generate Note'}
           </Button>
           <Button 
             size="sm" 
             onClick={() => onEmailModal({
               orderId: order.id,
               areaName,
               recipientEmail: areaNotificationEmail || 'spares@shenley.co.uk',
               userName: 'Logistics Manager',
               items: order.items,
               totalCost: order.totalCost,
               totalAdrScore: order.totalAdrScore,
               createdAt: order.createdAt
             })} 
             className="bg-blue-600 hover:bg-blue-700 text-white gap-2 font-semibold"
           >
             <Mail className="h-4 w-4" /> Email PDF Order
           </Button>
        </div>
      </div>
      
      <CardContent className="p-0">
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Requested Items</h4>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2 font-medium text-slate-500">Item</th>
                    <th className="px-4 py-2 font-medium text-slate-500 w-24 text-center">Req</th>
                    <th className="px-4 py-2 font-medium text-slate-500 w-32 text-center">Picked</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {order.items.map((item, idx) => {
                    const itemCNumber = item.cNumber || productsMap[item.productId]?.cNumber || 'N/A';
                    const itemBinLocation = item.binLocation || productsMap[item.productId]?.binLocation || 'N/A';

                    return (
                      <tr key={idx} className={item.pickedQuantity !== undefined && item.pickedQuantity < item.quantity ? 'bg-orange-50' : ''}>
                        <td className="px-4 py-3 text-slate-900">
                          <div className="flex flex-wrap items-center gap-2 text-base">
                            <span className="font-bold text-indigo-800 bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded-md font-mono text-base whitespace-nowrap">
                              C-No: {itemCNumber}
                            </span>
                            <span className="font-semibold text-slate-800">{item.name}</span>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-1.5 items-center">
                            <span className="text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md font-mono">
                              Loc: {itemBinLocation}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-center font-bold">{item.quantity}</td>
                        <td className="px-4 py-3 text-slate-600 text-center">
                          {isEditable ? (
                            <Input 
                              type="number"
                              min="0"
                              max={item.quantity}
                              value={pickQuantities[idx] || ''}
                              onChange={(e) => handlePickQuantityChange(idx, e.target.value)}
                              className="w-20 text-center mx-auto h-8"
                            />
                          ) : (
                            <span className="font-bold">{item.pickedQuantity ?? item.quantity}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {order.status === 'PARTIALLY_PICKED' && (
               <p className="text-sm text-orange-600 flex items-center gap-2">
                 <AlertCircle className="h-4 w-4" /> 
                 Order is partially picked. Shortages hold the area's quota until fully fulfilled.
               </p>
            )}
          </div>
          
          <div className="bg-slate-50 rounded-lg p-5 border border-slate-200 h-fit space-y-4">
             <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Order Summary</h4>
             <div className="space-y-2 text-sm">
               <div className="flex justify-between border-b border-slate-200 pb-2">
                 <span className="text-slate-500">Items Requested</span>
                 <span className="font-medium">{order.items.reduce((s, i) => s + i.quantity, 0)}</span>
               </div>
               <div className="flex justify-between border-b border-slate-200 pb-2">
                 <span className="text-slate-500">Items Picked</span>
                 <span className="font-medium">{order.items.reduce((s, i) => s + (i.pickedQuantity ?? i.quantity), 0)}</span>
               </div>
             </div>
             {order.totalAdrScore > 0 && (
               <div className="mt-4 pt-4 border-t border-slate-200">
                 <div className="bg-red-50 text-red-700 p-3 rounded-md flex items-start gap-2">
                   <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
                   <div>
                     <p className="font-semibold text-sm">ADR Compliance Required</p>
                     <p className="text-xs mt-1">Total Score: {order.totalAdrScore}</p>
                   </div>
                 </div>
               </div>
             )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LogisticsOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [productsMap, setProductsMap] = useState<Record<string, { cNumber: string, binLocation: string }>>({});
  const [loading, setLoading] = useState(true);
  const [printingOrder, setPrintingOrder] = useState<Order | null>(null);
  const [showEmailModalData, setShowEmailModalData] = useState<OrderPdfData | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  
  const { availableAreas } = useAuth();
  
  const getAreaName = (areaId: string) => {
    const area = availableAreas.find(a => a.id === areaId);
    return area ? area.name : areaId;
  };

  const fetchOrders = async () => {
    try {
      const allOrders = await api.getOrders();
      setOrders(allOrders.filter(o => o.status !== 'DELIVERED'));
    } catch (err) {
      console.error("Error fetching orders", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const prods = await api.getProducts();
        const mapping: Record<string, { cNumber: string, binLocation: string }> = {};
        prods.forEach(p => {
          mapping[p.id] = {
            cNumber: p.cNumber || '',
            binLocation: p.binLocation || ''
          };
        });
        setProductsMap(mapping);
      } catch (err) {
        console.error("Error fetching products map", err);
      }
    };
    fetchProducts();
    fetchOrders();
  }, []);

  const generateDeliveryNote = async (order: Order) => {
    if (!order.deliveryNoteGenerated) {
      try {
        await api.updateOrder(order.id, { deliveryNoteGenerated: true });
        fetchOrders();
      } catch (err) {
        console.error("Failed to update deliveryNoteGenerated", err);
      }
    }
    setPrintingOrder(order);
  };

  const handleDownloadPdf = async () => {
    if (!printRef.current || !printingOrder) return;
    
    try {
      setIsGeneratingPdf(true);
      const canvas = await html2canvas(printRef.current, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: 'a4',
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`DeliveryNote-${printingOrder.id}.pdf`);
    } catch (error) {
      console.error("Failed to generate PDF", error);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const getAreaNotificationEmail = (areaId: string) => {
    const area = availableAreas.find(a => a.id === areaId);
    return area ? area.notificationEmail : undefined;
  };

  if (loading) return <div>Loading orders...</div>;

  return (
    <>
      <div className="space-y-6 print:hidden max-w-6xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Order Fulfillment</h1>
          <p className="text-slate-500 mt-1">Manage production area requests and track delivery lifecycle.</p>
        </div>

      <div className="space-y-6">
        {orders.map(order => (
          <OrderCard 
            key={order.id} 
            order={order} 
            areaName={getAreaName(order.areaId)}
            areaNotificationEmail={getAreaNotificationEmail(order.areaId)}
            onUpdate={fetchOrders} 
            onPrint={generateDeliveryNote} 
            onEmailModal={setShowEmailModalData}
            productsMap={productsMap}
          />
        ))}

        {orders.length === 0 && (
          <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl text-slate-500">
            No orders in the system.
          </div>
        )}
      </div>
      </div>

      {/* Delivery Note Modal */}
      {printingOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 print:p-0 print:bg-white overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto print:max-h-none print:shadow-none print:rounded-none">
            <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex justify-between items-center print:hidden">
              <h2 className="text-lg font-semibold">Delivery Note Preview</h2>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setPrintingOrder(null)}>Close</Button>
                <Button onClick={handleDownloadPdf} disabled={isGeneratingPdf} className="gap-2">
                  {isGeneratingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {isGeneratingPdf ? 'Generating...' : 'Download PDF'}
                </Button>
              </div>
            </div>
            <div ref={printRef} className="p-8 text-black bg-white min-h-[800px] print:min-h-0">
              <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-end">
                <div>
                  <h1 className="text-4xl font-bold uppercase tracking-widest">Delivery Note</h1>
                  <p className="text-gray-600 mt-2 text-lg">Order #{printingOrder.id}</p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-semibold">Date: {format(printingOrder.createdAt, 'PP p')}</p>              
                  <p className="font-semibold mt-1">Area: {getAreaName(printingOrder.areaId)}</p>
                </div>
              </div>
              
              <table className="w-full text-left border-collapse mt-8">
            <thead>
              <tr className="border-b-2 border-black bg-gray-100">
                <th className="py-3 px-4 font-bold">Qty Picked</th>
                <th className="py-3 px-4 font-bold">Qty Req</th>
                <th className="py-3 px-4 font-bold">Item Description</th>
              </tr>
            </thead>
            <tbody>
              {printingOrder.items.map((item, idx) => {
                const itemCNumber = item.cNumber || productsMap[item.productId]?.cNumber || 'N/A';
                const itemBinLocation = item.binLocation || productsMap[item.productId]?.binLocation || 'N/A';
                return (
                  <tr key={idx} className="border-b border-gray-300">
                    <td className="py-3 px-4 font-medium text-lg">{item.pickedQuantity ?? item.quantity}</td>
                    <td className="py-3 px-4 text-gray-500">{item.quantity}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap items-center gap-2 text-lg">
                        <span className="font-bold text-black border border-gray-400 bg-gray-100 px-2 py-0.5 rounded font-mono text-lg whitespace-nowrap">
                          C-No: {itemCNumber}
                        </span>
                        <span className="font-semibold">{item.name}</span>
                      </div>
                      <div className="mt-1 flex gap-4 text-base font-mono">
                        <span className="text-gray-700 bg-gray-50 border border-gray-300 px-2 py-0.5 rounded">
                          Loc: {itemBinLocation}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {printingOrder.totalAdrScore > 0 && (
            <div className="mt-12 border-2 border-red-600 p-4 text-red-800 bg-red-50 font-bold flex items-center gap-3">
              <ShieldAlert className="h-8 w-8" />
              <div>
                <p className="text-lg">DANGEROUS GOODS (ADR) INCLUDED</p>
                <p className="text-sm font-normal">Compliance Score: {printingOrder.totalAdrScore}</p>
              </div>
            </div>
          )}
          
          <div className="mt-24 pt-8 border-t border-gray-300 flex justify-between text-gray-500 text-sm">
            <div className="text-center">
              <div className="border-b border-gray-400 w-48 mb-2 h-8"></div>
              Picker Signature
            </div>
            <div className="text-center">
              <div className="border-b border-gray-400 w-48 mb-2 h-8"></div>
              Receiver Signature
            </div>
          </div>
        </div>
        </div>
        </div>
      )}

      {showEmailModalData && (
        <OrderEmailPdfModal 
          data={showEmailModalData}
          onClose={() => setShowEmailModalData(null)}
        />
      )}
    </>
  );
}
