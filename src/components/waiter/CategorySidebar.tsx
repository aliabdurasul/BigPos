import { Category } from '@/types/pos';

interface CategorySidebarProps {
  categories: Category[];
  selectedCategory: string;
  showSearch: boolean;
  onSelectCategory: (categoryId: string) => void;
  horizontal?: boolean;
}

export default function CategorySidebar({ categories, selectedCategory, showSearch, onSelectCategory, horizontal }: CategorySidebarProps) {
  if (horizontal) {
    return (
      <div className="shrink-0 border-b bg-card px-2 py-2 overflow-x-auto scrollbar-thin">
        <div className="flex gap-1.5 min-w-max">
          {categories.map(c => (
            <button
              key={c.id}
              onClick={() => onSelectCategory(c.id)}
              className={`flex items-center gap-1.5 px-2.5 py-2 rounded-md text-xs font-semibold whitespace-nowrap pos-btn ${
                selectedCategory === c.id && !showSearch
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 hover:bg-muted'
              }`}
            >
              <span className="text-sm">{c.icon}</span>
              {c.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-32 shrink-0 border-l bg-card p-2 overflow-y-auto scrollbar-thin">
      <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-2 mb-2">Kategoriler</h3>
      <div className="space-y-0.5">
        {categories.map(c => (
          <button
            key={c.id}
            onClick={() => onSelectCategory(c.id)}
            className={`w-full flex items-center gap-2 px-2.5 py-2.5 rounded-md text-sm font-semibold pos-btn ${
              selectedCategory === c.id && !showSearch
                ? 'bg-primary text-primary-foreground'
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
