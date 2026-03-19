# Mapping Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the drag-and-drop `MappingSandbox` with an Excel-style `MappingTable` where column headers are dropdowns and real data rows appear beneath, expanding field support from 6 core fields to 21 predefined fields + custom.

**Architecture:** A new `FIELD_DEFINITIONS` array in `fieldDefinitions.ts` drives the entire system — it defines every predefined field, its auto-detect hints, and whether it maps to a first-class `ColumnMapping` key ("insight") or to `customColumns` ("info"). `MappingTable` renders one `<th>` per active field with a `<select>` dropdown; data rows show real spreadsheet values beneath. Four new insight fields (`paymentStatus`, `refundAmount`, `recurringStatus`, `fund`) are first-class on `ColumnMapping` and `Donation`, and drive new breakdowns in the insights engine.

**Tech Stack:** React 18, TypeScript, Vite, inline styles (no CSS framework), no test framework — verify by running `npm run build` (TypeScript compile) and loading the dev server.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/types/index.ts` | Modify | Add 4 fields to `ColumnMapping`, `Donation`, `DonationInsights` |
| `src/context/DonationContext.tsx` | Modify | Add 4 new fields to `defaultMapping` literal |
| `src/utils/fieldDefinitions.ts` | **Create** | `FieldDefinition` type + `FIELD_DEFINITIONS` array |
| `src/utils/excelParser.ts` | Modify | Hint arrays, `detectColumns()` init, info field auto-detection, `buildDonations()` |
| `src/utils/insightsEngine.ts` | Modify | Status filter, net total, recurring/fund breakdowns |
| `src/components/CurrencyPicker.tsx` | **Create** | Extracted currency pill-picker (shared) |
| `src/components/MappingTable.tsx` | **Create** | Excel-style table mapping UI |
| `src/components/MappingSandbox.tsx` | **Delete** | Replaced by MappingTable |
| `src/pages/LandingPage.tsx` | Modify | Swap import from MappingSandbox → MappingTable |

---

### Task 1: Extend types and default state

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/context/DonationContext.tsx`

> Do these two files in the same commit — adding fields to `ColumnMapping` makes `DonationContext.tsx` fail to compile until `defaultMapping` is also updated.

- [ ] **Step 1: Add four new insight fields to `ColumnMapping`**

In `src/types/index.ts`, update the `ColumnMapping` interface:

```ts
export interface ColumnMapping {
  date:         string | string[] | null;
  amount:       string | string[] | null;
  organization: string | string[] | null;
  category:     string | string[] | null;
  notes:        string | string[] | null;
  currency:     string | string[] | null;
  forcedCurrency: string;
  customColumns: CustomColumn[];
  // new — string | null only (MappingTable uses single-select dropdowns)
  paymentStatus:   string | null;
  refundAmount:    string | null;
  recurringStatus: string | null;
  fund:            string | null;
}
```

- [ ] **Step 2: Add four new fields to `Donation`**

In `src/types/index.ts`, update the `Donation` interface:

```ts
export interface Donation {
  id: string;
  date: Date | null;
  amount: number;
  currency: string;
  organization: string;
  category: string;
  notes: string;
  customFields: Record<string, string>;
  rawRow: Record<string, unknown>;
  // new
  paymentStatus:   string;
  refundAmount:    number;
  recurringStatus: string;
  fund:            string;
}
```

- [ ] **Step 3: Add new fields to `DonationInsights`**

In `src/types/index.ts`, update the `DonationInsights` interface — append after `ramadanYear`:

```ts
  netTotal:        number;
  refundCount:     number;
  recurringCount:  number;
  oneTimeCount:    number;
  donationsByFund: { name: string; amount: number; count: number }[];
  topFund:         { name: string; amount: number; count: number } | null;
```

- [ ] **Step 4: Update `defaultMapping` in DonationContext**

In `src/context/DonationContext.tsx`, update lines 14–17:

```ts
const defaultMapping: ColumnMapping = {
  date: null, amount: null, organization: null, category: null,
  notes: null, currency: null, forcedCurrency: 'USD', customColumns: [],
  paymentStatus: null, refundAmount: null, recurringStatus: null, fund: null,
};
```

- [ ] **Step 5: Verify compilation**

```bash
npm run build
```

Expected: no TypeScript errors. If errors appear, they are in files that construct `ColumnMapping` or `Donation` objects directly — fix them before continuing.

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/context/DonationContext.tsx
git commit -m "feat: extend ColumnMapping and Donation with paymentStatus, refundAmount, recurringStatus, fund"
```

---

### Task 2: Create `fieldDefinitions.ts`

**Files:**
- Create: `src/utils/fieldDefinitions.ts`

> This file uses `keyof ColumnMapping`, so Task 1 must be complete first.

- [ ] **Step 1: Create the file with the `FieldDefinition` type and full `FIELD_DEFINITIONS` array**

```ts
import type { ColumnMapping } from '../types';

export type FieldGroup = 'transaction' | 'buyer' | 'tax';
export type FieldRole = 'insight' | 'info';

export interface FieldDefinition {
  id: string;
  label: string;
  group: FieldGroup;
  role: FieldRole;
  required?: boolean;
  mappingKey: keyof ColumnMapping | 'custom';
  autoDetectHints: string[];
}

export const FIELD_DEFINITIONS: FieldDefinition[] = [
  // ── Transaction Details — insight fields ───────────────
  {
    id: 'date', label: 'Payment Date', group: 'transaction', role: 'insight',
    mappingKey: 'date',
    autoDetectHints: ['date', 'day', 'when', 'time', 'on', 'dt'],
  },
  {
    id: 'amount', label: 'Total Amount', group: 'transaction', role: 'insight', required: true,
    mappingKey: 'amount',
    autoDetectHints: ['amount', 'sum', 'total', 'donation', 'value', 'price', 'payment', 'paid'],
  },
  {
    id: 'paymentStatus', label: 'Payment Status', group: 'transaction', role: 'insight',
    mappingKey: 'paymentStatus',
    autoDetectHints: ['status', 'payment status', 'state', 'transaction status'],
  },
  {
    id: 'refundAmount', label: 'Refund Amount', group: 'transaction', role: 'insight',
    mappingKey: 'refundAmount',
    autoDetectHints: ['refund', 'refunded', 'chargeback'],
  },
  {
    id: 'recurringStatus', label: 'Recurring Status', group: 'transaction', role: 'insight',
    mappingKey: 'recurringStatus',
    autoDetectHints: ['recurring', 'recurrence', 'subscription', 'frequency'],
  },
  {
    id: 'fund', label: 'Fund', group: 'transaction', role: 'insight',
    mappingKey: 'fund',
    autoDetectHints: ['fund', 'campaign', 'cause', 'appeal', 'designation'],
  },
  {
    id: 'organization', label: 'Organisation', group: 'transaction', role: 'insight',
    mappingKey: 'organization',
    autoDetectHints: ['org', 'organization', 'charity', 'recipient', 'to', 'beneficiary'],
  },
  {
    id: 'category', label: 'Category / Cause', group: 'transaction', role: 'insight',
    mappingKey: 'category',
    autoDetectHints: ['category', 'type', 'cause', 'purpose', 'kind', 'group'],
  },
  {
    id: 'currency', label: 'Currency Column', group: 'transaction', role: 'insight',
    mappingKey: 'currency',
    autoDetectHints: ['currency', 'curr', 'ccy'],
  },
  {
    id: 'notes', label: 'Notes', group: 'transaction', role: 'insight',
    mappingKey: 'notes',
    autoDetectHints: ['note', 'notes', 'comment', 'description', 'detail', 'remark', 'memo'],
  },
  // ── Transaction Details — info fields ─────────────────
  {
    id: 'paymentMethod', label: 'Payment Method', group: 'transaction', role: 'info',
    mappingKey: 'custom',
    autoDetectHints: ['method', 'payment method', 'pay method'],
  },
  {
    id: 'payoutDate', label: 'Payout Date', group: 'transaction', role: 'info',
    mappingKey: 'custom',
    autoDetectHints: ['payout', 'payout date', 'disbursement'],
  },
  {
    id: 'extraDonation', label: 'Extra Donation', group: 'transaction', role: 'info',
    mappingKey: 'custom',
    autoDetectHints: ['extra', 'tip', 'additional', 'add-on'],
  },
  {
    id: 'discount', label: 'Discount', group: 'transaction', role: 'info',
    mappingKey: 'custom',
    autoDetectHints: ['discount', 'promo', 'coupon'],
  },
  // ── Buyer Information ──────────────────────────────────
  {
    id: 'firstName', label: 'First Name', group: 'buyer', role: 'info',
    mappingKey: 'custom',
    autoDetectHints: ['first name', 'first', 'fname', 'given name'],
  },
  {
    id: 'lastName', label: 'Last Name', group: 'buyer', role: 'info',
    mappingKey: 'custom',
    autoDetectHints: ['last name', 'last', 'lname', 'surname', 'family name'],
  },
  {
    id: 'email', label: 'Email', group: 'buyer', role: 'info',
    mappingKey: 'custom',
    autoDetectHints: ['email', 'e-mail', 'email address'],
  },
  {
    id: 'companyName', label: 'Company Name', group: 'buyer', role: 'info',
    mappingKey: 'custom',
    autoDetectHints: ['company', 'employer', 'business'],
  },
  {
    id: 'address', label: 'Address', group: 'buyer', role: 'info',
    mappingKey: 'custom',
    autoDetectHints: ['address', 'street', 'addr'],
  },
  {
    id: 'city', label: 'City', group: 'buyer', role: 'info',
    mappingKey: 'custom',
    autoDetectHints: ['city', 'town', 'municipality'],
  },
  {
    id: 'postalCode', label: 'Postal Code', group: 'buyer', role: 'info',
    mappingKey: 'custom',
    autoDetectHints: ['postal', 'zip', 'postcode', 'postal code'],
  },
  {
    id: 'state', label: 'State', group: 'buyer', role: 'info',
    mappingKey: 'custom',
    autoDetectHints: ['state', 'province', 'region'],
  },
  {
    id: 'country', label: 'Country', group: 'buyer', role: 'info',
    mappingKey: 'custom',
    autoDetectHints: ['country', 'nation'],
  },
  {
    id: 'language', label: 'Language', group: 'buyer', role: 'info',
    mappingKey: 'custom',
    autoDetectHints: ['language', 'lang', 'locale'],
  },
  // ── Tax Receipt ────────────────────────────────────────
  {
    id: 'taxReceipt', label: 'Tax Receipt #', group: 'tax', role: 'info',
    mappingKey: 'custom',
    autoDetectHints: ['tax receipt', 'receipt', 'receipt number', 'tax no'],
  },
];
```

- [ ] **Step 2: Verify compilation**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/utils/fieldDefinitions.ts
git commit -m "feat: add FIELD_DEFINITIONS — single source of truth for all mapping fields"
```

---

### Task 3: Update `excelParser.ts`

**Files:**
- Modify: `src/utils/excelParser.ts`

- [ ] **Step 1: Add import for FIELD_DEFINITIONS at the top of the file**

```ts
import { FIELD_DEFINITIONS } from './fieldDefinitions';
```

- [ ] **Step 2: Add hint arrays for the four new insight fields**

After the existing hint array constants (after `CURRENCY_HINTS`), add:

```ts
const PAYMENT_STATUS_HINTS   = ['status', 'payment status', 'state', 'transaction status'];
const REFUND_AMOUNT_HINTS    = ['refund', 'refunded', 'chargeback'];
const RECURRING_STATUS_HINTS = ['recurring', 'recurrence', 'subscription', 'frequency'];
const FUND_HINTS             = ['fund', 'campaign', 'cause', 'appeal', 'designation'];
```

- [ ] **Step 3: Update `detectColumns()` — initialiser + scoring for new insight fields**

Replace the `mapping` initialiser and add scoring for the new fields. The function should end up like this (full replacement of `detectColumns`):

```ts
export function detectColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    date: null, amount: null, organization: null, category: null,
    notes: null, currency: null, forcedCurrency: 'USD', customColumns: [],
    paymentStatus: null, refundAmount: null, recurringStatus: null, fund: null,
  };

  const scored = headers.map((h) => ({
    header: h,
    dateScore:           scoreColumn(h, DATE_HINTS),
    amountScore:         scoreColumn(h, AMOUNT_HINTS),
    orgScore:            scoreColumn(h, ORG_HINTS),
    categoryScore:       scoreColumn(h, CATEGORY_HINTS),
    notesScore:          scoreColumn(h, NOTES_HINTS),
    currencyScore:       scoreColumn(h, CURRENCY_HINTS),
    paymentStatusScore:  scoreColumn(h, PAYMENT_STATUS_HINTS),
    refundAmountScore:   scoreColumn(h, REFUND_AMOUNT_HINTS),
    recurringStatusScore: scoreColumn(h, RECURRING_STATUS_HINTS),
    fundScore:           scoreColumn(h, FUND_HINTS),
  }));

  const pick = (scoreKey: keyof typeof scored[0], threshold = 30): string | null => {
    const best = [...scored].sort((a, b) => (b[scoreKey] as number) - (a[scoreKey] as number))[0];
    return best && (best[scoreKey] as number) >= threshold ? best.header : null;
  };

  mapping.date         = pick('dateScore');
  mapping.amount       = pick('amountScore');
  mapping.organization = pick('orgScore');
  mapping.category     = pick('categoryScore');
  mapping.notes        = pick('notesScore');
  mapping.currency     = pick('currencyScore');
  mapping.paymentStatus   = pick('paymentStatusScore');
  mapping.refundAmount    = pick('refundAmountScore');
  mapping.recurringStatus = pick('recurringStatusScore');
  mapping.fund            = pick('fundScore');

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
```

- [ ] **Step 4: Update `buildDonations()` — populate new Donation fields**

In `buildDonations`, update the returned object inside `.map()`. After the existing fields, add:

```ts
paymentStatus:   String(resolveField(row, mapping.paymentStatus) ?? '').trim(),
refundAmount:    parseAmount(resolveField(row, mapping.refundAmount)),
recurringStatus: String(resolveField(row, mapping.recurringStatus) ?? '').trim(),
fund:            String(resolveField(row, mapping.fund) ?? '').trim(),
```

The full returned object becomes:

```ts
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
  paymentStatus:   String(resolveField(row, mapping.paymentStatus) ?? '').trim(),
  refundAmount:    parseAmount(resolveField(row, mapping.refundAmount)),
  recurringStatus: String(resolveField(row, mapping.recurringStatus) ?? '').trim(),
  fund:            String(resolveField(row, mapping.fund) ?? '').trim(),
};
```

- [ ] **Step 5: Verify compilation**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/utils/excelParser.ts
git commit -m "feat: extend detectColumns and buildDonations with new insight and info fields"
```

---

### Task 4: Update `insightsEngine.ts`

**Files:**
- Modify: `src/utils/insightsEngine.ts`

- [ ] **Step 1: Add the failed-status filter set constant at the top of the file (after imports)**

```ts
const FAILED_STATUSES = new Set(['refunded', 'failed', 'cancelled', 'chargeback']);
```

- [ ] **Step 2: Update `computeInsights()` to filter by payment status and compute new breakdowns**

Replace the body of `computeInsights` with the following (preserving all existing logic, adding new):

```ts
export function computeInsights(donations: Donation[]): DonationInsights {
  const year = detectRamadanYear(donations);
  const currency = donations[0]?.currency || 'SAR';

  // Step 1: effective donations — exclude failed/refunded statuses
  const effective = donations.filter(
    d => !FAILED_STATUSES.has(d.paymentStatus.toLowerCase().trim())
  );

  // Step 2: gross total (existing `total` field)
  const total = effective.reduce((s, d) => s + d.amount, 0);
  const count = effective.length;
  const average = count > 0 ? total / count : 0;

  // Step 3: net total (gross minus partial refunds on effective donations)
  const netTotal = total - effective.reduce((s, d) => s + d.refundAmount, 0);
  const refundCount = donations.length - effective.length;

  const largest = effective.reduce<Donation | null>(
    (best, d) => (!best || d.amount > best.amount ? d : best), null
  );

  // By day
  const dayMap = new Map<string, { date: Date; amount: number; count: number }>();
  for (const d of effective) {
    if (!d.date) continue;
    const key = d.date.toISOString().split('T')[0];
    const existing = dayMap.get(key);
    if (existing) { existing.amount += d.amount; existing.count++; }
    else dayMap.set(key, { date: new Date(d.date), amount: d.amount, count: 1 });
  }
  const donationsByDay = Array.from(dayMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
  const mostGenerousDay = donationsByDay.reduce<{ date: Date; amount: number; count: number } | null>(
    (best, d) => (!best || d.amount > best.amount ? d : best), null
  );

  // By category
  const categoryMap = new Map<string, { name: string; amount: number; count: number }>();
  for (const d of effective) {
    const key = d.category || 'Uncategorized';
    const existing = categoryMap.get(key);
    if (existing) { existing.amount += d.amount; existing.count++; }
    else categoryMap.set(key, { name: key, amount: d.amount, count: 1 });
  }
  const donationsByCategory = Array.from(categoryMap.values()).sort((a, b) => b.amount - a.amount);

  // By organization
  const orgMap = new Map<string, { name: string; amount: number; count: number }>();
  for (const d of effective) {
    const key = d.organization || 'Unknown';
    const existing = orgMap.get(key);
    if (existing) { existing.amount += d.amount; existing.count++; }
    else orgMap.set(key, { name: key, amount: d.amount, count: 1 });
  }
  const donationsByOrganization = Array.from(orgMap.values()).sort((a, b) => b.amount - a.amount);

  const topOrganization = donationsByOrganization[0] || null;
  const topCategory = donationsByCategory[0] || null;

  // Last 10 nights
  let last10NightsTotal = 0;
  let last10NightsCount = 0;
  if (year && RAMADAN_RANGES[year]) {
    const [start] = RAMADAN_RANGES[year];
    const day21 = new Date(start);
    day21.setDate(day21.getDate() + 20);
    for (const d of effective) {
      if (d.date && d.date >= day21) { last10NightsTotal += d.amount; last10NightsCount++; }
    }
  }

  // Step 4: recurring breakdown
  let recurringCount = 0;
  let oneTimeCount = 0;
  for (const d of effective) {
    if (d.recurringStatus.toLowerCase().includes('recurring')) recurringCount++;
    else oneTimeCount++;
  }

  // Step 5: fund breakdown
  const fundMap = new Map<string, { name: string; amount: number; count: number }>();
  for (const d of effective) {
    const key = d.fund || 'Undesignated';
    const existing = fundMap.get(key);
    if (existing) { existing.amount += d.amount; existing.count++; }
    else fundMap.set(key, { name: key, amount: d.amount, count: 1 });
  }
  const donationsByFund = Array.from(fundMap.values()).sort((a, b) => b.amount - a.amount);
  const topFund = donationsByFund[0] || null;

  return {
    total,
    count,
    average,
    largest,
    mostGenerousDay,
    topOrganization,
    topCategory,
    currency,
    donationsByDay,
    donationsByCategory,
    donationsByOrganization,
    last10NightsTotal,
    last10NightsCount,
    ramadanYear: year,
    netTotal,
    refundCount,
    recurringCount,
    oneTimeCount,
    donationsByFund,
    topFund,
  };
}
```

- [ ] **Step 3: Verify compilation**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/utils/insightsEngine.ts
git commit -m "feat: add payment status filtering, net total, recurring and fund breakdowns to insights engine"
```

---

### Task 5: Extract `CurrencyPicker` component

**Files:**
- Create: `src/components/CurrencyPicker.tsx`

> Extract the currency pill-picker UI from `MappingSandbox` into a standalone component so `MappingTable` can use it without duplicating code.

- [ ] **Step 1: Create `CurrencyPicker.tsx`**

```tsx
import { useState } from 'react';

const COMMON_CURRENCIES = [
  { code: 'USD', sub: 'US Dollar' },
  { code: 'SAR', sub: 'Saudi Riyal' },
  { code: 'AED', sub: 'UAE Dirham' },
  { code: 'GBP', sub: 'Pound Sterling' },
  { code: 'EUR', sub: 'Euro' },
  { code: 'QAR', sub: 'Qatari Riyal' },
  { code: 'KWD', sub: 'Kuwaiti Dinar' },
  { code: 'EGP', sub: 'Egyptian Pound' },
  { code: 'PKR', sub: 'Pakistani Rupee' },
  { code: 'BDT', sub: 'Bangladeshi Taka' },
  { code: 'MYR', sub: 'Malaysian Ringgit' },
  { code: 'TRY', sub: 'Turkish Lira' },
];

interface Props {
  value: string;
  onChange: (currency: string) => void;
  hasCurrencyColumn: boolean;
}

export function CurrencyPicker({ value, onChange, hasCurrencyColumn }: Props) {
  const isCommon = COMMON_CURRENCIES.some(c => c.code === value);
  const [otherCurrency, setOtherCurrency] = useState(isCommon ? '' : value);
  const [showOther, setShowOther] = useState(!isCommon);

  const label13: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: 8, display: 'block',
  };

  const setCurrency = (code: string) => {
    setShowOther(false);
    onChange(code);
  };

  const handleOtherInput = (val: string) => {
    const upper = val.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
    setOtherCurrency(upper);
    if (upper.length >= 2) onChange(upper);
  };

  return (
    <div>
      <span style={label13}>Default Currency</span>
      <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10, marginTop: -4 }}>
        Used when no currency column is mapped or a cell is empty.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {COMMON_CURRENCIES.map(({ code, sub }) => {
          const active = !showOther && value === code;
          return (
            <button
              key={code}
              onClick={() => setCurrency(code)}
              title={sub}
              style={{
                padding: '6px 14px', borderRadius: 'var(--radius-sm)',
                border: `1px solid ${active ? 'var(--green)' : 'var(--border2)'}`,
                background: active ? 'var(--green-bg)' : 'var(--surface2)',
                color: active ? 'var(--green)' : 'var(--text2)',
                fontSize: 13, fontWeight: active ? 700 : 500, cursor: 'pointer', transition: 'all 140ms',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = 'var(--green)'; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = 'var(--border2)'; }}
            >
              {code}
            </button>
          );
        })}
        <button
          onClick={() => { setShowOther(true); onChange(otherCurrency || ''); }}
          style={{
            padding: '6px 14px', borderRadius: 'var(--radius-sm)',
            border: `1px solid ${showOther ? 'var(--green)' : 'var(--border2)'}`,
            background: showOther ? 'var(--green-bg)' : 'var(--surface2)',
            color: showOther ? 'var(--green)' : 'var(--text2)',
            fontSize: 13, fontWeight: showOther ? 700 : 500, cursor: 'pointer', transition: 'all 140ms',
          }}
        >
          Other
        </button>
      </div>
      {showOther && (
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="text"
            maxLength={3}
            placeholder="e.g. BHD"
            value={otherCurrency}
            onChange={e => handleOtherInput(e.target.value)}
            style={{
              width: 90, padding: '7px 10px',
              border: `1px solid ${otherCurrency.length >= 2 ? 'var(--green)' : 'var(--border2)'}`,
              borderRadius: 'var(--radius-sm)',
              background: 'var(--surface)', color: 'var(--text)',
              fontSize: 14, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', outline: 'none',
            }}
            autoFocus
          />
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>3-letter ISO code</span>
        </div>
      )}
      {hasCurrencyColumn && (
        <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text3)' }}>
          <span style={{ color: 'var(--green)', fontWeight: 600 }}>Currency column mapped</span> — per-row values will be used; default is the fallback only.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify compilation**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/CurrencyPicker.tsx
git commit -m "feat: extract CurrencyPicker into standalone component"
```

---

### Task 6: Build `MappingTable` component

**Files:**
- Create: `src/components/MappingTable.tsx`

- [ ] **Step 1: Create `MappingTable.tsx`**

```tsx
import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import type { ColumnMapping, CustomColumn } from '../types';
import { FIELD_DEFINITIONS, type FieldDefinition } from '../utils/fieldDefinitions';
import { CurrencyPicker } from './CurrencyPicker';

interface Props {
  headers: string[];
  mapping: ColumnMapping;
  onChange: (mapping: ColumnMapping) => void;
  previewRows: Record<string, unknown>[];
}

// How many data preview rows to show
const PREVIEW_ROW_COUNT = 4;

// Get the currently mapped source column for a field definition
function getSourceColumn(mapping: ColumnMapping, def: FieldDefinition): string {
  if (def.mappingKey === 'custom') {
    return mapping.customColumns.find(c => c.id === def.id)?.sourceColumn ?? '';
  }
  const val = mapping[def.mappingKey as keyof ColumnMapping];
  if (!val || typeof val !== 'string') return '';
  return val;
}

// Update mapping when user changes a dropdown
function applyColumnChange(
  mapping: ColumnMapping,
  def: FieldDefinition,
  newSource: string,
): ColumnMapping {
  if (def.mappingKey === 'custom') {
    const exists = mapping.customColumns.find(c => c.id === def.id);
    if (!newSource) {
      // "Not mapped" selected — remove the entry
      return { ...mapping, customColumns: mapping.customColumns.filter(c => c.id !== def.id) };
    }
    if (exists) {
      return {
        ...mapping,
        customColumns: mapping.customColumns.map(c =>
          c.id === def.id ? { ...c, sourceColumn: newSource } : c
        ),
      };
    }
    // Not yet in customColumns — add it
    const newCol: CustomColumn = { id: def.id, label: def.label, sourceColumn: newSource };
    return { ...mapping, customColumns: [...mapping.customColumns, newCol] };
  }
  // Insight field
  const key = def.mappingKey as keyof ColumnMapping;
  return { ...mapping, [key]: newSource || null };
}

export function MappingTable({ headers, mapping, onChange, previewRows }: Props) {
  const [addingCustom, setAddingCustom] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newSource, setNewSource] = useState('');

  const previewSlice = previewRows.slice(0, PREVIEW_ROW_COUNT);

  const getCellValue = (sourceCol: string, row: Record<string, unknown>): string => {
    if (!sourceCol) return '—';
    const val = row[sourceCol];
    if (val === null || val === undefined || val === '') return '—';
    return String(val).slice(0, 25);
  };

  const handleDropdownChange = (def: FieldDefinition, value: string) => {
    onChange(applyColumnChange(mapping, def, value));
  };

  const commitCustomField = () => {
    if (!newLabel.trim() || !newSource) { cancelCustomField(); return; }
    const newCol: CustomColumn = {
      id: crypto.randomUUID(),
      label: newLabel.trim(),
      sourceColumn: newSource,
    };
    onChange({ ...mapping, customColumns: [...mapping.customColumns, newCol] });
    setAddingCustom(false);
    setNewLabel('');
    setNewSource('');
  };

  const cancelCustomField = () => {
    setAddingCustom(false);
    setNewLabel('');
    setNewSource('');
  };

  const removeCustomColumn = (id: string) => {
    onChange({ ...mapping, customColumns: mapping.customColumns.filter(c => c.id !== id) });
  };

  // Columns to render: predefined fields (in FIELD_DEFINITIONS order) + freeform custom columns
  // Freeform custom columns are those in mapping.customColumns whose id is NOT a FIELD_DEFINITIONS id
  const predefinedIds = new Set(FIELD_DEFINITIONS.map(d => d.id));
  const freeformCustom = mapping.customColumns.filter(c => !predefinedIds.has(c.id));

  const thStyle: React.CSSProperties = {
    padding: '8px 10px',
    borderBottom: '2px solid var(--border)',
    borderRight: '1px solid var(--border)',
    background: 'var(--surface2)',
    whiteSpace: 'nowrap',
    verticalAlign: 'bottom',
    minWidth: 140,
  };

  const tdStyle: React.CSSProperties = {
    padding: '7px 10px',
    borderBottom: '1px solid var(--border)',
    borderRight: '1px solid var(--border)',
    fontSize: 12,
    color: 'var(--text2)',
    maxWidth: 180,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
          <thead>
            <tr>
              {FIELD_DEFINITIONS.map(def => {
                const sourceCol = getSourceColumn(mapping, def);
                const isMapped = !!sourceCol;
                const isInsight = def.role === 'insight';
                return (
                  <th
                    key={def.id}
                    style={thStyle}
                    title={isMapped ? `← ${sourceCol}` : ''}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                      {isInsight && (
                        <span style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: 'var(--green)', flexShrink: 0,
                        }} />
                      )}
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: isMapped ? 'var(--text)' : 'var(--text3)',
                        letterSpacing: '0.04em',
                      }}>
                        {def.label}
                        {def.required && <span style={{ color: 'var(--red)', marginLeft: 2 }}>*</span>}
                      </span>
                    </div>
                    <select
                      value={sourceCol}
                      onChange={e => handleDropdownChange(def, e.target.value)}
                      style={{
                        width: '100%', padding: '4px 6px',
                        border: `1px solid ${def.required && !isMapped ? 'var(--red)' : isMapped ? 'var(--green-ring)' : 'var(--border2)'}`,
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--surface)', color: 'var(--text)',
                        fontSize: 11, outline: 'none', cursor: 'pointer',
                      }}
                    >
                      <option value="">— Not mapped —</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </th>
                );
              })}

              {/* Freeform custom columns */}
              {freeformCustom.map(col => (
                <th key={col.id} style={thStyle} title={`← ${col.sourceColumn}`}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', letterSpacing: '0.04em' }}>
                      {col.label}
                    </span>
                    <button
                      onClick={() => removeCustomColumn(col.id)}
                      style={{
                        marginLeft: 'auto', width: 14, height: 14, border: 'none',
                        background: 'none', color: 'var(--text3)', cursor: 'pointer',
                        padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <X size={10} />
                    </button>
                  </div>
                  <select
                    value={col.sourceColumn}
                    onChange={e => {
                      const updated = mapping.customColumns.map(c =>
                        c.id === col.id ? { ...c, sourceColumn: e.target.value } : c
                      );
                      onChange({ ...mapping, customColumns: updated });
                    }}
                    style={{
                      width: '100%', padding: '4px 6px',
                      border: `1px solid ${col.sourceColumn ? 'var(--green-ring)' : 'var(--border2)'}`,
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--surface)', color: 'var(--text)',
                      fontSize: 11, outline: 'none', cursor: 'pointer',
                    }}
                  >
                    <option value="">— Not mapped —</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </th>
              ))}

              {/* [+ Add] column */}
              <th style={{ ...thStyle, minWidth: addingCustom ? 240 : 80, background: 'var(--surface)' }}>
                {addingCustom ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <input
                      autoFocus
                      placeholder="Field label"
                      value={newLabel}
                      onChange={e => setNewLabel(e.target.value)}
                      onBlur={() => { if (!newLabel.trim()) cancelCustomField(); }}
                      onKeyDown={e => { if (e.key === 'Enter') commitCustomField(); if (e.key === 'Escape') cancelCustomField(); }}
                      style={{
                        width: '100%', padding: '4px 6px',
                        border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)',
                        background: 'var(--surface)', color: 'var(--text)', fontSize: 11, outline: 'none',
                      }}
                    />
                    <select
                      value={newSource}
                      onChange={e => { setNewSource(e.target.value); }}
                      style={{
                        width: '100%', padding: '4px 6px',
                        border: `1px solid ${newSource ? 'var(--green-ring)' : 'var(--border2)'}`,
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--surface)', color: 'var(--text)', fontSize: 11, outline: 'none',
                      }}
                    >
                      <option value="">— Pick column —</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={commitCustomField}
                        disabled={!newLabel.trim() || !newSource}
                        style={{
                          flex: 1, padding: '3px 6px', fontSize: 10, fontWeight: 700,
                          background: 'var(--green)', color: 'white', border: 'none',
                          borderRadius: 'var(--radius-sm)', cursor: 'pointer', opacity: (!newLabel.trim() || !newSource) ? 0.4 : 1,
                        }}
                      >
                        Add
                      </button>
                      <button
                        onClick={cancelCustomField}
                        style={{
                          padding: '3px 6px', fontSize: 10,
                          background: 'none', color: 'var(--text3)',
                          border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingCustom(true)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '5px 10px', background: 'none',
                      border: '1px dashed var(--border2)', borderRadius: 'var(--radius-sm)',
                      color: 'var(--text3)', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    <Plus size={11} /> Add field
                  </button>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {previewSlice.length === 0 ? (
              <tr>
                <td
                  colSpan={FIELD_DEFINITIONS.length + freeformCustom.length + 1}
                  style={{ ...tdStyle, textAlign: 'center', color: 'var(--text3)', padding: '20px' }}
                >
                  No preview rows available
                </td>
              </tr>
            ) : (
              previewSlice.map((row, rowIdx) => (
                <tr key={rowIdx} style={{ background: rowIdx % 2 === 0 ? 'var(--surface)' : 'var(--surface2)' }}>
                  {FIELD_DEFINITIONS.map(def => {
                    const sourceCol = getSourceColumn(mapping, def);
                    return (
                      <td key={def.id} style={tdStyle}>
                        {getCellValue(sourceCol, row)}
                      </td>
                    );
                  })}
                  {freeformCustom.map(col => (
                    <td key={col.id} style={tdStyle}>
                      {getCellValue(col.sourceColumn, row)}
                    </td>
                  ))}
                  <td style={{ ...tdStyle, background: 'var(--surface)' }} />
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Currency picker below table */}
      <div style={{ height: 1, background: 'var(--border)' }} />
      <CurrencyPicker
        value={mapping.forcedCurrency}
        onChange={fc => onChange({ ...mapping, forcedCurrency: fc })}
        hasCurrencyColumn={!!mapping.currency}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify compilation**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/MappingTable.tsx src/components/CurrencyPicker.tsx
git commit -m "feat: add MappingTable — Excel-style column mapping UI with dropdowns and data preview"
```

---

### Task 7: Wire up MappingTable and remove MappingSandbox

**Files:**
- Modify: `src/pages/LandingPage.tsx`
- Delete: `src/components/MappingSandbox.tsx`

- [ ] **Step 1: Update the import in `LandingPage.tsx`**

Replace line 8:
```ts
import { MappingSandbox } from '../components/MappingSandbox';
```
with:
```ts
import { MappingTable } from '../components/MappingTable';
```

- [ ] **Step 2: Replace the component usage in `LandingPage.tsx`**

Find the JSX at around line 299:
```tsx
<MappingSandbox
  headers={currentSheet.headers}
  mapping={ctx.columnMapping}
  onChange={ctx.setColumnMapping}
  previewRows={currentSheet.rows.slice(0, 3)}
/>
```
Replace with:
```tsx
{/* slice(0, 5): MappingTable shows up to PREVIEW_ROW_COUNT=4 rows; 5 gives a small buffer */}
<MappingTable
  headers={currentSheet.headers}
  mapping={ctx.columnMapping}
  onChange={ctx.setColumnMapping}
  previewRows={currentSheet.rows.slice(0, 5)}
/>
```

- [ ] **Step 3: Verify compilation**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 4: Delete `MappingSandbox.tsx`**

```bash
rm src/components/MappingSandbox.tsx
```

- [ ] **Step 5: Verify again after deletion**

```bash
npm run build
```

Expected: no errors. If any file still imports `MappingSandbox`, fix the import before continuing.

- [ ] **Step 6: Manual smoke test**

```bash
npm run dev
```

1. Open `http://localhost:5173`
2. Upload any `.xlsx` file
3. Verify the mapping step shows a horizontally scrollable table with column headers as dropdowns
4. Verify real data rows appear beneath the headers
5. Hover a header — verify tooltip shows the source column name
6. Change a dropdown — verify the data rows update to reflect the new column
7. Click "+ Add field" — fill in label + pick a column — verify a new column appears in the table
8. Click "Continue" without mapping Amount — verify the red error outline appears on the Amount dropdown
9. Map Amount and click "Continue" — verify it proceeds to step 2 / recap

- [ ] **Step 7: Commit**

```bash
git add src/pages/LandingPage.tsx
git rm src/components/MappingSandbox.tsx
git commit -m "feat: wire up MappingTable, remove MappingSandbox"
```
