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
}

const TableCard = memo(function TableCard({ table, prepay, onSelect }: {
  table: Table;
  prepay: number;
  onSelect: () => void;
}) {
  const isLocked = table.status === 'waiting_payment';

  return (
    <button
      onClick={onSelect}
      disabled={isLocked}
      className={`relative flex flex-col items-center justify-center p-6 rounded-lg border min-h-[100px] ${TABLE_STATUS_BORDER_COLORS[table.status]} bg-card hover:bg-muted/50 pos-btn transition-colors ${isLocked ? 'opacity-70 cursor-not-allowed' : ''}`}
    >
      <span className={`absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full ${TABLE_STATUS_COLORS[table.status]}`} />
      <span className="text-2xl font-bold text-foreground">{table.name.replace('Masa ', '')}</span>
      <span className="text-xs text-muted-foreground mt-1">{table.name}</span>
      {table.currentTotal != null && table.currentTotal > 0 && (
        <span className="text-xs font-bold text-primary mt-1">{table.currentTotal} TL</span>
      )}
      {prepay > 0 && (
        <span className="text-[10px] font-bold text-pos-success mt-0.5">Ön ödeme: {prepay} TL</span>
      )}
      {table.openedAt && table.status !== 'available' && (
        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground mt-0.5">
          <Clock className="w-2.5 h-2.5" /> {formatDuration(table.openedAt)}
        </span>
      )}
      {isLocked && (
        <span className="text-[9px] font-bold text-pos-warning mt-1">KASA BEKLIYOR</span>
      )}
    </button>
  );
});

export default function TableGrid({ tables, orders, floors, selectedFloor, onSelectFloor, onSelectTable }: TableGridProps) {
  const floorTables = useMemo(
    () => tables.filter(t => t.floor === selectedFloor),
    [tables, selectedFloor]
  );

  return (
    <div className="flex flex-col h-full p-4 overflow-y-auto">
      <div className="flex gap-2 mb-4">
        {floors.map(f => (
          <button
            key={f}
            onClick={() => onSelectFloor(f)}
            className={`px-5 py-2.5 rounded-md text-sm font-bold pos-btn ${
              selectedFloor === f ? 'bg-primary text-primary-foreground' : 'bg-card border hover:bg-muted'
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 content-start pb-24">
        {floorTables.map(t => {
          const tOrders = orders.filter(o => o.tableId === t.id && o.status !== 'paid');
          const tPrepay = tOrders.reduce((sum, o) => sum + (o.prepayment || 0), 0);
          return (
            <TableCard
              key={t.id}
              table={t}
              prepay={tPrepay}
              onSelect={() => onSelectTable(t)}
            />
          );
        })}
      </div>
      <div className="flex gap-4 mt-3 justify-center text-xs text-muted-foreground flex-wrap shrink-0">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-pos-success" /> Boş</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary" /> Dolu</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-pos-warning" /> Ödeme Bekliyor</span>
      </div>
    </div>
  );
}
