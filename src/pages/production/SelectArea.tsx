import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../components/AuthContext';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Edit3, MapPin, Grid, Layers, ExternalLink, Shield } from 'lucide-react';
import EditAreaModal, { DynamicIcon } from '../../components/EditAreaModal';
import { Area } from '../../types';

export default function SelectArea() {
  const { availableAreas, profile, setActiveArea } = useAuth();
  const navigate = useNavigate();
  const [editingArea, setEditingArea] = useState<Area | null>(null);

  const handleSelectArea = (id: string) => {
    setActiveArea(id);
    navigate('/');
  };

  const getThemeClasses = (color?: string) => {
    switch (color) {
      case 'red':
        return {
          bg: 'bg-red-50 text-red-700 hover:bg-red-100/50',
          badge: 'bg-red-100 text-red-800 border-red-200',
          accent: 'border-red-500',
          solid: 'bg-red-500'
        };
      case 'green':
        return {
          bg: 'bg-green-50 text-green-700 hover:bg-green-100/50',
          badge: 'bg-green-100 text-green-800 border-green-200',
          accent: 'border-green-500',
          solid: 'bg-green-500'
        };
      case 'amber':
        return {
          bg: 'bg-amber-50 text-amber-700 hover:bg-amber-100/50',
          badge: 'bg-amber-100 text-amber-800 border-amber-200',
          accent: 'border-amber-500',
          solid: 'bg-amber-500'
        };
      case 'purple':
        return {
          bg: 'bg-purple-50 text-purple-700 hover:bg-purple-100/50',
          badge: 'bg-purple-100 text-purple-800 border-purple-200',
          accent: 'border-purple-500',
          solid: 'bg-purple-500'
        };
      case 'slate':
        return {
          bg: 'bg-slate-50 text-slate-700 hover:bg-slate-100/50',
          badge: 'bg-slate-100 text-slate-800 border-slate-200',
          accent: 'border-slate-500',
          solid: 'bg-slate-500'
        };
      case 'blue':
      default:
        return {
          bg: 'bg-blue-50 text-blue-700 hover:bg-blue-100/50',
          badge: 'bg-blue-100 text-blue-800 border-blue-200',
          accent: 'border-blue-500',
          solid: 'bg-blue-500'
        };
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8 animate-fade-in">
      
      {/* Title block */}
      <div className="text-center space-y-2 max-w-xl mx-auto">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 border border-slate-200 text-slate-600 rounded-full text-xs font-semibold">
          <Grid className="h-3.5 w-3.5" /> Department Selection Dashboard
        </div>
        <h2 className="text-2xl font-bold text-slate-800">Select Production Area</h2>
        <p className="text-sm text-slate-500">
          Choose which production workspace form catalog you would like to view consumables for. Stores can edit card images, descriptions, and highlights on the fly!
        </p>
      </div>

      {/* Grid of Areas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {availableAreas.map((area) => {
          const theme = getThemeClasses(area.color);
          const isSelected = profile?.areaId === area.id;

          return (
            <Card 
              key={area.id} 
              className={`group relative flex flex-col justify-between overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.01] hover:shadow-md border-2 ${
                isSelected ? `${theme.accent} ring-1 ring-offset-1 ring-slate-200` : 'border-slate-150 hover:border-slate-300'
              }`}
            >
              
              {/* Card Image Background or Placeholder */}
              <div className="relative h-40 bg-slate-100 border-b border-slate-100 overflow-hidden">
                {area.imageUrl ? (
                  <img 
                    src={area.imageUrl} 
                    alt={area.name} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200/60 flex items-center justify-center text-slate-300">
                    <Layers className="h-12 w-12" />
                  </div>
                )}
                
                {/* Image Overlay Gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                
                {/* Edit Button in Top-Right */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingArea(area);
                  }}
                  className="absolute top-3.5 right-3.5 z-10 p-2 rounded-lg bg-white/90 hover:bg-white text-slate-700 shadow-sm transition-all flex items-center gap-1 text-[11px] font-bold"
                >
                  <Edit3 className="h-3.5 w-3.5" /> Edit Button
                </button>

                {/* Tag/Color badge */}
                <span className={`absolute top-3.5 left-3.5 z-10 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${theme.badge} shadow-sm`}>
                  {area.color || 'blue'} line
                </span>

                {/* Bottom title overlapping the image */}
                <div className="absolute bottom-4 left-4 right-4 text-white flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-lg ${theme.solid} text-white shadow-sm flex-shrink-0`}>
                    <DynamicIcon name={area.icon || 'Wrench'} className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold truncate leading-snug">{area.name}</h3>
                  </div>
                </div>
              </div>

              {/* Card Description & Body Content */}
              <CardContent className="p-4 flex-1 flex flex-col justify-between space-y-4 bg-white">
                <p className="text-xs text-slate-500 min-h-[40px] line-clamp-2">
                  {area.description || 'No custom description provided yet. Click the Edit Button above to add images, icons, and instructions for this area.'}
                </p>

                {/* Quick actions row */}
                <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="text-[11px] text-slate-400 font-medium">
                    {isSelected ? 'Currently Selected' : 'Available'}
                  </span>
                  <Button 
                    size="sm" 
                    onClick={() => handleSelectArea(area.id)}
                    variant={isSelected ? 'outline' : 'default'}
                    className="h-8 text-xs font-semibold flex items-center gap-1.5"
                  >
                    Select {area.name} <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>

            </Card>
          );
        })}
      </div>

      {/* Manage/Create instruction */}
      <div className="p-4 rounded-xl border border-slate-150 bg-slate-50 text-center text-xs text-slate-500 max-w-xl mx-auto flex items-center justify-center gap-2">
        <Shield className="h-4 w-4 text-slate-400" />
        <span>To create new production areas or delete existing ones, go to the <strong>Logistics - Settings</strong> page.</span>
      </div>

      {/* Edit Area Modal */}
      {editingArea && (
        <EditAreaModal 
          area={editingArea}
          onClose={() => setEditingArea(null)}
        />
      )}

    </div>
  );
}
