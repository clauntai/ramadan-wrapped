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

#### Transaction Details

| id | label | role | mappingKey | hints |
|----|-------|------|------------|-------|
| `date` | Payment Date | insight | `date` | date, day, when, time, dt |
| `amount` | Total Amount | insight | `amount` | amount, sum, total, donation, value, price, payment, paid |
| `paymentMethod` | Payment Method | info | custom | method, payment method, pay method, type |
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
  // new insight fields
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
const PAYMENT_STATUS_HINTS  = ['status', 'payment status', 'state', 'transaction status'];
const REFUND_AMOUNT_HINTS   = ['refund', 'refunded', 'chargeback'];
const RECURRING_STATUS_HINTS = ['recurring', 'recurrence', 'subscription', 'frequency'];
const FUND_HINTS             = ['fund', 'campaign', 'cause', 'appeal', 'designation'];
```

Detected insight columns are assigned to the new `ColumnMapping` keys. Detected informational columns (from `FIELD_DEFINITIONS` entries with `mappingKey: 'custom'`) are pre-populated as `customColumns` entries with their predefined labels.

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

`computeInsights()` receives the full donation list and applies:

1. **Effective donations** = filter out rows where `paymentStatus` matches a failed-set: `['refunded', 'failed', 'cancelled', 'chargeback']` (case-insensitive). Used for all totals and counts.
2. **Net total** = `sum(amount) - sum(refundAmount)` across effective donations.
3. **Recurring breakdown** = group by `recurringStatus` → `recurringCount` / `oneTimeCount`.
4. **Fund breakdown** = group by `fund` → `donationsByFund` / `topFund` (same pattern as existing `donationsByCategory`).

The `total` field retains the gross sum (pre-refund) for transparency. `netTotal` is the spendable figure shown prominently in the recap.

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
- Header row: one `<th>` per active field (predefined + custom). Each `<th>` contains a `<select>` populated with `["", ...headers]`. Value = currently mapped source column or `""`.
- On `<select>` change: calls `onChange` with updated mapping. For insight fields, updates the corresponding `ColumnMapping` key. For custom/info fields, updates `customColumns`.
- Data rows (3–5): one `<td>` per column, value from `previewRows[n][sourceColumn]` or `—`.
- `[+ Add]` th at the far right: click to append a new custom column row.
- Tooltip on `<th>`: native `title` attribute showing `← ${sourceColumn}` when mapped.

### Column ordering

Fields rendered left-to-right in `FIELD_DEFINITIONS` order (transaction group first, then buyer, then tax), followed by user-added custom columns. Insight fields appear before info fields within each group.

---

## Files Changed

| File | Change |
|------|--------|
| `src/types/index.ts` | Add 4 fields to `ColumnMapping`, `Donation`; add new `DonationInsights` fields; add `FieldDefinition` type |
| `src/utils/fieldDefinitions.ts` | **New** — `FIELD_DEFINITIONS` array |
| `src/utils/excelParser.ts` | Add hint arrays; extend `detectColumns()` and `buildDonations()` |
| `src/utils/insightsEngine.ts` | Status filtering, net total, recurring/fund breakdowns |
| `src/components/MappingTable.tsx` | **New** — table-based mapping UI |
| `src/components/MappingSandbox.tsx` | **Deleted** |
| `src/pages/LandingPage.tsx` | Swap import name only |

---

## Out of Scope

- Reordering columns within the table
- Saving/restoring mapping between sessions
- Exposing recurring/fund breakdowns in new RecapPage charts (data is computed; surfacing in charts is a separate task)
- Internationalisation of field labels
