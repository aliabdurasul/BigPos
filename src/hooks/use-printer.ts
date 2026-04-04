import { useState, useEffect, useCallback } from 'react';
import {
  connectQZ, disconnectQZ, getPrinters,
  getQZStatus, onQZStatusChange,
  getPrinterForRole, setPrinter, getAllPrinterAssignments,
  QZConnectionStatus, PrinterRole,
} from '@/lib/qz-tray';
import { getPrintLog, onPrintLogChange, PrintJob } from '@/lib/print-manager';

export function usePrinter() {
  const [status, setStatus] = useState<QZConnectionStatus>(getQZStatus());
  const [printers, setPrinterList] = useState<string[]>([]);
  const [assignments, setAssignments] = useState(getAllPrinterAssignments());
  const [printLog, setPrintLog] = useState<PrintJob[]>(getPrintLog());

  useEffect(() => {
    const unsub1 = onQZStatusChange(setStatus);
    const unsub2 = onPrintLogChange(setPrintLog);
    return () => { unsub1(); unsub2(); };
  }, []);

  const connect = useCallback(async () => {
    await connectQZ();
    const list = await getPrinters();
    setPrinterList(list);
  }, []);

  const disconnect = useCallback(() => disconnectQZ(), []);

  const refreshPrinters = useCallback(async () => {
    const list = await getPrinters();
    setPrinterList(list);
  }, []);

  const assignPrinter = useCallback((role: PrinterRole, name: string) => {
    setPrinter(role, name);
    setAssignments(getAllPrinterAssignments());
  }, []);

  return {
    status,
    printers,
    assignments,
    printLog,
    connect,
    disconnect,
    refreshPrinters,
    assignPrinter,
    getPrinterForRole,
  };
}
