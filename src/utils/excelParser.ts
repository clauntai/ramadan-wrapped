import * as XLSX from 'xlsx';
import type { ColumnMapping, ParsedWorkbook, SheetData, Donation } from '../types';
import { FIELD_DEFINITIONS } from './fieldDefinitions';

export function parseWorkbook(file: File): Promise<ParsedWorkbook> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheets: SheetData[] = workbook.SheetNames.map((name) => {
          const ws = workbook.Sheets[name];
          const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
            defval: '',
            raw: false,
          });
          const headers = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];
          return { name, headers, rows: jsonData };
        });
        resolve({ sheets, fileName: file.name });
      } catch (err) {
        reject(new Error('Failed to parse Excel file. Please ensure it is a valid .xlsx or .xls file.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsArrayBuffer(file);
  });
}

const DATE_HINTS = [
  'date', 'payment date', 'transaction date', 'donation date', 'gift date',
  'created', 'created at', 'created_at', 'charged on', 'paid on',
  'received date', 'processed date', 'order date', 'charge date',
  'timestamp', 'datetime', 'dt', 'تاريخ',
];
const AMOUNT_HINTS = [
  'amount', 'donation amount', 'gift amount', 'total amount', 'gross amount',
  'net amount', 'charge amount', 'payment amount', 'contribution amount',
  'total', 'sum', 'value', 'gross', 'net', 'price',
  'payment', 'paid', 'charged', 'contribution',
  'مبلغ', 'دونيشن',
];
const ORG_HINTS = [
  'organization', 'organisation', 'org', 'org name', 'charity', 'charity name',
  'recipient', 'beneficiary', 'nonprofit', 'entity',
  'company', 'company name', 'employer', 'business', 'جهة',
];
const CATEGORY_HINTS = [
  'category', 'category name', 'cause', 'cause name', 'cause title',
  'campaign', 'campaign name', 'campaign title',
  'sector', 'classification', 'theme', 'purpose', 'department', 'نوع',
];
const NOTES_HINTS = [
  'note', 'notes', 'comment', 'comments', 'description', 'details', 'detail',
  'remark', 'remarks', 'memo', 'message', 'donor message', 'donor note',
  'tribute', 'in honor of', 'in memory of', 'desc', 'ملاحظة',
];
const PAYMENT_STATUS_HINTS = [
  'payment status', 'transaction status', 'order status', 'donation status',
  'charge status', 'gift status', 'status',
];
const REFUND_AMOUNT_HINTS = [
  'refund', 'refunded', 'refund amount', 'chargeback', 'reversal', 'reversed',
];
const RECURRING_STATUS_HINTS = [
  'recurring', 'recurrence', 'subscription', 'frequency', 'recurring type',
  'donation type', 'type of donation', 'pledge', 'installment',
  'recurring gift', 'is recurring', 'recur', 'repeat',
];

function scoreColumn(header: string, hints: string[]): number {
  const h = header.toLowerCase().trim();
  let best = 0;
  for (const hint of hints) {
    const hl = hint.toLowerCase();
    if (h === hl) { best = Math.max(best, 100); continue; }
    // Word-boundary match: header words match hint words
    if (h.includes(hl) && (h.startsWith(hl) || h.endsWith(hl) || h.includes(` ${hl}`) || h.includes(`${hl} `))) {
      best = Math.max(best, 75);
      continue;
    }
    if (h.includes(hl)) { best = Math.max(best, 55); continue; }
    // Only allow reverse-contains for hints of 4+ chars to avoid short false positives
    if (hl.length >= 4 && hl.includes(h)) { best = Math.max(best, 35); }
  }
  return best;
}

export function detectColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    date: null,
    amount: null,
    organization: null,
    category: null,
    notes: null,
    forcedCurrency: 'USD',
    customColumns: [],
    paymentStatus: null,
    refundAmount: null,
    recurringStatus: null,
  };

  const scored = headers.map((h) => ({
    header: h,
    dateScore:           scoreColumn(h, DATE_HINTS),
    amountScore:         scoreColumn(h, AMOUNT_HINTS),
    orgScore:            scoreColumn(h, ORG_HINTS),
    categoryScore:       scoreColumn(h, CATEGORY_HINTS),
    notesScore:          scoreColumn(h, NOTES_HINTS),
    paymentStatusScore:  scoreColumn(h, PAYMENT_STATUS_HINTS),
    refundAmountScore:   scoreColumn(h, REFUND_AMOUNT_HINTS),
    recurringStatusScore:scoreColumn(h, RECURRING_STATUS_HINTS),
  }));

  const pick = (scoreKey: keyof typeof scored[0], threshold = 40): string | null => {
    const best = [...scored].sort((a, b) => (b[scoreKey] as number) - (a[scoreKey] as number))[0];
    return best && (best[scoreKey] as number) >= threshold ? best.header : null;
  };

  mapping.date            = pick('dateScore');
  mapping.amount          = pick('amountScore');
  mapping.organization    = pick('orgScore');
  mapping.category        = pick('categoryScore');
  mapping.notes           = pick('notesScore');
  mapping.paymentStatus   = pick('paymentStatusScore');
  mapping.refundAmount    = pick('refundAmountScore');
  mapping.recurringStatus = pick('recurringStatusScore');

  // Ensure no two insight fields claim the same column (higher-scoring field wins)
  const insightEntries: [keyof ColumnMapping, string | null][] = [
    ['date', mapping.date], ['amount', mapping.amount], ['organization', mapping.organization],
    ['category', mapping.category], ['notes', mapping.notes], ['paymentStatus', mapping.paymentStatus],
    ['refundAmount', mapping.refundAmount], ['recurringStatus', mapping.recurringStatus],
  ];
  const assigned = new Set<string>();
  for (const [key, col] of insightEntries) {
    if (col && assigned.has(col)) {
      // Another field already claimed this column — clear this one
      (mapping as unknown as Record<string, unknown>)[key as string] = null;
    } else if (col) {
      assigned.add(col);
    }
  }

  // Auto-detect informational fields (threshold 40 to avoid false positives)
  for (const def of FIELD_DEFINITIONS) {
    if (def.mappingKey !== 'custom') continue;
    const best = headers
      .filter(h => !assigned.has(h))
      .map(h => ({ header: h, score: scoreColumn(h, def.autoDetectHints) }))
      .sort((a, b) => b.score - a.score)[0];
    if (best && best.score >= 40) {
      // Use def.id (not randomUUID) so MappingTable can look up the entry by def.id
      mapping.customColumns.push({
        id: def.id,
        label: def.label,
        sourceColumn: best.header,
      });
      assigned.add(best.header);
    }
  }

  return mapping;
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const d = XLSX.SSF.parse_date_code(value);
    if (d) return new Date(d.y, d.m - 1, d.d);
  }
  const str = String(value).trim();
  if (!str) return null;
  // Try various formats
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return parsed;
  // Try DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    const year = y.length === 2 ? 2000 + parseInt(y) : parseInt(y);
    return new Date(year, parseInt(m) - 1, parseInt(d));
  }
  return null;
}

function parseAmount(value: unknown): number {
  if (typeof value === 'number') return Math.abs(value);
  const str = String(value).replace(/[^0-9.,\-]/g, '').replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : Math.abs(num);
}

function resolveField(row: Record<string, unknown>, col: string | string[] | null): unknown {
  if (!col) return null;
  const cols = Array.isArray(col) ? col : [col];
  for (const c of cols) {
    const val = row[c];
    if (val !== null && val !== undefined && val !== '') return val;
  }
  return null;
}

function resolveRowCurrency(mapping: ColumnMapping): string {
  return mapping.forcedCurrency || 'USD';
}

export function buildDonations(rows: Record<string, unknown>[], mapping: ColumnMapping): Donation[] {
  return rows
    .map((row, i): Donation => {
      const customFields: Record<string, string> = {};
      for (const col of mapping.customColumns) {
        if (col.label && col.sourceColumn) {
          customFields[col.label] = String(row[col.sourceColumn] ?? '').trim();
        }
      }
      return {
        id: `donation-${i}`,
        date: mapping.date ? parseDate(resolveField(row, mapping.date)) : null,
        amount: mapping.amount ? parseAmount(resolveField(row, mapping.amount)) : 0,
        currency: resolveRowCurrency(mapping),
        organization: String(resolveField(row, mapping.organization) ?? '').trim(),
        category: String(resolveField(row, mapping.category) ?? '').trim(),
        notes: String(resolveField(row, mapping.notes) ?? '').trim(),
        customFields,
        rawRow: row,
        paymentStatus: String(resolveField(row, mapping.paymentStatus) ?? '').trim(),
        refundAmount: mapping.refundAmount ? parseAmount(resolveField(row, mapping.refundAmount)) : 0,
        recurringStatus: String(resolveField(row, mapping.recurringStatus) ?? '').trim(),
      };
    })
    .filter((d) => d.amount > 0);
}
