import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { AppState, ColumnMapping, Donation, DonationInsights, ParsedWorkbook } from '../types';
import { clearSession, loadSession, saveSession } from '../utils/cache';

interface DonationContextType extends AppState {
  setWorkbook: (wb: ParsedWorkbook | null) => void;
  setSelectedSheet: (sheet: string | null) => void;
  setColumnMapping: (mapping: ColumnMapping) => void;
  setDonations: (donations: Donation[]) => void;
  setInsights: (insights: DonationInsights | null) => void;
  reset: () => void;
  /** true when state was restored from localStorage on this page load */
  restoredFromCache: boolean;
}

const defaultMapping: ColumnMapping = {
  date: null, amount: null, organization: null, category: null,
  notes: null, forcedCurrency: 'USD', customColumns: [],
  paymentStatus: null, refundAmount: null, recurringStatus: null,
};

const defaultState: AppState = {
  workbook: null,
  selectedSheet: null,
  columnMapping: defaultMapping,
  donations: [],
  insights: null,
};

const DonationContext = createContext<DonationContextType | null>(null);

export function DonationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => {
    // Attempt to restore from cache on first render
    const cached = loadSession();
    if (!cached) return defaultState;

    // Rebuild a minimal workbook (no rows needed for the recap page)
    const workbook: ParsedWorkbook = {
      fileName: cached.fileName,
      sheets: cached.sheetNames.map(name => ({ name, headers: [], rows: [] })),
    };
    return {
      workbook,
      selectedSheet: cached.selectedSheet,
      columnMapping: cached.columnMapping,
      donations: cached.donations,
      insights: cached.insights,
    };
  });

  const [restoredFromCache] = useState<boolean>(() => loadSession() !== null);

  // Persist whenever the key pieces of state change
  useEffect(() => {
    if (!state.workbook || !state.insights) return;
    saveSession(
      state.workbook,
      state.selectedSheet,
      state.columnMapping,
      state.donations,
      state.insights,
    );
  }, [state.workbook, state.selectedSheet, state.columnMapping, state.donations, state.insights]);

  const setWorkbook = (workbook: ParsedWorkbook | null) =>
    setState(s => ({ ...s, workbook }));
  const setSelectedSheet = (selectedSheet: string | null) =>
    setState(s => ({ ...s, selectedSheet }));
  const setColumnMapping = (columnMapping: ColumnMapping) =>
    setState(s => ({ ...s, columnMapping }));
  const setDonations = (donations: Donation[]) =>
    setState(s => ({ ...s, donations }));
  const setInsights = (insights: DonationInsights | null) =>
    setState(s => ({ ...s, insights }));

  const reset = () => {
    clearSession();
    setState(defaultState);
  };

  return (
    <DonationContext.Provider value={{
      ...state,
      setWorkbook, setSelectedSheet, setColumnMapping,
      setDonations, setInsights, reset,
      restoredFromCache,
    }}>
      {children}
    </DonationContext.Provider>
  );
}

export function useDonation() {
  const ctx = useContext(DonationContext);
  if (!ctx) throw new Error('useDonation must be used within DonationProvider');
  return ctx;
}
