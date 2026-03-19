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

const DATE_HINTS = ['date', 'day', 'when', 'time', 'on', 'dt', 'تاريخ'];
const AMOUNT_HINTS = ['amount', 'sum', 'total', 'donation', 'value', 'price', 'مبلغ', 'payment', 'paid', 'sar', 'usd', 'egp', 'qar', 'aed', 'kwd', 'gbp', 'eur', 'دونيشن'];
const ORG_HINTS = ['org', 'organization', 'charity', 'recipient', 'to', 'beneficiary', 'name', 'جهة', 'cause name', 'entity'];
const CATEGORY_HINTS = ['category', 'type', 'cause', 'purpose', 'kind', 'group', 'نوع', 'section', 'tag', 'department'];
const NOTES_HINTS = ['note', 'notes', 'comment', 'description', 'detail', 'remark', 'ملاحظة', 'memo', 'desc', 'info'];
const CURRENCY_HINTS = ['currency', 'curr', 'عملة', 'ccy'];
const PAYMENT_STATUS_HINTS = ['status', 'payment status', 'state', 'transaction status'];
const REFUND_AMOUNT_HINTS = ['refund', 'refunded', 'chargeback'];
const RECURRING_STATUS_HINTS = ['recurring', 'recurrence', 'subscription', 'frequency'];
const FUND_HINTS = ['fund', 'campaign', 'cause', 'appeal', 'designation'];

function scoreColumn(header: string, hints: string[]): number {
  const h = header.toLowerCase().trim();
  for (const hint of hints) {
    if (h === hint) return 100;
    if (h.includes(hint)) return 60;
    if (hint.includes(h)) return 40;
  }
  return 0;
}

export function detectColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    date: null,
    amount: null,
    organization: null,
    category: null,
    notes: null,
    currency: null,
    forcedCurrency: 'USD',
    customColumns: [],
    paymentStatus: null,
    refundAmount: null,
    recurringStatus: null,
    fund: null,
  };

  const scored = headers.map((h) => ({
    header: h,
    dateScore: scoreColumn(h, DATE_HINTS),
    amountScore: scoreColumn(h, AMOUNT_HINTS),
    orgScore: scoreColumn(h, ORG_HINTS),
    categoryScore: scoreColumn(h, CATEGORY_HINTS),
    notesScore: scoreColumn(h, NOTES_HINTS),
    currencyScore: scoreColumn(h, CURRENCY_HINTS),
    paymentStatusScore: scoreColumn(h, PAYMENT_STATUS_HINTS),
    refundAmountScore: scoreColumn(h, REFUND_AMOUNT_HINTS),
    recurringStatusScore: scoreColumn(h, RECURRING_STATUS_HINTS),
    fundScore: scoreColumn(h, FUND_HINTS),
  }));

  const pick = (scoreKey: keyof typeof scored[0], threshold = 30): string | null => {
    const best = [...scored].sort((a, b) => (b[scoreKey] as number) - (a[scoreKey] as number))[0];
    return best && (best[scoreKey] as number) >= threshold ? best.header : null;
  };

  mapping.date = pick('dateScore');
  mapping.amount = pick('amountScore');
  mapping.organization = pick('orgScore');
  mapping.category = pick('categoryScore');
  mapping.notes = pick('notesScore');
  mapping.currency = pick('currencyScore');
  mapping.paymentStatus = pick('paymentStatusScore');
  mapping.refundAmount = pick('refundAmountScore');
  mapping.recurringStatus = pick('recurringStatusScore');
  mapping.fund = pick('fundScore');

  // Build set of already-assigned columns so info fields don't conflict
  const assigned = new Set<string>(
    [mapping.date, mapping.amount, mapping.organization, mapping.category,
     mapping.notes, mapping.currency, mapping.paymentStatus, mapping.refundAmount,
     mapping.recurringStatus, mapping.fund].filter(Boolean) as string[]
  );

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

function resolveRowCurrency(
  row: Record<string, unknown>,
  mapping: ColumnMapping,
): string {
  // 1. Per-row currency column (supports multi-column)
  if (mapping.currency) {
    const cols = Array.isArray(mapping.currency) ? mapping.currency : [mapping.currency];
    for (const c of cols) {
      const val = String(row[c] || '').toUpperCase().trim();
      // Require at least 2 chars to avoid single-letter placeholders; bypasses resolveField intentionally (currency needs string coercion, not first-non-empty semantics)
      if (val.length >= 2) return val;
    }
  }
  // 2. Symbol embedded in the amount cell
  if (mapping.amount) {
    const amountCol = Array.isArray(mapping.amount) ? mapping.amount[0] : mapping.amount;
    const str = String(row[amountCol] || '');
    const symbolMap: Record<string, string> = { '$': 'USD', '£': 'GBP', '€': 'EUR', '﷼': 'SAR', 'ر.س': 'SAR' };
    for (const [sym, code] of Object.entries(symbolMap)) {
      if (str.includes(sym)) return code;
    }
    const isoMatch = str.match(/\b([A-Z]{3})\b/);
    if (isoMatch) return isoMatch[1];
  }
  // 3. User-chosen default
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
        currency: resolveRowCurrency(row, mapping),
        organization: String(resolveField(row, mapping.organization) ?? '').trim(),
        category: String(resolveField(row, mapping.category) ?? '').trim(),
        notes: String(resolveField(row, mapping.notes) ?? '').trim(),
        customFields,
        rawRow: row,
        paymentStatus: String(resolveField(row, mapping.paymentStatus) ?? '').trim(),
        refundAmount: mapping.refundAmount ? parseAmount(resolveField(row, mapping.refundAmount)) : 0,
        recurringStatus: String(resolveField(row, mapping.recurringStatus) ?? '').trim(),
        fund: String(resolveField(row, mapping.fund) ?? '').trim(),
      };
    })
    .filter((d) => d.amount > 0);
}
