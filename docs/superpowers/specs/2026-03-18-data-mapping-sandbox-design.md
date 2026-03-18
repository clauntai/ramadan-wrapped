# Data Mapping Sandbox — Design Spec
**Date:** 2026-03-18
**Status:** Approved

---

## Overview

Replace the current dropdown-based `ColumnMapper` component with a drag-and-drop `MappingSandbox`. Users drag their spreadsheet column cards into labeled drop zones, making the mapping step visual, intuitive, and accurate before any dashboard is generated.

---

## Goals

- Let users visually inspect their raw columns (with example data) before committing to a mapping
- Make mapping errors obvious and easy to fix via drag-and-drop
- Support messy/unexpected spreadsheets gracefully (multi-column fields, unrecognised columns)
- Keep donation-specific field semantics intact

---

## Architecture

### Files Changed

| File | Change |
|------|--------|
| `src/components/MappingSandbox.tsx` | **New** — replaces ColumnMapper |
| `src/components/ColumnMapper.tsx` | **Deleted** |
| `src/pages/LandingPage.tsx` | Swap import/usage of ColumnMapper → MappingSandbox |
| `src/types/index.ts` | Extend `ColumnMapping` field types to `string \| string[] \| null` |
| `src/utils/excelParser.ts` | Add `resolveField()` helper for multi-column fallback logic |

### Props (MappingSandbox)

Same interface as the current `ColumnMapper`:

```ts
interface Props {
  headers: string[];
  mapping: ColumnMapping;
  onChange: (mapping: ColumnMapping) => void;
  previewRows: Record<string, unknown>[];
}
```

No changes needed in `LandingPage` beyond the import swap.

---

## Type Changes (`src/types/index.ts`)

The six core mapping fields change from `string | null` to `string | string[] | null`:

```ts
interface ColumnMapping {
  date:         string | string[] | null;
  amount:       string | string[] | null;
  organization: string | string[] | null;
  category:     string | string[] | null;
  notes:        string | string[] | null;
  currency:     string | string[] | null;
  forcedCurrency: string;
  customColumns: CustomColumn[];
}
```

---

## Parser Change (`src/utils/excelParser.ts`)

Add a `resolveField` helper used inside `buildDonations`:

```ts
function resolveField(row: Record<string, unknown>, col: string | string[] | null): unknown {
  if (!col) return null;
  const cols = Array.isArray(col) ? col : [col];
  for (const c of cols) {
    const val = row[c];
    if (val !== null && val !== undefined && val !== '') return val;
  }
  return null;
}
```

All field reads in `buildDonations` use `resolveField(row, mapping.field)` instead of direct `row[mapping.field]` access.

---

## MappingSandbox Layout

Three vertical regions:

### 1. Column Pool (top)
- Wrapping flex row of draggable column cards
- Counter: "X of Y columns mapped" updates live
- Cards already placed in a zone appear as faded ghosts — clicking a ghost unassigns it and returns it to the active pool

### 2. Core Field Drop Zones (middle)
2-column grid with 6 zones:

| Zone | Icon | Required |
|------|------|----------|
| Amount | DollarSign | Yes |
| Date | Calendar | No |
| Organisation | Building2 | No |
| Category / Cause | Tag | No |
| Currency Column | BadgeDollarSign | No |
| Notes | FileText | No |

- Empty zone: dashed border
- Has cards: solid border, cards stack horizontally inside
- On `dragover`: border highlights gold (`var(--green)`)
- Required zone (Amount): red asterisk; red ring on continue if empty
- Each placed card shows column name + example value + ×-button to return to pool
- Multiple cards per zone supported — first non-empty value per row wins (resolveField)

### 3. Extra Columns Zone (bottom)
- Visually distinct background
- Cards dropped here become `CustomColumn` entries
- Inline editable label input per card (same as current custom columns)
- Cards removable with ×-button

### Currency Fallback (below zones)
- The existing `forcedCurrency` pill-picker is preserved unchanged
- Rendered below the sandbox, not a drag target

---

## Drag Mechanics

**State:** `draggedColumn: string | null` — local to `MappingSandbox`, no context changes.

**Drop behaviour:**
- Pool → Core zone: set `mapping[field]` to column (append if field already has value)
- Pool → Extra zone: append `CustomColumn { id, label: header, sourceColumn: header }`
- Zone card → different zone: remove from source, add to target
- Zone card → Pool (drag out): remove from source zone, return to unmapped state
- Zone card → same zone: no-op

**Auto-detection on load:**
`detectColumns()` returns initial `ColumnMapping`. `MappingSandbox` diffs `headers` against all mapped values to determine which cards start in the pool vs. pre-placed in zones.

---

## UX Details

**Column cards:**
- GripVertical drag handle on left
- Column name as label
- Example value from `previewRows[0]` (muted, truncated ~30 chars)
- `opacity: 0.4` while being dragged; `cursor: grabbing`
- Ghost state (placed elsewhere): `opacity: 0.35`, dashed outline

**Continue validation:**
- Amount zone must have ≥1 card — existing `handleMapContinue` check unchanged
- Error message shown if user tries to continue without Amount mapped

**No behaviour changes** to Step 2 (Categorise) or Step 3 (Recap/Dashboard).

---

## Out of Scope

- Reordering cards within a zone (order doesn't affect output)
- Saving/restoring mapping between sessions
- Making the app fully domain-agnostic (fields remain donation-specific)
- Any changes to the RecapPage or insights engine
