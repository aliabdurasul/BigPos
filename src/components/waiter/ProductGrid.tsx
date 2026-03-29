import { memo, useMemo, Fragment } from 'react';
import { MenuItem, ModifierGroup, OrderItemModifier } from '@/types/pos';
import { Search } from 'lucide-react';
import InlineModifiers from '@/components/waiter/ModifierModal';

interface ProductGridProps {
  menuItems: MenuItem[];
  selectedCategory: string;
  showSearch: boolean;
  searchQuery: string;
  onToggleSearch: () => void;
  onSearchChange: (query: string) => void;
  onItemTap: (item: MenuItem) => void;
  onBackToTables: () => void;
  expandedItemId?: string | null;
  modifierGroups?: ModifierGroup[];
  productModifierMap?: Map<string, string[]>;
  onConfirmModifiers?: (item: MenuItem, modifiers: OrderItemModifier[], note: string, quantity: number) => void;
  onCancelModifiers?: () => void;
}

const ProductButton = memo(function ProductButton({ item, onTap }: { item: MenuItem; onTap: () => void }) {
  return (
    <button
      onClick={onTap}
      className="flex flex-col items-start p-3 bg-card rounded-md border hover:bg-muted/50 pos-btn min-h-[64px] touch-manipulation active:scale-[0.97] transition-all"
    >
      <span className="font-semibold text-sm leading-tight">{item.name}</span>
      {item.description && (
        <span className="text-[10px] text-muted-foreground leading-tight mt-0.5 line-clamp-1">{item.description}</span>
      )}
      <span className="text-primary font-bold text-sm mt-auto pt-0.5">{item.price} ₺</span>
    </button>
  );
});

export default function ProductGrid({
  menuItems, selectedCategory, showSearch, searchQuery,
  onToggleSearch, onSearchChange, onItemTap, onBackToTables,
  expandedItemId, modifierGroups, productModifierMap, onConfirmModifiers, onCancelModifiers,
}: ProductGridProps) {
  const filteredItems = useMemo(() => {
    if (showSearch && searchQuery) {
      return menuItems.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return menuItems.filter(i => i.categoryId === selectedCategory);
  }, [menuItems, selectedCategory, searchQuery, showSearch]);

  return (
    <div className="flex-1 flex flex-col p-3">
      <div className="flex gap-2 mb-3 items-center">
        <button
          onClick={onBackToTables}
          className="px-4 py-3 rounded-md bg-muted text-sm font-semibold pos-btn"
        >
          ← Masalar
        </button>
        <button
          onClick={onToggleSearch}
          className={`p-2.5 rounded-md border pos-btn ${showSearch ? 'bg-primary text-primary-foreground' : 'bg-card'}`}
        >
          <Search className="w-4 h-4" />
        </button>
        {showSearch && (
          <input
            autoFocus
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Ürün ara..."
            className="flex-1 px-4 py-2.5 rounded-md border bg-card text-sm"
          />
        )}
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5">
          {filteredItems.map(item => (
            <Fragment key={item.id}>
              <ProductButton item={item} onTap={() => onItemTap(item)} />
              {expandedItemId === item.id && modifierGroups && productModifierMap && onConfirmModifiers && onCancelModifiers && (
                <div className="col-span-full">
                  <InlineModifiers
                    item={item}
                    modifierGroups={modifierGroups}
                    productModifierMap={productModifierMap}
                    onConfirm={(mods, note, qty) => onConfirmModifiers(item, mods, note, qty)}
                    onCancel={onCancelModifiers}
                  />
                </div>
              )}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
