import { useState } from 'react';
import { MenuItem, ModifierGroup, OrderItemModifier } from '@/types/pos';

interface ModifierModalProps {
  item: MenuItem;
  modifierGroups: ModifierGroup[];
  productModifierMap: Map<string, string[]>;
  onConfirm: (modifiers: OrderItemModifier[], note: string) => void;
  onCancel: () => void;
}

export default function ModifierModal({ item, modifierGroups, productModifierMap, onConfirm, onCancel }: ModifierModalProps) {
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string[]>>({});
  const [itemNote, setItemNote] = useState('');

  const linkedGroups = productModifierMap.get(item.id);
  const visibleGroups = modifierGroups.filter(group =>
    !linkedGroups || linkedGroups.length === 0 || linkedGroups.includes(group.id)
  );

  const toggleModifier = (groupId: string, optionId: string, type: 'checkbox' | 'radio') => {
    setSelectedModifiers(prev => {
      const current = prev[groupId] || [];
      if (type === 'radio') return { ...prev, [groupId]: [optionId] };
      return { ...prev, [groupId]: current.includes(optionId) ? current.filter(id => id !== optionId) : [...current, optionId] };
    });
  };

  const handleConfirm = () => {
    const modifiers: OrderItemModifier[] = [];
    for (const group of modifierGroups) {
      const selected = selectedModifiers[group.id] || [];
      for (const optId of selected) {
        const opt = group.options.find(o => o.id === optId);
        if (opt) modifiers.push({ groupName: group.name, optionName: opt.name, extraPrice: opt.extraPrice });
      }
    }
    onConfirm(modifiers, itemNote);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fade-in" onClick={onCancel}>
      <div className="bg-card rounded-2xl w-full max-w-md mx-4 shadow-2xl animate-slide-up overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b bg-primary/5">
          <h3 className="text-lg font-black">{item.name}</h3>
          <p className="text-primary font-bold">{item.price} ₺</p>
        </div>
        <div className="p-4 space-y-4 max-h-[50vh] overflow-y-auto">
          {visibleGroups.map(group => (
            <div key={group.id}>
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{group.name}</h4>
              <div className="space-y-1.5">
                {group.options.map(opt => {
                  const isSelected = (selectedModifiers[group.id] || []).includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      onClick={() => toggleModifier(group.id, opt.id, group.type)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium pos-btn border-2 ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-transparent bg-muted/50 hover:bg-muted'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-${group.type === 'radio' ? 'full' : 'md'} border-2 flex items-center justify-center ${
                          isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                        }`}>
                          {isSelected && <span className="w-2 h-2 rounded-full bg-primary-foreground" />}
                        </span>
                        {opt.name}
                      </span>
                      {opt.extraPrice > 0 && <span className="text-xs font-bold">+{opt.extraPrice} ₺</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div>
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Not</h4>
            <input
              value={itemNote}
              onChange={e => setItemNote(e.target.value)}
              placeholder="Örn: Az pişmiş, extra sos..."
              className="w-full px-4 py-3 rounded-xl border bg-muted/30 text-sm"
            />
          </div>
        </div>
        <div className="p-4 border-t flex gap-2">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl bg-muted font-semibold text-sm pos-btn">
            İptal
          </button>
          <button onClick={handleConfirm} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm pos-btn shadow-lg shadow-primary/20">
            Siparişe Ekle
          </button>
        </div>
      </div>
    </div>
  );
}
