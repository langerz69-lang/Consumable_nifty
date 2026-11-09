import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Order } from '../../types';
import { useAuth } from '../../components/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { format } from 'date-fns';
import { ShoppingCart, DollarSign, Package, Trash2 } from 'lucide-react';

export default function OrderHistory() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showConfirmDeleteId, setShowConfirmDeleteId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { availableAreas } = useAuth();

  const getAreaName = (areaId: string) => {
    const area = availableAreas.find(a => a.id === areaId);
    return area ? area.name : areaId;
  };

  const fetchHistory = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const allOrders = await api.getOrders();
      setOrders(allOrders.filter(o => o.status === 'DELIVERED'));
    } catch (err) {
      console.error("Error loading order history:", err);
      setErrorMessage("Error fetching historical orders.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDeleteOrder = async (orderId: string) => {
    setDeletingId(orderId);
    setErrorMessage(null);
    try {
      await api.deleteOrder(orderId);
      setOrders(prev => prev.filter(o => o.id !== orderId));
      setShowConfirmDeleteId(null);
    } catch (err) {
      console.error("Failed to delete order:", err);
      setErrorMessage("Failed to delete the order from the database. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <div>Loading order history...</div>;

  const totalSpent = orders.reduce((sum, o) => sum + o.totalCost, 0);
  const totalItems = orders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Order History</h1>
        <p className="text-slate-500 mt-1">Review past delivered orders, manage testing logs, and monitor overall expenditure.</p>
      </div>

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg text-sm font-semibold">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-full">
              <ShoppingCart className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Orders</p>
              <p className="text-2xl font-bold text-slate-900">{orders.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-green-100 text-green-600 rounded-full">
              <DollarSign className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Expenditure</p>
              <p className="text-2xl font-bold text-slate-900">£{totalSpent.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-purple-100 text-purple-600 rounded-full">
              <Package className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Items Processed</p>
              <p className="text-2xl font-bold text-slate-900">{totalItems}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Completed Orders</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 font-medium text-slate-500">Date</th>
                  <th className="px-6 py-3 font-medium text-slate-500">Area</th>
                  <th className="px-6 py-3 font-medium text-slate-500">Items</th>
                  <th className="px-6 py-3 font-medium text-slate-500 text-right">Cost</th>
                  <th className="px-6 py-3 font-medium text-slate-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {orders.map(order => (
                  <tr key={order.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-slate-900">
                      {format(order.createdAt, 'PP p')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                      {getAreaName(order.areaId)}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {order.items.reduce((s, i) => s + i.quantity, 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-slate-900">
                      £{order.totalCost.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      {showConfirmDeleteId === order.id ? (
                        <div className="flex items-center justify-end gap-2 bg-rose-50 border border-rose-100 p-1.5 rounded-lg inline-flex">
                          <span className="text-xs text-rose-800 font-bold">Are you sure?</span>
                          <button
                            onClick={() => handleDeleteOrder(order.id)}
                            disabled={deletingId === order.id}
                            className="bg-rose-600 hover:bg-rose-700 text-white text-[11px] px-2.5 py-1 rounded font-bold transition-all disabled:opacity-50"
                          >
                            {deletingId === order.id ? 'Deleting...' : 'Yes, Delete'}
                          </button>
                          <button
                            onClick={() => setShowConfirmDeleteId(null)}
                            disabled={deletingId === order.id}
                            className="bg-slate-200 hover:bg-slate-300 text-slate-800 text-[11px] px-2.5 py-1 rounded font-bold transition-all"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowConfirmDeleteId(order.id)}
                          className="text-red-600 hover:text-red-900 hover:bg-red-50 p-1.5 rounded-lg transition-all inline-flex items-center gap-1 font-semibold"
                          title="Delete this order"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                      No delivered orders in history.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
