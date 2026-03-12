import { Category } from '@/types/pos';

interface CategorySidebarProps {
  categories: Category[];
  selectedCategory: string;
  showSearch: boolean;
  onSelectCategory: (categoryId: string) => void;
}

export default function CategorySidebar({ categories, selectedCategory, showSearch, onSelectCategory }: CategorySidebarProps) {
  return (
    <div className="w-36 shrink-0 border-l bg-card p-2 overflow-y-auto scrollbar-thin">
      <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-2 mb-2">Kategoriler</h3>
      <div className="space-y-1">
        {categories.map(c => (
          <button
            key={c.id}
            onClick={() => onSelectCategory(c.id)}
            className={`w-full flex items-center gap-2 px-3 py-3 rounded-xl text-sm font-semibold pos-btn ${
              selectedCategory === c.id && !showSearch
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'hover:bg-muted'
            }`}
          >
            <span className="text-base">{c.icon}</span>
            <span className="truncate text-xs">{c.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
