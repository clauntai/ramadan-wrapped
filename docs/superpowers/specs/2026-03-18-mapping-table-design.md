# Mapping Table — Design Spec
**Date:** 2026-03-18
**Status:** Approved

---

## Overview

Replace the drag-and-drop `MappingSandbox` with a `MappingTable` — an Excel-style preview table where the column headers are dropdowns that let users assign source spreadsheet columns to destination fields. Real data rows appear beneath each header so users can immediately verify the mapping is correct.

---

## Goals

- Make mapping intuitive by showing actual data under each field header
- Support a rich, predefined set of donation-platform fields (payment status, buyer info, tax receipt, etc.) with auto-detection
- Keep the system dynamic: new informational fields can be added by extending `FIELD_DEFINITIONS` only — no structural changes required
- Drive insights from four new semantic fields: payment status, refund amount, recurring status, fund

---

## UI Design

### Table Layout

A single horizontally scrollable table. One header row. Data rows beneath.

```
| Payment Date ▼ | Total Amount ▼ | Fund ▼  | First Name ▼ | Email ▼  | [+ Add] |
|----------------|----------------|---------|--------------|----------|---------|
| 2024-03-15     | 250.00         | Zakat   | Ahmed        | a@x.com  |         |
| 2024-03-16     | 100.00         | Sadaqah | Sara         | s@x.com  |         |
| 2024-03-17     | 75.00          | —       | Mohamed      | m@x.com  |         |
```

**Header row:**
- Each cell shows the destination field label + a dropdown chevron (▼)
- Clicking/hovering opens a `<select>` listing all source columns from the spreadsheet + "— Not mapped —" at the top
- Hovering the header shows a tooltip with the currently mapped source column name (e.g. `← Payment_Date_UTC`)
- Insight fields get a small coloured dot indicator (teal, matching `var(--green)`)
- Required field (Total Amount) gets a red `*`; red outline on the dropdown if user tries to continue without it mapped
- Unmapped field headers are muted (greyed label)

**Data rows:**
- Show first 3–5 rows from the selected sheet
- Each cell displays `previewRows[n][sourceColumn]` for the mapped column
- Unmapped columns and empty cells show `—`
- Row values truncated to ~25 chars

**`[+ Add]` column:**
- Fixed at the far right
- Opens an inline form: text input for label + dropdown for source column
- Creates a custom informational entry (appended to `customColumns`)
- Removable with ×

**Default Currency picker** remains below the table, unchanged.

---

## Field Definitions

A new file `src/utils/fieldDefinitions.ts` is the single source of truth for all predefined fields.

```ts
export type FieldGroup = 'transaction' | 'buyer' | 'tax';
export type FieldRole = 'insight' | 'info';

export interface FieldDefinition {
  id: string;                        // stable key
  label: string;                     // display label in the table header
  group: FieldGroup;
  role: FieldRole;
  required?: boolean;
  mappingKey: keyof ColumnMapping | 'custom'; // 'custom' → goes to customColumns
  autoDetectHints: string[];
}
```

### Predefined Fields

> **Note on multi-column mapping:** `MappingSandbox` supported multiple source columns per field (`string[]`). `MappingTable` uses single-select dropdowns, so each field maps to exactly one source column. This affects the existing `date`, `amount`, `organization`, `category`, `notes`, and `currency` fields — they remain `string | string[] | null` in the type for backward compatibility, but `MappingTable` will only ever write a `string` or `null` to them. The multi-column fallback logic in `resolveField()` is preserved and still works; it just won't be triggered unless a mapping was loaded from a prior session (which isn't supported anyway).

#### Transaction Details

| id | label | role | mappingKey | hints |
|----|-------|------|------------|-------|
| `date` | Payment Date | insight | `date` | date, day, when, time, dt |
| `amount` | Total Amount | insight | `amount` | amount, sum, total, donation, value, price, payment, paid |
| `organization` | Organisation | insight | `organization` | org, organization, charity, recipient, to, beneficiary |
| `category` | Category / Cause | insight | `category` | category, type, cause, purpose, kind, group |
| `currency` | Currency Column | insight | `currency` | currency, curr, ccy |
| `notes` | Notes | insight | `notes` | note, notes, comment, description, detail |
| `paymentMethod` | Payment Method | info | custom | method, payment method, pay method |
| `paymentStatus` | Payment Status | insight | `paymentStatus` | status, payment status, state, transaction status |
| `payoutDate` | Payout Date | info | custom | payout, payout date, disbursement |
| `extraDonation` | Extra Donation | info | custom | extra, tip, additional, add-on |
| `refundAmount` | Refund Amount | insight | `refundAmount` | refund, refunded, chargeback |
| `recurringStatus` | Recurring Status | insight | `recurringStatus` | recurring, recurrence, subscription, frequency |
| `discount` | Discount | info | custom | discount, promo, coupon |
| `fund` | Fund | insight | `fund` | fund, campaign, cause, appeal, designation |

#### Buyer Information

| id | label | role | mappingKey | hints |
|----|-------|------|------------|-------|
| `firstName` | First Name | info | custom | first name, first, fname, given name |
| `lastName` | Last Name | info | custom | last name, last, lname, surname, family name |
| `email` | Email | info | custom | email, e-mail, email address |
| `companyName` | Company Name | info | custom | company, organization, employer, business |
| `address` | Address | info | custom | address, street, addr |
| `city` | City | info | custom | city, town, municipality |
| `postalCode` | Postal Code | info | custom | postal, zip, postcode, postal code |
| `state` | State | info | custom | state, province, region |
| `country` | Country | info | custom | country, nation |
| `language` | Language | info | custom | language, lang, locale |

#### Tax Receipt Information

| id | label | role | mappingKey | hints |
|----|-------|------|------------|-------|
| `taxReceipt` | Tax Receipt # | info | custom | tax receipt, receipt, receipt number, tax no |

---

## Data Model Changes

> **Implementation order:** `src/types/index.ts` must be updated first. `fieldDefinitions.ts` uses `keyof ColumnMapping` in its `mappingKey` type — it will not compile until the four new fields exist on `ColumnMapping`. `DonationContext.tsx` constructs a `defaultMapping` object literal; it must also be updated in the same pass to add the four new fields, or TypeScript will reject it.

### `src/types/index.ts`

**`ColumnMapping`** — add four new insight fields:

```ts
export interface ColumnMapping {
  // existing
  date:         string | string[] | null;
  amount:       string | string[] | null;
  organization: string | string[] | null;
  category:     string | string[] | null;
  notes:        string | string[] | null;
  currency:     string | string[] | null;
  forcedCurrency: string;
  customColumns: CustomColumn[];
  // new insight fields — string | null (not string | string[] | null)
  // because MappingTable uses single-select dropdowns; multi-column
  // mapping is intentionally not supported for these fields.
  paymentStatus:   string | null;
  refundAmount:    string | null;
  recurringStatus: string | null;
  fund:            string | null;
}
```

**`Donation`** — add four new insight fields:

```ts
export interface Donation {
  // existing
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
  paymentStatus:   string;   // e.g. "Completed", "Refunded", "Failed"
  refundAmount:    number;   // amount refunded (subtracted from net total)
  recurringStatus: string;   // e.g. "Recurring", "One-time"
  fund:            string;   // e.g. "Zakat", "Sadaqah", "General"
}
```

**`DonationInsights`** — add new breakdowns:

```ts
export interface DonationInsights {
  // existing fields unchanged ...
  netTotal:              number;   // total - sum(refundAmount)
  refundCount:           number;
  recurringCount:        number;
  oneTimeCount:          number;
  donationsByFund:       { name: string; amount: number; count: number }[];
  topFund:               { name: string; amount: number; count: number } | null;
}
```

---

## Parser Changes (`src/utils/excelParser.ts`)

**`detectColumns()`** — add hint arrays and scoring for new insight fields:

```ts
const PAYMENT_STATUS_HINTS   = ['status', 'payment status', 'state', 'transaction status'];
const REFUND_AMOUNT_HINTS    = ['refund', 'refunded', 'chargeback'];
const RECURRING_STATUS_HINTS = ['recurring', 'recurrence', 'subscription', 'frequency'];
const FUND_HINTS             = ['fund', 'campaign', 'cause', 'appeal', 'designation'];
```

The initialiser object inside `detectColumns()` must include the four new fields:

```ts
const mapping: ColumnMapping = {
  date: null, amount: null, organization: null, category: null,
  notes: null, currency: null, forcedCurrency: 'USD', customColumns: [],
  // new
  paymentStatus: null, refundAmount: null, recurringStatus: null, fund: null,
};
```

**Insight field detection:** uses `scoreColumn()` with a threshold of 30 (same as existing fields). Best-scoring column above threshold is assigned to the corresponding `ColumnMapping` key.

**Informational field auto-detection:** after scoring insight fields, `detectColumns()` iterates `FIELD_DEFINITIONS` entries where `mappingKey === 'custom'`. Each is scored against all headers using `scoreColumn()` at a threshold of 40 (slightly higher to reduce false positives for generic column names). On a match, the column is appended to `customColumns` with `label` set to `FieldDefinition.label` (the human-readable display label, e.g. `"First Name"`) and `sourceColumn` set to the matched header. **Conflict rule:** if a column has already been assigned to an insight field, it is skipped for informational auto-detection. Insight field assignment takes priority.

**`buildDonations()`** — populate new `Donation` fields:

```ts
paymentStatus:   String(resolveField(row, mapping.paymentStatus) ?? '').trim(),
refundAmount:    parseAmount(resolveField(row, mapping.refundAmount)),
recurringStatus: String(resolveField(row, mapping.recurringStatus) ?? '').trim(),
fund:            String(resolveField(row, mapping.fund) ?? '').trim(),
```

**Filtering** — `buildDonations` retains existing filter (`amount > 0`). Status-based filtering happens in the insights engine, not the parser, so the raw donation list remains complete.

---

## Insights Engine Changes (`src/utils/insightsEngine.ts`)

`computeInsights()` receives the full donation list and applies the following in order:

1. **Effective donations** = filter out rows where `paymentStatus` (lowercased, trimmed) matches the failed-set: `['refunded', 'failed', 'cancelled', 'chargeback']`. A row excluded here is excluded from all further calculations including the refund subtraction — its `refundAmount` is not counted because the transaction is treated as if it never completed. Only rows that pass this filter are used for totals, counts, averages, and breakdowns.
2. **Gross total** = `sum(amount)` across effective donations (same as existing `total`).
3. **Net total** = gross total − `sum(refundAmount)` across effective donations. A row can be an effective donation (status is not in the failed-set) and still carry a partial refund (e.g. status = "Partially Refunded"). Net total accounts for those partial refunds.
4. **Recurring breakdown** = group effective donations by `recurringStatus`. A row is counted as recurring if its `recurringStatus` (lowercased) contains `"recurring"`; otherwise one-time. Empty `recurringStatus` → one-time.
5. **Fund breakdown** = group effective donations by `fund` → `donationsByFund` / `topFund` (same pattern as existing `donationsByCategory`). Empty `fund` → grouped under `"Undesignated"`.

The `total` field retains the gross sum for transparency. `netTotal` is the spendable figure shown prominently in the recap.

---

## Component: `MappingTable`

### File
`src/components/MappingTable.tsx` — replaces `MappingSandbox.tsx` (deleted).

### Props
Identical to `MappingSandbox` — `LandingPage` changes only the import name:

```ts
interface Props {
  headers: string[];
  mapping: ColumnMapping;
  onChange: (mapping: ColumnMapping) => void;
  previewRows: Record<string, unknown>[];
}
```

### Internal structure

- Renders a `<table>` with `overflow-x: auto` wrapper
- Header row: one `<th>` per active field (predefined + custom). Each `<th>` contains a `<select>` populated with `["— Not mapped —", ...headers]`. Value = currently mapped source column or `""`.
- On `<select>` change: calls `onChange` with updated mapping. For insight fields, updates the corresponding `ColumnMapping` key (`string | null`). For info/custom fields, updates the matching `customColumns` entry's `sourceColumn`, or removes the entry if `""` is selected.
- Data rows (3–5): one `<td>` per column, value from `previewRows[n][sourceColumn]` or `—`.
- `[+ Add]` th at the far right: clicking it appends a blank custom column entry (`{ id: crypto.randomUUID(), label: '', sourceColumn: '' }`) to `customColumns`. The new column's `<th>` renders an editable label input in place of a static label + its own source dropdown. If the user clicks elsewhere without filling in the label, the entry is removed (cancelled). Auto-committed once both label and sourceColumn are non-empty.
- Tooltip on `<th>`: native `title` attribute showing `← ${sourceColumn}` when mapped, empty string when not mapped.

### `forcedCurrency` picker

The currency picker (pill buttons + "Other" input) is extracted into a shared `CurrencyPicker` component. `MappingTable` renders `<CurrencyPicker>` below the table, passing `mapping.forcedCurrency` and an `onChange` handler — identical behaviour to the current `MappingSandbox` implementation. The local state (`otherCurrency`, `showOther`) lives inside `CurrencyPicker`.

### Column ordering

Fields rendered left-to-right in `FIELD_DEFINITIONS` order (transaction group first, then buyer, then tax), followed by user-added custom columns. Insight fields appear before info fields within each group.

---

## Files Changed

| File | Change |
|------|--------|
| `src/types/index.ts` | Add 4 fields to `ColumnMapping`, `Donation`; add new `DonationInsights` fields |
| `src/utils/fieldDefinitions.ts` | **New** — `FieldDefinition` type + `FIELD_DEFINITIONS` array |
| `src/context/DonationContext.tsx` | Add 4 new fields to `defaultMapping` object literal |
| `src/utils/excelParser.ts` | Add hint arrays; extend `detectColumns()` initialiser and `buildDonations()` |
| `src/utils/insightsEngine.ts` | Status filtering, net total, recurring/fund breakdowns |
| `src/components/MappingTable.tsx` | **New** — table-based mapping UI |
| `src/components/CurrencyPicker.tsx` | **New** — extracted from `MappingSandbox`; shared by `MappingTable` |
| `src/components/MappingSandbox.tsx` | **Deleted** |
| `src/pages/LandingPage.tsx` | Swap import name only |

---

## Out of Scope

- Reordering columns within the table
- Saving/restoring mapping between sessions
- Exposing recurring/fund breakdowns in new RecapPage charts (data is computed; surfacing in charts is a separate task)
- Internationalisation of field labels
