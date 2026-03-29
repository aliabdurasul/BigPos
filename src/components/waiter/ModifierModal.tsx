import { useState, useMemo } from 'react';
import { MenuItem, ModifierGroup, OrderItemModifier } from '@/types/pos';
import { Minus, Plus, X } from 'lucide-react';

interface ModifierProps {
  item: MenuItem;
  modifierGroups: ModifierGroup[];
  productModifierMap: Map<string, string[]>;
  onConfirm: (modifiers: OrderItemModifier[], note: string, quantity: number) => void;
  onCancel: () => void;
}

function useModifierState(item: MenuItem, modifierGroups: ModifierGroup[], productModifierMap: Map<string, string[]>) {
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

  const buildModifiers = (): OrderItemModifier[] => {
    const modifiers: OrderItemModifier[] = [];
    for (const group of modifierGroups) {
      const selected = selectedModifiers[group.id] || [];
      for (const optId of selected) {
        const opt = group.options.find(o => o.id === optId);
        if (opt) modifiers.push({ groupName: group.name, optionName: opt.name, extraPrice: opt.extraPrice });
      }
    }
    return modifiers;
  };

  return { selectedModifiers, itemNote, setItemNote, quantity, setQuantity, visibleGroups, lineTotal, toggleModifier, buildModifiers };
}

/** Desktop: compact inline panel rendered inside product grid */
export default function InlineModifiers({ item, modifierGroups, productModifierMap, onConfirm, onCancel }: ModifierProps) {
  const { selectedModifiers, itemNote, setItemNote, quantity, setQuantity, visibleGroups, lineTotal, toggleModifier, buildModifiers } =
    useModifierState(item, modifierGroups, productModifierMap);

  return (
    <div className="bg-card border rounded-md p-3 space-y-2.5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-bold text-sm">{item.name}</span>
          <span className="text-primary font-semibold text-sm ml-2">{item.price} ₺</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-7 h-7 rounded bg-muted flex items-center justify-center pos-btn">
            <Minus className="w-3 h-3" />
          </button>
          <span className="text-sm font-bold w-5 text-center tabular-nums">{quantity}</span>
          <button onClick={() => setQuantity(q => q + 1)} className="w-7 h-7 rounded bg-primary text-primary-foreground flex items-center justify-center pos-btn">
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      {visibleGroups.map(group => (
        <div key={group.id}>
          <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">{group.name}</h4>
          <div className="flex flex-wrap gap-1">
            {group.options.map(opt => {
              const isSelected = (selectedModifiers[group.id] || []).includes(opt.id);
              return (
                <button
                  key={opt.id}
                  onClick={() => toggleModifier(group.id, opt.id, group.type)}
                  className={`px-2 py-1 rounded text-xs font-medium border pos-btn ${
                    isSelected ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/30 hover:bg-muted'
                  }`}
                >
                  {opt.name}{opt.extraPrice > 0 && ` +${opt.extraPrice}₺`}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <input
        value={itemNote}
        onChange={e => setItemNote(e.target.value)}
        placeholder="Not ekle..."
        className="w-full px-2.5 py-1.5 rounded border bg-muted/30 text-xs"
      />

      <div className="flex gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 rounded bg-muted text-xs font-semibold pos-btn">İptal</button>
        <button
          onClick={() => onConfirm(buildModifiers(), itemNote, quantity)}
          className="flex-1 py-1.5 rounded bg-primary text-primary-foreground text-xs font-bold pos-btn flex items-center justify-center gap-1"
        >
          <span>Ekle</span>
          <span className="opacity-80">·</span>
          <span>{lineTotal.toFixed(2)} ₺</span>
        </button>
      </div>
    </div>
  );
}

/** Mobile: bottom sheet that slides up from the bottom */
export function BottomSheetModifiers({ item, modifierGroups, productModifierMap, onConfirm, onCancel }: ModifierProps) {
  const { selectedModifiers, itemNote, setItemNote, quantity, setQuantity, visibleGroups, lineTotal, toggleModifier, buildModifiers } =
    useModifierState(item, modifierGroups, productModifierMap);

  return (
    <div className="fixed inset-0 z-50 animate-fade-in" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="absolute bottom-0 left-0 right-0 bg-card rounded-t-2xl shadow-lg animate-slide-up max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="px-4 pb-3 border-b flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">{item.name}</h3>
            <p className="text-primary font-semibold">{item.price} ₺</p>
          </div>
          <button onClick={onCancel} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-5">
          {/* Quantity */}
          <div>
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Adet</h4>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center pos-btn touch-manipulation active:scale-95"
              >
                <Minus className="w-5 h-5" />
              </button>
              <span className="text-2xl font-bold w-10 text-center tabular-nums">{quantity}</span>
              <button
                onClick={() => setQuantity(q => q + 1)}
                className="w-12 h-12 rounded-lg bg-primary text-primary-foreground flex items-center justify-center pos-btn touch-manipulation active:scale-95"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modifier groups */}
          {visibleGroups.map(group => (
            <div key={group.id}>
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{group.name}</h4>
              <div className="space-y-2">
                {group.options.map(opt => {
                  const isSelected = (selectedModifiers[group.id] || []).includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      onClick={() => toggleModifier(group.id, opt.id, group.type)}
                      className={`w-full flex items-center justify-between px-4 py-3.5 rounded-lg text-sm font-medium border touch-manipulation min-h-[48px] ${
                        isSelected ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-muted/30'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <span className={`w-5 h-5 border-2 flex items-center justify-center ${
                          group.type === 'radio' ? 'rounded-full' : 'rounded'
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
              className="w-full px-4 py-3.5 rounded-lg border bg-muted/30 text-sm min-h-[48px]"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex gap-3 shrink-0">
          <button onClick={onCancel} className="py-3.5 px-6 rounded-lg bg-muted font-semibold text-sm pos-btn touch-manipulation min-h-[48px]">
            İptal
          </button>
          <button
            onClick={() => onConfirm(buildModifiers(), itemNote, quantity)}
            className="flex-1 py-3.5 rounded-lg bg-primary text-primary-foreground font-bold text-sm pos-btn touch-manipulation min-h-[48px] flex items-center justify-center gap-2"
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
