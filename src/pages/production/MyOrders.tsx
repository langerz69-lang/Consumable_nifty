import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../components/AuthContext';
import { Order } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { ShieldAlert, PackageCheck, Clock, Truck } from 'lucide-react';
import { format } from 'date-fns';

export default function MyOrders() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!profile?.areaId) return;
      try {
        const allOrders = await api.getOrders();
        setOrders(allOrders.filter(o => o.areaId === profile.areaId));
      } catch (err) {
        console.error("Error fetching my orders", err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [profile?.areaId]);

  const StatusIcon = ({ status }: { status: string }) => {
    switch(status) {
      case 'PENDING': return <Clock className="h-4 w-4 text-amber-500" />;
      case 'PARTIALLY_PICKED': return <Clock className="h-4 w-4 text-orange-500" />;
      case 'PICKED': return <PackageCheck className="h-4 w-4 text-blue-500" />;
      case 'DELIVERED': return <Truck className="h-4 w-4 text-green-500" />;
      default: return null;
    }
  };

  const StatusBadge = ({ status }: { status: string }) => {
    switch(status) {
      case 'PENDING': return <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200">Pending</Badge>;
      case 'PARTIALLY_PICKED': return <Badge variant="outline" className="text-orange-700 bg-orange-50 border-orange-200">Partially Picked</Badge>;
      case 'PICKED': return <Badge variant="outline" className="text-blue-700 bg-blue-50 border-blue-200">Picked</Badge>;
      case 'DELIVERED': return <Badge variant="outline" className="text-green-700 bg-green-50 border-green-200">Delivered</Badge>;
      default: return null;
    }
  };

  if (loading) return <div>Loading orders...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">My Orders</h1>
        <p className="text-slate-500 mt-1">Track the status of your area's consumable requests.</p>
      </div>

      <div className="space-y-4">
        {orders.map(order => (
          <Card key={order.id} className="overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <StatusIcon status={order.status} />
                <StatusBadge status={order.status} />
                <span className="text-sm text-slate-500">{format(order.createdAt, 'PP p')}</span>
              </div>
              <div className="flex items-center gap-6 text-sm">
                {order.totalAdrScore > 0 && (
                  <div className="flex items-center gap-1 text-red-600 font-medium">
                    <ShieldAlert className="h-4 w-4" /> {order.totalAdrScore} ADR
                  </div>
                )}
                <div className="font-medium text-slate-900">
                  Total: £{order.totalCost.toFixed(2)}
                </div>
              </div>
            </div>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {order.items.map((item, idx) => {
                  const showPartial = item.pickedQuantity !== undefined && item.pickedQuantity < item.quantity;
                  return (
                    <div key={idx} className={`px-6 py-3 flex justify-between items-center text-sm ${showPartial ? 'bg-orange-50/50' : 'hover:bg-slate-50/50'}`}>
                      <div className="flex items-center gap-4">
                        <span className="font-medium min-w-[3rem] text-slate-500">
                           {showPartial ? `${item.pickedQuantity}/${item.quantity}` : `${item.quantity}x`}
                        </span>
                        <span className="text-slate-900">{item.name} {showPartial && <span className="text-orange-600 text-xs ml-2">(Shortage)</span>}</span>
                      </div>
                      <div className="text-slate-500">
                        £{(item.unitCost * item.quantity).toFixed(2)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}

        {orders.length === 0 && (
          <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl text-slate-500">
            No orders placed yet.
          </div>
        )}
      </div>
    </div>
  );
}
