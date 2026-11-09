import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Category, Supplier, Area, UserProfile, Role } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Trash2, FileSpreadsheet, Users, UserPlus, ShieldAlert, Lock, Unlock, CheckCircle2, XCircle, Eye, EyeOff, Mail, Edit3, History, Send, X } from 'lucide-react';
import SupplierCSVImportModal from '../../components/SupplierCSVImportModal';
import CategoryCSVImportModal from '../../components/CategoryCSVImportModal';
import EditAreaModal from '../../components/EditAreaModal';

interface EmailLog {
  id: string;
  orderId?: string;
  areaId?: string;
  areaName?: string;
  recipientEmail?: string;
  itemsCount?: number;
  totalCost?: number;
  sentAt?: number;
  status?: string;
}

export default function Settings() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaNotificationEmail, setNewAreaNotificationEmail] = useState('');
  const [editingArea, setEditingArea] = useState<Area | null>(null);

  // Email Notification Logs Modal
  const [showEmailLogs, setShowEmailLogs] = useState(false);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [loadingEmailLogs, setLoadingEmailLogs] = useState(false);
  
  // New User Creation States
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<Role>('PRODUCTION');
  const [newUserAreaId, setNewUserAreaId] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserAccessAllowed, setNewUserAccessAllowed] = useState(true);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);

  const [loading, setLoading] = useState(true);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'category' | 'supplier' | 'area' | 'user'; id: string } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [cats, sups, ars, users] = await Promise.all([
        api.getCategories(),
        api.getSuppliers(),
        api.getAreas(),
        api.getUsers()
      ]);
      
      cats.sort((a, b) => a.name.localeCompare(b.name));
      setCategories(cats);

      sups.sort((a, b) => a.name.localeCompare(b.name));
      setSuppliers(sups);

      ars.sort((a, b) => a.name.localeCompare(b.name));
      setAreas(ars);

      users.sort((a, b) => a.name.localeCompare(b.name));
      setUsersList(users);

      // Set default selected area for new users
      if (ars.length > 0 && !newUserAreaId) {
        setNewUserAreaId(ars[0].id);
      }
    } catch (err) {
      console.error("Failed to load settings data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    
    await api.createCategory(newCategoryName.trim());
    setNewCategoryName('');
    fetchData();
  };

  const handleDeleteCategory = async (id: string) => {
    await api.deleteCategory(id);
    setDeleteConfirm(null);
    fetchData();
  };

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplierName.trim()) return;
    
    await api.createSupplier(newSupplierName.trim());
    setNewSupplierName('');
    fetchData();
  };

  const handleDeleteSupplier = async (id: string) => {
    await api.deleteSupplier(id);
    setDeleteConfirm(null);
    fetchData();
  };

  const handleAddArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAreaName.trim()) return;
    
    await api.createArea({ 
      name: newAreaName.trim(),
      notificationEmail: newAreaNotificationEmail.trim()
    });
    setNewAreaName('');
    setNewAreaNotificationEmail('');
    fetchData();
  };

  const fetchEmailLogs = async () => {
    setLoadingEmailLogs(true);
    try {
      const logs = await api.getEmailLogs();
      setEmailLogs(logs);
    } catch (err) {
      console.error('Failed to fetch email logs:', err);
    } finally {
      setLoadingEmailLogs(false);
    }
  };

  const handleDeleteArea = async (id: string) => {
    try {
      await api.deleteArea(id);
      setAreas(prev => prev.filter(a => a.id !== id));
      setDeleteConfirm(null);
      fetchData();
    } catch (err) {
      console.error("Failed to delete production area:", err);
      alert("Failed to delete production area.");
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) return;

    await api.createUser({
      name: newUserName.trim(),
      email: newUserEmail.trim(),
      role: newUserRole,
      areaId: newUserRole === 'PRODUCTION' ? (newUserAreaId || null) : null,
      password: newUserPassword.trim() || '',
      accessAllowed: newUserAccessAllowed
    });

    setNewUserName('');
    setNewUserEmail('');
    setNewUserPassword('');
    setNewUserAccessAllowed(true);
    fetchData();
  };

  const handleUpdateUserRole = async (userId: string, targetRole: Role) => {
    await api.updateUser(userId, {
      role: targetRole,
      areaId: targetRole === 'PRODUCTION' ? (newUserAreaId || 'area_1') : null
    });
    fetchData();
  };

  const handleDeleteUser = async (userId: string) => {
    await api.deleteUser(userId);
    setDeleteConfirm(null);
    fetchData();
  };

  if (loading) return <div>Loading settings...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="text-slate-500 mt-1">Manage system configurations.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-6 pb-2">
            <div>
              <CardTitle>Production Areas</CardTitle>
              <p className="text-xs text-slate-500 mt-1">Configure area names &amp; automated notification email targets.</p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                setShowEmailLogs(true);
                fetchEmailLogs();
              }} 
              className="gap-1.5 text-xs border-blue-200 text-blue-700 hover:bg-blue-50 h-8 font-semibold"
            >
              <History className="h-3.5 w-3.5 text-blue-600" />
              Email Logs
            </Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddArea} className="space-y-2 mb-6">
              <div className="flex flex-col sm:flex-row gap-2">
                <Input 
                  required 
                  value={newAreaName} 
                  onChange={e => setNewAreaName(e.target.value)} 
                  placeholder="Area Name (e.g. Shenley Spares)" 
                  className="flex-1 text-xs"
                />
                <Input 
                  type="email"
                  value={newAreaNotificationEmail} 
                  onChange={e => setNewAreaNotificationEmail(e.target.value)} 
                  placeholder="Notification Email (e.g. spares@shenley.co.uk)" 
                  className="flex-1 text-xs"
                />
                <Button type="submit" className="text-xs font-semibold whitespace-nowrap">Add Area</Button>
              </div>
            </form>
            
            <div className="space-y-2.5">
              {areas.map(area => (
                <div key={area.id} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-150 rounded-lg hover:border-slate-300 transition-colors">
                  <div className="space-y-1">
                    <span className="font-bold text-slate-900 text-xs block">{area.name}</span>
                    {area.notificationEmail ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                        <Mail className="h-3 w-3 text-blue-500" />
                        {area.notificationEmail}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 italic">
                        <Mail className="h-3 w-3 text-slate-300" /> No notification email set
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 h-7 px-2 text-xs gap-1"
                      onClick={() => setEditingArea(area)}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    {deleteConfirm?.type === 'area' && deleteConfirm.id === area.id ? (
                      <div className="flex gap-1.5">
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          onClick={() => handleDeleteArea(area.id)}
                          className="text-xs h-7 py-0 px-2 font-semibold"
                        >
                          Confirm
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setDeleteConfirm(null)}
                          className="text-xs h-7 py-0 px-2 text-slate-500 hover:bg-slate-100"
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 w-7 p-0"
                        onClick={() => setDeleteConfirm({ type: 'area', id: area.id })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {areas.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">No areas defined yet.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-6 pb-2">
            <CardTitle>Product Categories</CardTitle>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowCategoryModal(true)} 
              className="gap-1.5 text-xs border-emerald-250 text-emerald-700 hover:bg-emerald-50 h-8 font-semibold"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              Import CSV
            </Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddCategory} className="flex gap-2 mb-6">
              <Input 
                required 
                value={newCategoryName} 
                onChange={e => setNewCategoryName(e.target.value)} 
                placeholder="New Category Name" 
              />
              <Button type="submit">Add</Button>
            </form>
            
            <div className="space-y-2">
              {categories.map(category => (
                <div key={category.id} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-md">
                  <span className="font-medium text-slate-900">{category.name}</span>
                  {deleteConfirm?.type === 'category' && deleteConfirm.id === category.id ? (
                    <div className="flex gap-1.5">
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={() => handleDeleteCategory(category.id)}
                        className="text-xs h-7 py-0 px-2 font-semibold"
                      >
                        Confirm
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setDeleteConfirm(null)}
                        className="text-xs h-7 py-0 px-2 text-slate-500 hover:bg-slate-100"
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => setDeleteConfirm({ type: 'category', id: category.id })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              {categories.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">No categories defined yet.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-6 pb-2">
            <CardTitle>Suppliers</CardTitle>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowSupplierModal(true)} 
              className="gap-1.5 text-xs border-emerald-250 text-emerald-700 hover:bg-emerald-50 h-8 font-semibold"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              Import CSV
            </Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddSupplier} className="flex gap-2 mb-6">
              <Input 
                required 
                value={newSupplierName} 
                onChange={e => setNewSupplierName(e.target.value)} 
                placeholder="New Supplier Name" 
              />
              <Button type="submit">Add</Button>
            </form>
            
            <div className="space-y-2">
              {suppliers.map(supplier => (
                <div key={supplier.id} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-md">
                  <span className="font-medium text-slate-900">{supplier.name}</span>
                  {deleteConfirm?.type === 'supplier' && deleteConfirm.id === supplier.id ? (
                    <div className="flex gap-1.5">
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={() => handleDeleteSupplier(supplier.id)}
                        className="text-xs h-7 py-0 px-2 font-semibold"
                      >
                        Confirm
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setDeleteConfirm(null)}
                        className="text-xs h-7 py-0 px-2 text-slate-500 hover:bg-slate-100"
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => setDeleteConfirm({ type: 'supplier', id: supplier.id })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              {suppliers.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">No suppliers defined yet.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Admin Account Settings Card */}
        <Card className="col-span-1 md:col-span-2 border-slate-200 shadow-sm">
          <CardHeader className="bg-slate-50/50 border-b border-slate-150 p-6">
            <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Users className="h-5 w-5 text-slate-500" /> Account Settings &amp; Role Management
            </CardTitle>
            <p className="text-xs text-slate-500 mt-1">
              Create, delete, and configure system roles. Changes propagate to live user profiles in real-time.
            </p>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            
             {/* Form to Create New Account */}
            <div className="bg-slate-50 border border-slate-150 rounded-xl p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3 flex items-center gap-1.5">
                <UserPlus className="h-4 w-4 text-slate-400" /> Register New Account Profile
              </h3>
              <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 items-end">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">Full Name</label>
                  <Input
                    required
                    value={newUserName}
                    onChange={e => setNewUserName(e.target.value)}
                    placeholder="Sarah Jenkins"
                    className="text-xs bg-white h-9"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">Email Address</label>
                  <Input
                    required
                    type="email"
                    value={newUserEmail}
                    onChange={e => setNewUserEmail(e.target.value)}
                    placeholder="sarah@warehouse.co"
                    className="text-xs bg-white h-9"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">Password / Pin</label>
                  <div className="relative">
                    <Input
                      type={showNewUserPassword ? "text" : "password"}
                      value={newUserPassword}
                      onChange={e => setNewUserPassword(e.target.value)}
                      placeholder="e.g. 1234 or pwd123"
                      className="text-xs bg-white h-9 pr-8"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewUserPassword(!showNewUserPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      {showNewUserPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700">Role Authority</label>
                  <select
                    value={newUserRole}
                    onChange={e => setNewUserRole(e.target.value as Role)}
                    className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 h-9"
                  >
                    <option value="PRODUCTION">Production Worker</option>
                    <option value="PRODUCTION_ENGINEERING">Production Engineering</option>
                    <option value="LOGISTICS">Logistics Admin</option>
                  </select>
                </div>
                
                {newUserRole === 'PRODUCTION' ? (
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700">Assigned Area</label>
                    <select
                      value={newUserAreaId}
                      onChange={e => setNewUserAreaId(e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 h-9"
                    >
                      {areas.map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700">App Access</label>
                    <select
                      value={newUserAccessAllowed ? 'true' : 'false'}
                      onChange={e => setNewUserAccessAllowed(e.target.value === 'true')}
                      className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 h-9"
                    >
                      <option value="true">Access Allowed</option>
                      <option value="false">Access Revoked</option>
                    </select>
                  </div>
                )}
                
                {newUserRole === 'PRODUCTION' && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-700">App Access</label>
                    <select
                      value={newUserAccessAllowed ? 'true' : 'false'}
                      onChange={e => setNewUserAccessAllowed(e.target.value === 'true')}
                      className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400 h-9"
                    >
                      <option value="true">Access Allowed</option>
                      <option value="false">Access Revoked</option>
                    </select>
                  </div>
                )}

                <div className="col-span-1 sm:col-span-2 md:col-span-3 lg:col-span-5 flex justify-end">
                  <Button type="submit" className="text-xs font-semibold h-9 bg-slate-900 hover:bg-slate-800 px-6">
                    Create Account
                  </Button>
                </div>
              </form>
            </div>

            {/* List of Registered Accounts */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">Active Profile Registries</h3>
              <div className="border border-slate-100 rounded-xl overflow-hidden bg-white">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-semibold text-[10px] uppercase tracking-wider border-b border-slate-100">
                      <th className="py-3 px-4">User Identity</th>
                      <th className="py-3 px-4">Contact Info</th>
                      <th className="py-3 px-4">Password / Pin</th>
                      <th className="py-3 px-4">Current Role Authority</th>
                      <th className="py-3 px-4">Area Context</th>
                      <th className="py-3 px-4">App Access</th>
                      <th className="py-3 px-4 text-right">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {usersList.map((usr) => (
                      <tr key={usr.id} className="hover:bg-slate-50/40 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-800">
                          {usr.name}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 font-medium">
                          {usr.email}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <Lock className="h-3.5 w-3.5 text-slate-400" />
                            <div className="relative flex items-center">
                              <Input
                                type={showPasswords[usr.id] ? "text" : "password"}
                                value={usr.password || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setUsersList(prev => prev.map(u => u.id === usr.id ? { ...u, password: val } : u));
                                }}
                                onBlur={async (e) => {
                                  await api.updateUser(usr.id, { password: e.target.value.trim() });
                                }}
                                placeholder="No password"
                                className="text-xs bg-white h-7 py-0.5 pl-2 pr-7 w-28 font-mono"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPasswords(prev => ({ ...prev, [usr.id]: !prev[usr.id] }))}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                              >
                                {showPasswords[usr.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <select
                            value={usr.role}
                            onChange={(e) => handleUpdateUserRole(usr.id, e.target.value as Role)}
                            className="text-xs rounded-md border border-slate-200 px-2.5 py-1 bg-white font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400"
                          >
                            <option value="LOGISTICS">Logistics Admin</option>
                            <option value="PRODUCTION_ENGINEERING">Production Engineering</option>
                            <option value="PRODUCTION">Production Worker</option>
                          </select>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {usr.role === 'PRODUCTION' ? (
                            <select
                              value={usr.areaId || ''}
                              onChange={async (e) => {
                                await api.updateUser(usr.id, { areaId: e.target.value });
                                fetchData();
                              }}
                              className="text-xs rounded-md border border-slate-200 px-2 py-1 bg-white text-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-400"
                            >
                              <option value="">None</option>
                              {areas.map(a => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-slate-350 italic font-medium">Full Access</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <select
                            value={usr.accessAllowed !== false ? 'true' : 'false'}
                            onChange={async (e) => {
                              await api.updateUser(usr.id, { accessAllowed: e.target.value === 'true' });
                              fetchData();
                            }}
                            className={`text-xs rounded-md border px-2 py-1 font-semibold focus:outline-none focus:ring-1 focus:ring-slate-400 ${
                              usr.accessAllowed !== false 
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                                : 'bg-rose-50 text-rose-800 border-rose-200'
                            }`}
                          >
                            <option value="true">Allowed</option>
                            <option value="false">Revoked</option>
                          </select>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {deleteConfirm?.type === 'user' && deleteConfirm.id === usr.id ? (
                            <div className="flex justify-end gap-1.5 items-center">
                              <span className="text-[10px] text-amber-700 font-bold">Sure?</span>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteUser(usr.id)}
                                className="text-[10px] h-6 py-0 px-2 font-bold"
                              >
                                Yes
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setDeleteConfirm(null)}
                                className="text-[10px] h-6 py-0 px-2"
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 w-7 p-0"
                              onClick={() => setDeleteConfirm({ type: 'user', id: usr.id })}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {usersList.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400 text-xs font-medium">
                          No active account profiles found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {showSupplierModal && (
        <SupplierCSVImportModal 
          onClose={() => setShowSupplierModal(false)}
          onImportComplete={() => {
            setShowSupplierModal(false);
            fetchData();
          }}
          existingSuppliers={suppliers}
        />
      )}

      {showCategoryModal && (
        <CategoryCSVImportModal 
          onClose={() => setShowCategoryModal(false)}
          onImportComplete={() => {
            setShowCategoryModal(false);
            fetchData();
          }}
          existingCategories={categories}
        />
      )}

      {editingArea && (
        <EditAreaModal 
          area={editingArea}
          onClose={() => {
            setEditingArea(null);
            fetchData();
          }}
        />
      )}

      {/* Email Notification Audit Logs Modal */}
      {showEmailLogs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl bg-white rounded-xl shadow-xl flex flex-col max-h-[85vh] border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-150 bg-slate-50">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-blue-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-800">Automated Order Notification Logs</h3>
                  <p className="text-xs text-slate-500">History of automated order notification emails dispatched to area email addresses.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowEmailLogs(false)}
                className="p-1.5 rounded-lg hover:bg-slate-200/60 text-slate-500 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-start gap-2.5">
                <Mail className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-bold">Email Delivery Note:</span> System sends emails using standard SMTP/Nodemailer. When running in dev/sandbox mode without configured SMTP credentials (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`), emails are safely delivered to a sandbox web inbox with instant live HTML previews!
                </div>
              </div>

              {loadingEmailLogs ? (
                <div className="text-center py-12 text-slate-500 text-xs">Loading email logs...</div>
              ) : emailLogs.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs space-y-2">
                  <Mail className="h-8 w-8 mx-auto text-slate-300" />
                  <p className="font-semibold text-slate-600">No automated email dispatches recorded yet.</p>
                  <p className="max-w-md mx-auto text-slate-400">
                    When a production worker places an order for an area with a configured email address, automated order emails and audit entries will appear here.
                  </p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-semibold text-[10px] uppercase tracking-wider border-b border-slate-200">
                        <th className="py-3 px-4">Dispatched At</th>
                        <th className="py-3 px-4">Production Area</th>
                        <th className="py-3 px-4">Recipient Email Target</th>
                        <th className="py-3 px-4">Items Count</th>
                        <th className="py-3 px-4">Total Value</th>
                        <th className="py-3 px-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {emailLogs.map((log: any) => (
                        <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                            {log.sentAt ? new Date(log.sentAt).toLocaleString() : 'N/A'}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-800">
                            {log.areaName || 'Unknown Area'}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              <Mail className="h-3 w-3 text-blue-500" />
                              {log.recipientEmail}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-700 font-medium">
                            {log.itemsCount || (log.items ? log.items.reduce((s: any, i: any) => s + (i.quantity || 1), 0) : 0)} items
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900">
                            £{(log.totalCost || 0).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              {log.status || 'DISPATCHED'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-150 bg-slate-50 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setShowEmailLogs(false)}>
                Close History
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
