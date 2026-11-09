import React, { useState } from 'react';
import { api } from '../lib/api';
import { Area } from '../types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { X } from 'lucide-react';
import * as Icons from 'lucide-react';

interface EditAreaModalProps {
  area: Area;
  onClose: () => void;
  onUpdated?: () => void;
}

const PRESET_ICONS = [
  { name: 'Wrench', label: 'Wrench' },
  { name: 'Flame', label: 'Welding/Flame' },
  { name: 'Truck', label: 'Logistics' },
  { name: 'Shield', label: 'Safety' },
  { name: 'Hammer', label: 'Tooling' },
  { name: 'Paintbrush', label: 'Paint' },
  { name: 'Warehouse', label: 'Warehouse' },
  { name: 'Package', label: 'Packaging' }
];

const PRESET_COLORS = [
  { key: 'blue', label: 'Blue Theme', border: 'border-blue-400', bg: 'bg-blue-500' },
  { key: 'red', label: 'Red Theme', border: 'border-red-400', bg: 'bg-red-500' },
  { key: 'green', label: 'Green Theme', border: 'border-green-400', bg: 'bg-green-500' },
  { key: 'amber', label: 'Amber Theme', border: 'border-amber-400', bg: 'bg-amber-500' },
  { key: 'purple', label: 'Purple Theme', border: 'border-purple-400', bg: 'bg-purple-500' },
  { key: 'slate', label: 'Slate Theme', border: 'border-slate-400', bg: 'bg-slate-500' }
];

export function DynamicIcon({ name, className = "h-5 w-5" }: { name: string; className?: string }) {
  // @ts-ignore
  const IconComponent = Icons[name];
  if (!IconComponent) {
    return <Icons.MapPin className={className} />;
  }
  return <IconComponent className={className} />;
}

export default function EditAreaModal({ area, onClose, onUpdated }: EditAreaModalProps) {
  const [name, setName] = useState(area.name);
  const [description, setDescription] = useState(area.description || '');
  const [notificationEmail, setNotificationEmail] = useState(area.notificationEmail || '');
  const [imageUrl, setImageUrl] = useState(area.imageUrl || '');
  const [color, setColor] = useState(area.color || 'blue');
  const [icon, setIcon] = useState(area.icon || 'Wrench');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Area Name is required.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await api.updateArea(area.id, {
        name: name.trim(),
        description: description.trim(),
        notificationEmail: notificationEmail.trim(),
        imageUrl: imageUrl.trim(),
        color,
        icon
      });
      if (onUpdated) onUpdated();
      onClose();
    } catch (err: any) {
      console.error('Failed to update area configuration:', err);
      setError(err.message || 'Failed to save area updates. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-xl flex flex-col max-h-[90vh] border border-slate-100 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-150 bg-slate-50">
          <div>
            <h3 className="text-base font-bold text-slate-800">Edit Area Display Button</h3>
            <p className="text-xs text-slate-500">Configure visual appearance for "{area.name}" area selection card.</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-lg hover:bg-slate-200/60 text-slate-500 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-semibold flex items-center gap-2">
              <X className="h-4 w-4" />
              {error}
            </div>
          )}

          {/* Area Name */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Area Name</label>
            <Input 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="e.g. Welding Room"
              required 
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Description / Message</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Provide a description or safety rules for this area..."
              className="w-full min-h-[70px] text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>

          {/* Automated Order Notification Email */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Automated Notification Email</label>
              <span className="text-[10px] text-slate-400 font-medium">Receives order alerts</span>
            </div>
            <Input 
              type="email"
              value={notificationEmail} 
              onChange={e => setNotificationEmail(e.target.value)} 
              placeholder="e.g. line-lead@factory.local"
              className="text-xs"
            />
          </div>

          {/* Theme Color */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Theme Highlights</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map(c => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setColor(c.key)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all ${
                    color === c.key 
                      ? `${c.border} bg-white text-slate-800 shadow-sm ring-1 ring-slate-300` 
                      : 'border-slate-150 bg-slate-50/50 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${c.bg}`}></span>
                  {c.label.replace(' Theme', '')}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Icon */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Visual Icon</label>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_ICONS.map(i => {
                const isSelected = icon === i.name;
                return (
                  <button
                    key={i.name}
                    type="button"
                    onClick={() => setIcon(i.name)}
                    className={`p-2.5 rounded-lg border flex flex-col items-center justify-center gap-1 transition-all text-center ${
                      isSelected 
                        ? 'border-slate-800 bg-slate-50 text-slate-800 font-semibold shadow-sm' 
                        : 'border-slate-150 bg-white text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <DynamicIcon name={i.name} className="h-4 w-4" />
                    <span className="text-[10px] tracking-tight">{i.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Image Path */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Local Image Asset Path (Optional)</label>
              <span className="text-[10px] text-slate-400 font-medium">Leave blank for clean vector badge</span>
            </div>
            <Input 
              value={imageUrl} 
              onChange={e => setImageUrl(e.target.value)} 
              placeholder="/assets/area-assembly.jpg" 
              className="text-xs"
            />
          </div>

          {/* Action buttons */}
          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2.5">
            <Button variant="outline" size="sm" type="button" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Card Settings'}
            </Button>
          </div>
        </form>

      </div>
    </div>
  );
}
