import { useState, useMemo } from 'react';
import { MenuItem, ModifierGroup, OrderItemModifier } from '@/types/pos';
import { Minus, Plus } from 'lucide-react';

interface ModifierModalProps {
  item: MenuItem;
  modifierGroups: ModifierGroup[];
  productModifierMap: Map<string, string[]>;
  onConfirm: (modifiers: OrderItemModifier[], note: string, quantity: number) => void;
  onCancel: () => void;
}

export default function ModifierModal({ item, modifierGroups, productModifierMap, onConfirm, onCancel }: ModifierModalProps) {
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string[]>>({});
  const [itemNote, setItemNote] = useState('');
  const [quantity, setQuantity] = useState(1);

  const linkedGroups = productModifierMap.get(item.id) || [];
  const visibleGroups = linkedGroups.length > 0
    ? modifierGroups.filter(group => linkedGroups.includes(group.id))
    : [];

  const modifierExtra = useMemo(() => {
    let extra = 0;
    for (const group of modifierGroups) {
      const selected = selectedModifiers[group.id] || [];
      for (const optId of selected) {
        const opt = group.options.find(o => o.id === optId);
        if (opt) extra += opt.extraPrice;
      }
    }
    return extra;
  }, [selectedModifiers, modifierGroups]);

  const unitPrice = item.price + modifierExtra;
  const lineTotal = unitPrice * quantity;

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
    onConfirm(modifiers, itemNote, quantity);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 animate-fade-in flex items-end sm:items-center justify-center" onClick={onCancel}>
      <div
        className="bg-card w-full sm:max-w-md sm:mx-4 sm:rounded-2xl rounded-t-2xl shadow-2xl animate-slide-up overflow-hidden max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-2 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="px-4 pt-2 pb-3 border-b bg-primary/5">
          <h3 className="text-lg font-black">{item.name}</h3>
          <p className="text-primary font-bold">{item.price} ₺</p>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4">
          {/* Quantity selector */}
          <div>
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Adet</h4>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center pos-btn touch-manipulation active:scale-95"
              >
                <Minus className="w-5 h-5" />
              </button>
              <span className="text-2xl font-black w-10 text-center tabular-nums">{quantity}</span>
              <button
                onClick={() => setQuantity(q => q + 1)}
                className="w-11 h-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center pos-btn touch-manipulation active:scale-95"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modifier groups */}
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
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium pos-btn border-2 touch-manipulation min-h-[44px] ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-transparent bg-muted/50 hover:bg-muted'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className={`w-5 h-5 border-2 flex items-center justify-center ${
                          group.type === 'radio' ? 'rounded-full' : 'rounded-md'
                        } ${isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/30'}`}>
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

          {/* Note */}
          <div>
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Not</h4>
            <input
              value={itemNote}
              onChange={e => setItemNote(e.target.value)}
              placeholder="Örn: Az pişmiş, extra sos..."
              className="w-full px-4 py-3 rounded-xl border bg-muted/30 text-sm min-h-[44px]"
            />
          </div>
        </div>

        {/* Footer with live total */}
        <div className="p-4 border-t flex gap-2 shrink-0">
          <button onClick={onCancel} className="py-3 px-5 rounded-xl bg-muted font-semibold text-sm pos-btn touch-manipulation min-h-[48px]">
            İptal
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm pos-btn shadow-lg shadow-primary/20 touch-manipulation min-h-[48px] flex items-center justify-center gap-2"
          >
            <span>Ekle</span>
            <span className="opacity-80">·</span>
            <span>{lineTotal.toFixed(2)} ₺</span>
          </button>
        </div>
      </div>
    </div>
  );
}
