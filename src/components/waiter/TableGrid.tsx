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
      className={`relative flex flex-col items-center justify-center p-6 rounded-2xl border-2 min-h-[100px] ${TABLE_STATUS_BORDER_COLORS[table.status]} bg-card hover:shadow-lg pos-btn transition-shadow ${isLocked ? 'opacity-70 cursor-not-allowed' : ''}`}
    >
      <div className={`absolute top-0 left-0 right-0 h-1.5 rounded-t-2xl ${TABLE_STATUS_COLORS[table.status]}`} />
      <span className="text-2xl font-black text-foreground">{table.name.replace('Masa ', '')}</span>
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
    <div className="flex-1 flex flex-col p-4 min-h-0">
      <div className="flex gap-2 mb-4 shrink-0">
        {floors.map(f => (
          <button
            key={f}
            onClick={() => onSelectFloor(f)}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold pos-btn ${
              selectedFloor === f ? 'bg-primary text-primary-foreground shadow-md' : 'bg-card border hover:bg-muted'
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 flex-1 content-start overflow-y-auto scrollbar-thin">
        {floorTables.map(t => {
          const tOrders = orders.filter(o => o.tableId === t.id && o.status !== 'paid' && o.status !== 'closed');
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
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Sipariş Var</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-pos-danger" /> Hazırlanıyor</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> Hazır</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-pos-warning" /> Ödeme Bekliyor</span>
      </div>
    </div>
  );
}
