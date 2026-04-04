import { useState } from 'react';
import { usePrinter } from '@/hooks/use-printer';
import { usePOS } from '@/context/POSContext';
import { testPrint } from '@/lib/printer';
import { getCategoryRouting, setCategoryRoute, removeCategoryRoute, PrinterRole } from '@/lib/qz-tray';
import { Wifi, WifiOff, Loader2, Printer, RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';

const ROLES: { key: PrinterRole; label: string }[] = [
  { key: 'receipt', label: 'Kasa Fisci' },
  { key: 'kitchen', label: 'Mutfak' },
  { key: 'bar', label: 'Bar' },
];

export default function PrinterSettings() {
  const { status, printers, assignments, printLog, connect, disconnect, refreshPrinters, assignPrinter } = usePrinter();
  const { categories } = usePOS();
  const [routing, setRouting] = useState(getCategoryRouting());

  const statusColor = status === 'connected' ? 'text-green-500' : status === 'connecting' ? 'text-yellow-500' : 'text-red-500';
  const statusLabel = status === 'connected' ? 'Bagli' : status === 'connecting' ? 'Baglaniyor...' : status === 'error' ? 'Hata' : 'Bagli Degil';

  const handleCategoryRoute = (catId: string, role: string) => {
    if (role === '') {
      removeCategoryRoute(catId);
    } else {
      setCategoryRoute(catId, role as PrinterRole);
    }
    setRouting(getCategoryRouting());
  };

  return (
    <div className="space-y-6 p-4 max-w-2xl">
      {/* QZ Connection */}
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {status === 'connected' ? <Wifi className={statusColor} size={20} /> : <WifiOff className={statusColor} size={20} />}
            <span className="font-semibold">QZ Tray</span>
            <span className={`text-sm ${statusColor}`}>{statusLabel}</span>
          </div>
          {status === 'connected' ? (
            <button onClick={disconnect} className="px-3 py-1 text-sm border rounded hover:bg-gray-100">Kes</button>
          ) : (
            <button onClick={connect} className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1">
              {status === 'connecting' && <Loader2 size={14} className="animate-spin" />}
              Baglan
            </button>
          )}
        </div>
        {status === 'connected' && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Printer size={14} />
            <span>{printers.length} yazici bulundu</span>
            <button onClick={refreshPrinters} className="p-1 hover:bg-gray-100 rounded"><RefreshCw size={14} /></button>
          </div>
        )}
      </div>

      {/* Printer Role Assignments */}
      {status === 'connected' && printers.length > 0 && (
        <div className="rounded-lg border p-4 space-y-3">
          <h3 className="font-semibold">Yazici Atamalari</h3>
          {ROLES.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium w-24">{label}</span>
              <select
                value={assignments[key] || ''}
                onChange={e => assignPrinter(key, e.target.value)}
                className="flex-1 border rounded px-2 py-1 text-sm"
              >
                <option value="">-- Sec --</option>
                {printers.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <button
                onClick={() => testPrint(key)}
                disabled={!assignments[key]}
                className="px-2 py-1 text-xs border rounded hover:bg-gray-100 disabled:opacity-40"
              >
                Test
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Category Routing */}
      {status === 'connected' && categories.length > 0 && (
        <div className="rounded-lg border p-4 space-y-3">
          <h3 className="font-semibold">Kategori Yonlendirme</h3>
          <p className="text-xs text-gray-500">Her kategorinin hangi yaziciya gidecegini secin. Bos birakilirsa mutfaga gider.</p>
          {categories.map(cat => (
            <div key={cat.id} className="flex items-center justify-between gap-3">
              <span className="text-sm w-40 truncate">{cat.name}</span>
              <select
                value={routing[cat.id] || ''}
                onChange={e => handleCategoryRoute(cat.id, e.target.value)}
                className="flex-1 border rounded px-2 py-1 text-sm"
              >
                <option value="">Mutfak (varsayilan)</option>
                <option value="kitchen">Mutfak</option>
                <option value="bar">Bar</option>
              </select>
            </div>
          ))}
        </div>
      )}

      {/* Print Log */}
      {printLog.length > 0 && (
        <div className="rounded-lg border p-4 space-y-3">
          <h3 className="font-semibold">Yazici Loglari</h3>
          <div className="max-h-60 overflow-y-auto space-y-1">
            {printLog.slice(0, 50).map(job => (
              <div key={job.id} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                <div className="flex items-center gap-2">
                  {job.status === 'success' && <CheckCircle size={12} className="text-green-500" />}
                  {job.status === 'failed' && <XCircle size={12} className="text-red-500" />}
                  {(job.status === 'pending' || job.status === 'printing') && <Clock size={12} className="text-yellow-500" />}
                  <span className="font-mono">{job.role}</span>
                  <span className="text-gray-400">{job.fingerprint}</span>
                </div>
                <div className="flex items-center gap-2">
                  {job.attempts > 1 && <span className="text-orange-500">x{job.attempts}</span>}
                  {job.error && <span className="text-red-400 truncate max-w-32">{job.error}</span>}
                  <span className="text-gray-400">
                    {job.createdAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
