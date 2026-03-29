import { memo, useMemo } from 'react';
import { Table, Order, TABLE_STATUS_COLORS, TABLE_STATUS_BORDER_COLORS } from '@/types/pos';
import { Clock } from 'lucide-react';

function formatDuration(openedAt?: Date) {
  if (!openedAt) return '';
  const mins = Math.floor((Date.now() - new Date(openedAt).getTime()) / 60000);
  if (mins < 1) return 'Az önce';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}s ${m}dk` : `${m}dk`;
}

interface TableGridProps {
  tables: Table[];
  orders: Order[];
  floors: string[];
  selectedFloor: string;
  onSelectFloor: (floor: string) => void;
  onSelectTable: (table: Table) => void;
  compact?: boolean;
  selectedTableId?: string;
}

const TableCard = memo(function TableCard({ table, prepay, onSelect, compact, selected }: {
  table: Table;
  prepay: number;
  onSelect: () => void;
  compact?: boolean;
  selected?: boolean;
}) {
  const isLocked = table.status === 'waiting_payment';

  return (
    <button
      onClick={onSelect}
      disabled={isLocked}
      className={`flex flex-col items-center justify-center ${compact ? 'p-2 min-h-[56px]' : 'p-3 min-h-[72px]'} rounded-md border ${TABLE_STATUS_COLORS[table.status]} ${TABLE_STATUS_BORDER_COLORS[table.status]} pos-btn transition-colors ${isLocked ? 'opacity-70 cursor-not-allowed' : ''} ${selected ? 'ring-2 ring-primary ring-offset-1' : ''}`}
    >
      <span className={`${compact ? 'text-sm' : 'text-lg'} font-bold`}>{table.name.replace('Masa ', '')}</span>
      {!compact && <span className="text-[10px] opacity-60">{table.name}</span>}
      {table.currentTotal != null && table.currentTotal > 0 && (
        <span className={`${compact ? 'text-[9px]' : 'text-[11px]'} font-bold mt-0.5`}>{table.currentTotal} TL</span>
      )}
      {!compact && prepay > 0 && (
        <span className="text-[9px] font-bold text-pos-success mt-0.5">Ön ödeme: {prepay} TL</span>
      )}
      {!compact && table.openedAt && table.status !== 'available' && (
        <span className="flex items-center gap-0.5 text-[9px] opacity-60 mt-0.5">
          <Clock className="w-2.5 h-2.5" /> {formatDuration(table.openedAt)}
        </span>
      )}
      {isLocked && (
        <span className={`${compact ? 'text-[8px]' : 'text-[9px]'} font-bold text-amber-600 mt-0.5`}>KASA BEKLIYOR</span>
      )}
    </button>
  );
});

export default function TableGrid({ tables, orders, floors, selectedFloor, onSelectFloor, onSelectTable, compact, selectedTableId }: TableGridProps) {
  const floorTables = useMemo(
    () => tables.filter(t => t.floor === selectedFloor),
    [tables, selectedFloor]
  );

  return (
    <div className={`flex flex-col h-full ${compact ? 'p-2' : 'p-4'} overflow-y-auto`}>
      <div className={`flex gap-1.5 ${compact ? 'mb-2 flex-wrap' : 'mb-4'}`}>
        {floors.map(f => (
          <button
            key={f}
            onClick={() => onSelectFloor(f)}
            className={`${compact ? 'px-3 py-1.5 text-xs' : 'px-5 py-2.5 text-sm'} rounded-md font-bold pos-btn ${
              selectedFloor === f ? 'bg-primary text-primary-foreground' : 'bg-card border hover:bg-muted'
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      <div className={`grid ${compact ? 'grid-cols-3 gap-1.5' : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2'} content-start ${compact ? 'pb-2' : 'pb-24'}`}>
        {floorTables.map(t => {
          const tOrders = orders.filter(o => o.tableId === t.id && o.status !== 'paid');
          const tPrepay = tOrders.reduce((sum, o) => sum + (o.prepayment || 0), 0);
          return (
            <TableCard
              key={t.id}
              table={t}
              prepay={tPrepay}
              onSelect={() => onSelectTable(t)}
              compact={compact}
              selected={selectedTableId === t.id}
            />
          );
        })}
      </div>
      {!compact && (
        <div className="flex gap-4 mt-3 justify-center text-xs text-muted-foreground flex-wrap shrink-0">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-gray-200 border border-gray-300" /> Boş</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-100 border border-red-300" /> Dolu</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-100 border border-amber-300" /> Ödeme Bekliyor</span>
        </div>
      )}
    </div>
  );
}
