import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { AppState, ColumnMapping, Donation, DonationInsights, ParsedWorkbook } from '../types';

interface DonationContextType extends AppState {
  setWorkbook: (wb: ParsedWorkbook | null) => void;
  setSelectedSheet: (sheet: string | null) => void;
  setColumnMapping: (mapping: ColumnMapping) => void;
  setDonations: (donations: Donation[]) => void;
  setInsights: (insights: DonationInsights | null) => void;
  reset: () => void;
}

const defaultMapping: ColumnMapping = {
  date: null, amount: null, organization: null, category: null,
  notes: null, currency: null, forcedCurrency: 'USD', customColumns: [],
  paymentStatus: null, refundAmount: null, recurringStatus: null, fund: null,
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
  const [state, setState] = useState<AppState>(defaultState);

  const setWorkbook = (workbook: ParsedWorkbook | null) =>
    setState((s) => ({ ...s, workbook }));
  const setSelectedSheet = (selectedSheet: string | null) =>
    setState((s) => ({ ...s, selectedSheet }));
  const setColumnMapping = (columnMapping: ColumnMapping) =>
    setState((s) => ({ ...s, columnMapping }));
  const setDonations = (donations: Donation[]) =>
    setState((s) => ({ ...s, donations }));
  const setInsights = (insights: DonationInsights | null) =>
    setState((s) => ({ ...s, insights }));
  const reset = () => setState(defaultState);

  return (
    <DonationContext.Provider value={{ ...state, setWorkbook, setSelectedSheet, setColumnMapping, setDonations, setInsights, reset }}>
      {children}
    </DonationContext.Provider>
  );
}

export function useDonation() {
  const ctx = useContext(DonationContext);
  if (!ctx) throw new Error('useDonation must be used within DonationProvider');
  return ctx;
}
