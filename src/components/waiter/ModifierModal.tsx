import { useState, useMemo } from 'react';
import { MenuItem, ModifierGroup, OrderItemModifier } from '@/types/pos';
import { Minus, Plus } from 'lucide-react';

interface InlineModifiersProps {
  item: MenuItem;
  modifierGroups: ModifierGroup[];
  productModifierMap: Map<string, string[]>;
  onConfirm: (modifiers: OrderItemModifier[], note: string, quantity: number) => void;
  onCancel: () => void;
}

export default function InlineModifiers({ item, modifierGroups, productModifierMap, onConfirm, onCancel }: InlineModifiersProps) {
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
    <div className="bg-card border rounded-md p-3 space-y-3">
      {/* Header + Quantity */}
      <div className="flex items-center justify-between">
        <div>
          <span className="font-bold text-sm">{item.name}</span>
          <span className="text-primary font-semibold text-sm ml-2">{item.price} ₺</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-8 h-8 rounded bg-muted flex items-center justify-center pos-btn">
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="text-sm font-bold w-6 text-center tabular-nums">{quantity}</span>
          <button onClick={() => setQuantity(q => q + 1)} className="w-8 h-8 rounded bg-primary text-primary-foreground flex items-center justify-center pos-btn">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Modifier groups — compact chips */}
      {visibleGroups.map(group => (
        <div key={group.id}>
          <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">{group.name}</h4>
          <div className="flex flex-wrap gap-1.5">
            {group.options.map(opt => {
              const isSelected = (selectedModifiers[group.id] || []).includes(opt.id);
              return (
                <button
                  key={opt.id}
                  onClick={() => toggleModifier(group.id, opt.id, group.type)}
                  className={`px-2.5 py-1.5 rounded text-xs font-medium border pos-btn ${
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-muted/30 hover:bg-muted'
                  }`}
                >
                  {opt.name}{opt.extraPrice > 0 && ` +${opt.extraPrice}₺`}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Note */}
      <input
        value={itemNote}
        onChange={e => setItemNote(e.target.value)}
        placeholder="Not ekle..."
        className="w-full px-3 py-2 rounded border bg-muted/30 text-xs"
      />

      {/* Actions */}
      <div className="flex gap-2">
        <button onClick={onCancel} className="px-3 py-2 rounded bg-muted text-xs font-semibold pos-btn">
          İptal
        </button>
        <button
          onClick={handleConfirm}
          className="flex-1 py-2 rounded bg-primary text-primary-foreground text-xs font-bold pos-btn flex items-center justify-center gap-1"
        >
          <span>Ekle</span>
          <span className="opacity-80">·</span>
          <span>{lineTotal.toFixed(2)} ₺</span>
        </button>
      </div>
    </div>
  );
}
