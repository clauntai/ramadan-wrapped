export interface Donation {
  id: string;
  date: Date | null;
  amount: number;
  currency: string;
  organization: string;
  category: string;
  notes: string;
  customFields: Record<string, string>; // label → value (user-defined extra columns)
  rawRow: Record<string, unknown>;
}

export interface CustomColumn {
  id: string;          // stable React key (crypto.randomUUID or Date.now())
  label: string;       // user-defined display name shown in the table
  sourceColumn: string; // the Excel column header it maps to
}

export interface ColumnMapping {
  date:         string | string[] | null;
  amount:       string | string[] | null;
  organization: string | string[] | null;
  category:     string | string[] | null;
  notes:        string | string[] | null;
  currency:     string | string[] | null;        // per-row currency column
  forcedCurrency: string;                         // default / override currency
  customColumns: CustomColumn[];                  // user-added extra columns
}

export interface SheetData {
  name: string;
  headers: string[];
  rows: Record<string, unknown>[];
}

export interface ParsedWorkbook {
  sheets: SheetData[];
  fileName: string;
}

export interface DonationInsights {
  total: number;
  count: number;
  average: number;
  largest: Donation | null;
  mostGenerousDay: { date: Date; amount: number; count: number } | null;
  topOrganization: { name: string; amount: number; count: number } | null;
  topCategory: { name: string; amount: number; count: number } | null;
  currency: string;
  donationsByDay: { date: Date; amount: number; count: number }[];
  donationsByCategory: { name: string; amount: number; count: number }[];
  donationsByOrganization: { name: string; amount: number; count: number }[];
  last10NightsTotal: number;
  last10NightsCount: number;
  ramadanYear: number | null;
}

export interface AppState {
  workbook: ParsedWorkbook | null;
  selectedSheet: string | null;
  columnMapping: ColumnMapping;
  donations: Donation[];
  insights: DonationInsights | null;
}
