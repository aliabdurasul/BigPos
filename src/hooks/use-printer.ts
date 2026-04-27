import { useState, useEffect, useCallback } from 'react';
import {
  connectQZ, disconnectQZ, getPrinters,
  getQZStatus, getQZError, isQZLoaded, onQZStatusChange,
  fetchPrinters, fetchCategoryRouting,
  QZConnectionStatus,
} from '@/lib/qz-tray';
import { getPrintLog, onPrintLogChange, subscribePrintJobUpdates, PrintJob } from '@/lib/print-manager';
import type { DbPrinter } from '@/types/pos';

export function usePrinter(restaurantId?: string) {
  const [status, setStatus] = useState<QZConnectionStatus>(getQZStatus());
  const [error, setError] = useState<string | null>(getQZError());
  // QZ Tray system printer names (legacy/fallback)
  const [printers, setPrinterList] = useState<string[]>([]);
  // DB-backed printers
  const [dbPrinters, setDbPrinters] = useState<DbPrinter[]>([]);
  const [categoryRouting, setCategoryRoutingState] = useState<Record<string, string>>({});
  const [printLog, setPrintLog] = useState<PrintJob[]>(getPrintLog());

  useEffect(() => {
    const unsub1 = onQZStatusChange((s) => {
      setStatus(s);
      setError(getQZError());
    });
    const unsub2 = onPrintLogChange(setPrintLog);
    return () => { unsub1(); unsub2(); };
  }, []);

  // Subscribe to realtime print job updates
  useEffect(() => {
    if (!restaurantId) return;
    const unsub = subscribePrintJobUpdates(restaurantId);
    return unsub;
  }, [restaurantId]);

  // Load DB printers when restaurantId is available
  const loadDbPrinters = useCallback(async () => {
    if (!restaurantId) return;
    const [printerList, routing] = await Promise.all([
      fetchPrinters(restaurantId),
      fetchCategoryRouting(restaurantId),
    ]);
    setDbPrinters(printerList);
    setCategoryRoutingState(routing);
  }, [restaurantId]);

  useEffect(() => {
    loadDbPrinters();
  }, [loadDbPrinters]);

  const connect = useCallback(async () => {
    await connectQZ();
    const list = await getPrinters();
    setPrinterList(list);
  }, []);

  const disconnect = useCallback(() => disconnectQZ(), []);

  const refreshPrinters = useCallback(async () => {
    const list = await getPrinters();
    setPrinterList(list);
    await loadDbPrinters();
  }, [loadDbPrinters]);

  return {
    // QZ Tray (legacy/optional)
    status,
    error,
    printers,
    isQZLoaded: isQZLoaded(),
    connect,
    disconnect,
    refreshPrinters,
    // DB-backed printers
    dbPrinters,
    categoryRouting,
    reloadDbPrinters: loadDbPrinters,
    // Print job log
    printLog,
  };
}
