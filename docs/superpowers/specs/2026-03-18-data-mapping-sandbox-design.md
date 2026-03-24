# Data Mapping Sandbox — Design Spec
**Date:** 2026-03-18
**Status:** Draft

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
| `src/pages/LandingPage.tsx` | Swap import name only — props are identical (`headers`, `mapping`, `onChange`, `previewRows` already passed) |
| `src/types/index.ts` | Extend `ColumnMapping` field types to `string \| string[] \| null` |
| `src/utils/excelParser.ts` | Add `resolveField()` helper for multi-column fallback logic |

### Props (MappingSandbox)

Identical interface to the current `ColumnMapper` — `LandingPage` already passes all four props:

```ts
interface Props {
  headers: string[];          // all column names from the selected sheet
  mapping: ColumnMapping;     // current mapping state (from DonationContext)
  onChange: (mapping: ColumnMapping) => void;
  previewRows: Record<string, unknown>[];  // currentSheet.rows.slice(0, 3), already passed
}
```

The only change in `LandingPage` is the import name: `ColumnMapper` → `MappingSandbox`.

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
  customColumns: CustomColumn[];  // unchanged — see existing definition in types/index.ts
}
```

**Backward compatibility:** `resolveField` handles both `string` and `string[]` — existing single-string values continue to work without migration. No serialized state is persisted between sessions, so there is no migration concern.

---

## Parser Change (`src/utils/excelParser.ts`)

Add a `resolveField` helper used inside `buildDonations`. `detectColumns()` already exists in this file and is unchanged — it returns an initial `ColumnMapping` with single `string | null` values, which are valid under the new type.

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
- Cards already placed in a zone remain visible in the pool as **ghosts** (faded, dashed outline) so the user can see all columns at a glance. A ghost in the pool is the canonical indicator that a column is assigned elsewhere.
- **Interacting with a ghost:** clicking it removes it from its assigned zone and returns it to active (non-ghost) state in the pool. Dragging a ghost from the pool to a new zone moves the assignment: it is removed from its previous zone and placed in the target zone.
- There is no explicit pool "drop zone" — the pool passively reflects whatever is not assigned. Dragging a card out of a zone and dropping it anywhere outside a valid zone (core or extra) returns it to the pool (unmapped state). Dropping outside all zones is equivalent to dropping on the pool.

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
- On `dragover`: border and background highlight using `var(--green)` (the app's existing gold-teal accent, CSS variable `--green`)
- Required zone (Amount): red asterisk on the label; red ring on the zone if the user tries to continue with it empty
- Each placed card shows column name + example value + ×-button to return card to pool (unmapped)
- Multiple cards per zone supported — first non-empty value per row wins (`resolveField`)
- Cards can be dragged freely between zones

### 3. Extra Columns Zone (bottom)

- Visually distinct background (e.g. `var(--surface3)`)
- Cards dropped here become `CustomColumn` entries: `{ id: Date.now(), label: header, sourceColumn: header }`
- Each card has an inline editable label input so the user can rename "ref_no" → "Reference No."
- Cards removable with ×-button (removes the `CustomColumn` entry)
- **Duplicate prevention:** if a column already present in the Extra Columns zone is dropped again (e.g. a ghost dragged back to the same zone), the drop is silently ignored — no duplicate entry is created.

### Currency Fallback (below zones)

- The existing `forcedCurrency` pill-picker is preserved unchanged
- Rendered below the sandbox, not a drag target

---

## Drag Mechanics

**State:** `draggedColumn: string | null` — local to `MappingSandbox`, no context changes.

**Drop behaviour:**

| Source | Target | Result |
|--------|--------|--------|
| Pool (active) | Core zone | Assign column to field; card becomes ghost in pool |
| Pool (active) | Extra zone | Create `CustomColumn`; card becomes ghost in pool |
| Pool (ghost) | Core zone | Move assignment: remove from previous zone, assign to new zone |
| Pool (ghost) | Extra zone | Move assignment: remove from previous zone, add to extra zone |
| Core zone card | Different core zone | Remove from source, assign to target |
| Core zone card | Extra zone | Remove from source core field, add to extra zone |
| Extra zone card | Core zone | Remove from extra zone, assign to core field |
| Core/Extra zone card | Outside all zones | Remove from source, return to pool (unmapped) |
| Any card | Same zone | No-op |

**Auto-detection on load:**
`detectColumns()` (existing, in `src/utils/excelParser.ts`) returns an initial `ColumnMapping`. `MappingSandbox` diffs `headers` against all values in the mapping to determine which cards start pre-placed in zones vs. active in the pool.

---

## UX Details

**Column cards:**
- GripVertical drag handle on the left
- Column name as the primary label
- Example value from `previewRows[0][header]` (muted font, truncated to ~30 chars)
  - Fallback if `previewRows` is empty or the column has no value in row 0: render an em-dash (`—`) in place of the example value
- `opacity: 0.4` on the dragged card while in flight; `cursor: grabbing`
- Ghost state (placed elsewhere): `opacity: 0.35`, dashed outline, normal cursor

**Continue validation:**
- Amount zone must have ≥1 card — existing `handleMapContinue` check in `LandingPage` is unchanged (it checks `ctx.columnMapping.amount`)
- Error message shown inline if the user tries to continue without Amount mapped

**No behaviour changes** to Step 2 (Categorise) or Step 3 (Recap/Dashboard).

---

## Out of Scope

- Reordering cards within a zone (order doesn't affect output — `resolveField` iterates in array order)
- Saving/restoring mapping between sessions
- Making the app fully domain-agnostic (fields remain donation-specific)
- Any changes to the RecapPage or insights engine
