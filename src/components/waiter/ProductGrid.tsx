import { memo, useMemo } from 'react';
import { MenuItem } from '@/types/pos';
import { Search } from 'lucide-react';

interface ProductGridProps {
  menuItems: MenuItem[];
  selectedCategory: string;
  showSearch: boolean;
  searchQuery: string;
  onToggleSearch: () => void;
  onSearchChange: (query: string) => void;
  onItemTap: (item: MenuItem) => void;
  onBackToTables: () => void;
}

const ProductButton = memo(function ProductButton({ item, onTap }: { item: MenuItem; onTap: () => void }) {
  return (
    <button
      onClick={onTap}
      className="flex flex-col items-start p-4 bg-card rounded-xl border hover:border-primary/40 hover:shadow-md pos-btn min-h-[80px]"
    >
      <span className="font-bold text-sm leading-tight">{item.name}</span>
      {item.description && (
        <span className="text-[11px] text-muted-foreground leading-tight mt-0.5 line-clamp-1">{item.description}</span>
      )}
      <span className="text-primary font-black text-base mt-auto pt-1">{item.price} ₺</span>
    </button>
  );
});

export default function ProductGrid({
  menuItems, selectedCategory, showSearch, searchQuery,
  onToggleSearch, onSearchChange, onItemTap, onBackToTables,
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
          className="px-3 py-2 rounded-xl bg-muted text-sm font-semibold pos-btn"
        >
          ← Masalar
        </button>
        <button
          onClick={onToggleSearch}
          className={`p-2.5 rounded-xl border pos-btn ${showSearch ? 'bg-primary text-primary-foreground' : 'bg-card'}`}
        >
          <Search className="w-4 h-4" />
        </button>
        {showSearch && (
          <input
            autoFocus
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Ürün ara..."
            className="flex-1 px-4 py-2.5 rounded-xl border bg-card text-sm"
          />
        )}
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {filteredItems.map(item => (
            <ProductButton key={item.id} item={item} onTap={() => onItemTap(item)} />
          ))}
        </div>
      </div>
    </div>
  );
}
