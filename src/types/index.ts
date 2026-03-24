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
  // new
  paymentStatus:   string;
  refundAmount:    number;
  recurringStatus: string;
}

export interface CustomColumn {
  id: string;          // stable key — auto-detected fields use FieldDefinition.id; user-added fields use crypto.randomUUID()
  label: string;       // user-defined display name shown in the table
  sourceColumn: string; // the Excel column header it maps to
}

export interface ColumnMapping {
  date:         string | string[] | null;
  amount:       string | string[] | null;
  organization: string | string[] | null;
  category:     string | string[] | null;
  notes:        string | string[] | null;
  forcedCurrency: string;                         // always 'USD'
  customColumns: CustomColumn[];                  // user-added extra columns
  // new — string | null only (MappingTable uses single-select dropdowns)
  // because MappingTable uses single-select dropdowns; multi-column
  // mapping is intentionally not supported for these fields.
  paymentStatus:   string | null;
  refundAmount:    string | null;
  recurringStatus: string | null;
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
  // new
  netTotal:        number;
  refundCount:     number;
  recurringCount:  number;
  recurringTotal:  number;
  oneTimeCount:    number;
  oneTimeTotal:    number;
  hasRecurringData: boolean;  // true if any donation has a non-empty recurringStatus
}

export interface AppState {
  workbook: ParsedWorkbook | null;
  selectedSheet: string | null;
  columnMapping: ColumnMapping;
  donations: Donation[];
  insights: DonationInsights | null;
}
