# Data Mapping Sandbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dropdown `ColumnMapper` with a drag-and-drop `MappingSandbox` where users drag column cards into field drop zones for accurate, visual data mapping.

**Architecture:** `MappingSandbox` takes the same props as `ColumnMapper` (drop-in replacement). Column state is fully derived from the existing `ColumnMapping` type; no new context or global state. Pure helper functions handle all mapping mutations, keeping the component logic thin.

**Tech Stack:** React 19, TypeScript 5.9, Vite 8, HTML5 Drag-and-Drop API (no new dependencies), Lucide React icons.

---

> **Note on testing:** This project has no test runner configured. Verification uses `npm run build` (runs `tsc -b && vite build`) which catches all TypeScript type errors. Each task ends with a build check. After Task 4, manual smoke testing in the browser is required.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/types/index.ts` | Modify | Widen six `ColumnMapping` fields to `string \| string[] \| null` |
| `src/utils/excelParser.ts` | Modify | Add `resolveField()`, update `buildDonations` + `resolveRowCurrency` |
| `src/components/MappingSandbox.tsx` | Create | Full drag-and-drop mapping UI |
| `src/components/ColumnMapper.tsx` | Delete | Replaced by MappingSandbox |
| `src/pages/LandingPage.tsx` | Modify | Swap import name only |

---

## Task 1: Widen ColumnMapping Types

**Files:**
- Modify: `src/types/index.ts:19-28`

- [ ] **Step 1: Update the six core fields in `ColumnMapping`**

  In `src/types/index.ts`, replace the `ColumnMapping` interface body:

  ```ts
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
  ```

  Everything else in the file stays unchanged.

- [ ] **Step 2: Verify build passes**

  ```bash
  cd C:/Users/dinas/ramadan-wrapped && npm run build
  ```

  Expected: build succeeds. TypeScript will now flag any code that treats these fields as `string` without narrowing — that's intentional and will be fixed in Task 2.

- [ ] **Step 3: Commit**

  ```bash
  git add src/types/index.ts
  git commit -m "feat: widen ColumnMapping fields to support multi-column mapping"
  ```

---

## Task 2: Update Parser for Multi-Column Fields

**Files:**
- Modify: `src/utils/excelParser.ts`

- [ ] **Step 1: Add `resolveField` helper**

  Add this function directly above `buildDonations` in `src/utils/excelParser.ts`:

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

- [ ] **Step 2: Update `resolveRowCurrency` to support array currency column**

  Replace the current `resolveRowCurrency` function:

  ```ts
  function resolveRowCurrency(
    row: Record<string, unknown>,
    mapping: ColumnMapping,
  ): string {
    // 1. Per-row currency column (supports multi-column)
    if (mapping.currency) {
      const cols = Array.isArray(mapping.currency) ? mapping.currency : [mapping.currency];
      for (const c of cols) {
        const val = String(row[c] || '').toUpperCase().trim();
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
  ```

- [ ] **Step 3: Update field reads in `buildDonations`**

  Replace the `map` callback body inside `buildDonations`. Find the `return { id: ... }` object and update these five field lines:

  ```ts
  return {
    id: `donation-${i}`,
    date: mapping.date ? parseDate(resolveField(row, mapping.date)) : null,
    amount: mapping.amount ? parseAmount(resolveField(row, mapping.amount)) : 0,
    currency: resolveRowCurrency(row, mapping),
    organization: String(resolveField(row, mapping.organization) ?? '').trim(),
    category:     String(resolveField(row, mapping.category) ?? '').trim(),
    notes:        String(resolveField(row, mapping.notes) ?? '').trim(),
    customFields,
    rawRow: row,
  };
  ```

  Note: `customFields` loop (`for (const col of mapping.customColumns)`) is unchanged.

- [ ] **Step 4: Verify build passes**

  ```bash
  npm run build
  ```

  Expected: clean build, no TypeScript errors.

- [ ] **Step 5: Commit**

  ```bash
  git add src/utils/excelParser.ts
  git commit -m "feat: add resolveField helper, support multi-column mapping in parser"
  ```

---

## Task 3: Build MappingSandbox Component

**Files:**
- Create: `src/components/MappingSandbox.tsx`

- [ ] **Step 1: Create the file with helpers and component**

  Create `src/components/MappingSandbox.tsx` with the full content below:

  ```tsx
  import { useState } from 'react';
  import {
    Calendar, DollarSign, Building2, Tag, FileText,
    BadgeDollarSign, GripVertical, X,
  } from 'lucide-react';
  import type { ColumnMapping, CustomColumn } from '../types';

  // ── Types ──────────────────────────────────────────────
  type CoreField = Exclude<keyof ColumnMapping, 'forcedCurrency' | 'customColumns'>;

  // ── Currency data ──────────────────────────────────────
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

  // ── Core field definitions ─────────────────────────────
  const CORE_FIELDS: { key: CoreField; label: string; icon: React.ReactNode; required: boolean }[] = [
    { key: 'amount',       label: 'Amount',           icon: <DollarSign size={13} />,     required: true  },
    { key: 'date',         label: 'Date',              icon: <Calendar size={13} />,        required: false },
    { key: 'organization', label: 'Organisation',      icon: <Building2 size={13} />,       required: false },
    { key: 'category',     label: 'Category / Cause',  icon: <Tag size={13} />,             required: false },
    { key: 'currency',     label: 'Currency Column',   icon: <BadgeDollarSign size={13} />, required: false },
    { key: 'notes',        label: 'Notes',             icon: <FileText size={13} />,        required: false },
  ];

  // ── Pure mapping helpers ───────────────────────────────

  function getFieldColumns(mapping: ColumnMapping, field: CoreField): string[] {
    const val = mapping[field];
    if (!val) return [];
    return Array.isArray(val) ? val : [val];
  }

  function getAllMappedColumns(mapping: ColumnMapping): Set<string> {
    const mapped = new Set<string>();
    for (const { key } of CORE_FIELDS) {
      const val = mapping[key];
      if (!val) continue;
      if (Array.isArray(val)) val.forEach(v => mapped.add(v));
      else mapped.add(val);
    }
    mapping.customColumns.forEach(c => mapped.add(c.sourceColumn));
    return mapped;
  }

  function removeColumn(mapping: ColumnMapping, col: string): ColumnMapping {
    const patch: Partial<Record<CoreField, string | string[] | null>> = {};
    for (const { key } of CORE_FIELDS) {
      const val = mapping[key];
      if (!val) continue;
      if (Array.isArray(val)) {
        const filtered = val.filter(v => v !== col);
        patch[key] = filtered.length === 0 ? null : filtered.length === 1 ? filtered[0] : filtered;
      } else if (val === col) {
        patch[key] = null;
      }
    }
    return {
      ...mapping,
      ...patch,
      customColumns: mapping.customColumns.filter(c => c.sourceColumn !== col),
    };
  }

  function assignToField(mapping: ColumnMapping, field: CoreField, col: string): ColumnMapping {
    const cleaned = removeColumn(mapping, col);
    const current = getFieldColumns(cleaned, field);
    return { ...cleaned, [field]: current.length === 0 ? col : [...current, col] };
  }

  function assignToExtra(mapping: ColumnMapping, col: string): ColumnMapping {
    const cleaned = removeColumn(mapping, col);
    if (cleaned.customColumns.some(c => c.sourceColumn === col)) return cleaned;
    const newCustom: CustomColumn = { id: String(Date.now()), label: col, sourceColumn: col };
    return { ...cleaned, customColumns: [...cleaned.customColumns, newCustom] };
  }

  // ── Props ──────────────────────────────────────────────
  interface Props {
    headers: string[];
    mapping: ColumnMapping;
    onChange: (mapping: ColumnMapping) => void;
    previewRows: Record<string, unknown>[];
  }

  // ── Shared styles ──────────────────────────────────────
  const label13: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: 8, display: 'block',
  };

  // ── Component ──────────────────────────────────────────
  export function MappingSandbox({ headers, mapping, onChange, previewRows }: Props) {
    const [draggedCol, setDraggedCol] = useState<string | null>(null);
    const [hoveredZone, setHoveredZone] = useState<string | null>(null);
    const [otherCurrency, setOtherCurrency] = useState('');
    const [showOther, setShowOther] = useState(
      !COMMON_CURRENCIES.some(c => c.code === mapping.forcedCurrency)
    );

    const mapped = getAllMappedColumns(mapping);

    const exampleVal = (col: string): string => {
      if (!previewRows.length) return '—';
      const val = previewRows[0][col];
      if (val === null || val === undefined || val === '') return '—';
      return String(val).slice(0, 30);
    };

    // ── Drag handlers ──────────────────────────────────
    const handleDragStart = (col: string) => setDraggedCol(col);
    const handleDragEnd = () => { setDraggedCol(null); setHoveredZone(null); };

    const handleDropToField = (e: React.DragEvent, field: CoreField) => {
      e.preventDefault();
      e.stopPropagation();
      setHoveredZone(null);
      if (!draggedCol) return;
      onChange(assignToField(mapping, field, draggedCol));
      setDraggedCol(null);
    };

    const handleDropToExtra = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setHoveredZone(null);
      if (!draggedCol) return;
      onChange(assignToExtra(mapping, draggedCol));
      setDraggedCol(null);
    };

    const handleDropToPool = (e: React.DragEvent) => {
      e.preventDefault();
      setHoveredZone(null);
      if (!draggedCol) return;
      onChange(removeColumn(mapping, draggedCol));
      setDraggedCol(null);
    };

    // ── Currency handlers ──────────────────────────────
    const setCurrency = (code: string) => {
      setShowOther(false);
      onChange({ ...mapping, forcedCurrency: code });
    };

    const handleOtherInput = (val: string) => {
      const upper = val.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
      setOtherCurrency(upper);
      if (upper.length >= 2) onChange({ ...mapping, forcedCurrency: upper });
    };

    return (
      <div
        onDragOver={e => e.preventDefault()}
        onDrop={handleDropToPool}
        style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
      >

        {/* ── Column Pool ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={label13}>Your Columns</span>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>
              {mapped.size} of {headers.length} mapped
            </span>
          </div>
          <div
            onDragOver={e => { e.preventDefault(); e.stopPropagation(); setHoveredZone('pool'); }}
            onDragLeave={() => setHoveredZone(null)}
            onDrop={e => { e.stopPropagation(); handleDropToPool(e); }}
            style={{
              display: 'flex', flexWrap: 'wrap', gap: 8, padding: 12,
              borderRadius: 'var(--radius-sm)',
              background: hoveredZone === 'pool' ? 'var(--surface3)' : 'var(--surface2)',
              border: '1px solid var(--border)', minHeight: 52, transition: 'background 150ms',
            }}
          >
            {headers.map(col => {
              const isGhost = mapped.has(col);
              return (
                <div
                  key={col}
                  draggable
                  onDragStart={() => handleDragStart(col)}
                  onDragEnd={handleDragEnd}
                  onClick={() => isGhost && onChange(removeColumn(mapping, col))}
                  title={isGhost ? 'Click to unassign' : col}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 10px', borderRadius: 'var(--radius-sm)',
                    background: isGhost ? 'transparent' : 'var(--surface)',
                    border: `1px ${isGhost ? 'dashed' : 'solid'} ${isGhost ? 'var(--border2)' : 'var(--border)'}`,
                    opacity: isGhost ? 0.35 : draggedCol === col ? 0.4 : 1,
                    cursor: isGhost ? 'pointer' : 'grab',
                    transition: 'opacity 120ms', userSelect: 'none',
                  }}
                >
                  {!isGhost && <GripVertical size={11} color="var(--text3)" />}
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{col}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)' }}>{exampleVal(col)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Divider ── */}
        <div style={{ height: 1, background: 'var(--border)' }} />

        {/* ── Core Drop Zones ── */}
        <div>
          <span style={label13}>Map Fields</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {CORE_FIELDS.map(({ key, label, icon, required }) => {
              const cols = getFieldColumns(mapping, key);
              const isHovered = hoveredZone === key;
              const hasCards = cols.length > 0;
              return (
                <div
                  key={key}
                  onDragOver={e => { e.preventDefault(); e.stopPropagation(); setHoveredZone(key); }}
                  onDragLeave={() => setHoveredZone(null)}
                  onDrop={e => handleDropToField(e, key)}
                  style={{
                    padding: '10px 12px', borderRadius: 'var(--radius-sm)', minHeight: 64,
                    background: isHovered ? 'var(--green-bg)' : hasCards ? 'var(--surface2)' : 'transparent',
                    border: `1px ${hasCards ? 'solid' : 'dashed'} ${isHovered ? 'var(--green)' : hasCards ? 'var(--green-ring)' : 'var(--border2)'}`,
                    transition: 'all 150ms',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: hasCards ? 8 : 0 }}>
                    <span style={{ color: hasCards ? 'var(--green)' : 'var(--text3)' }}>{icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: hasCards ? 'var(--text)' : 'var(--text3)' }}>
                      {label}{required && <span style={{ color: 'var(--red)', marginLeft: 2 }}>*</span>}
                    </span>
                  </div>
                  {hasCards ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {cols.map(col => (
                        <div
                          key={col}
                          draggable
                          onDragStart={e => { e.stopPropagation(); handleDragStart(col); }}
                          onDragEnd={handleDragEnd}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            padding: '3px 7px', borderRadius: 'var(--radius-sm)',
                            background: 'var(--surface)', border: '1px solid var(--green-ring)',
                            fontSize: 11, cursor: 'grab', userSelect: 'none',
                          }}>
                          <span style={{ fontWeight: 600, color: 'var(--text)' }}>{col}</span>
                          <span style={{ color: 'var(--text3)', marginLeft: 2 }}>{exampleVal(col)}</span>
                          <button
                            onClick={() => onChange(removeColumn(mapping, col))}
                            style={{
                              marginLeft: 3, width: 14, height: 14, border: 'none', background: 'none',
                              color: 'var(--text3)', cursor: 'pointer', padding: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Drop a column here</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Divider ── */}
        <div style={{ height: 1, background: 'var(--border)' }} />

        {/* ── Extra Columns Zone ── */}
        <div>
          <span style={label13}>Extra / Custom Columns</span>
          <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10, marginTop: -6 }}>
            Columns dropped here appear in the transactions table.
          </p>
          <div
            onDragOver={e => { e.preventDefault(); e.stopPropagation(); setHoveredZone('extra'); }}
            onDragLeave={() => setHoveredZone(null)}
            onDrop={handleDropToExtra}
            style={{
              padding: 12, borderRadius: 'var(--radius-sm)', minHeight: 52, transition: 'all 150ms',
              background: hoveredZone === 'extra' ? 'var(--green-bg)' : 'var(--surface2)',
              border: `1px dashed ${hoveredZone === 'extra' ? 'var(--green)' : 'var(--border2)'}`,
            }}
          >
            {mapping.customColumns.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>
                Drop columns here to include them as extra fields
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {mapping.customColumns.map(col => (
                  <div
                    key={col.id}
                    draggable
                    onDragStart={e => { e.stopPropagation(); handleDragStart(col.sourceColumn); }}
                    onDragEnd={handleDragEnd}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                      borderRadius: 'var(--radius-sm)', background: 'var(--surface)', border: '1px solid var(--border)',
                      cursor: 'grab', userSelect: 'none',
                    }}>
                    <GripVertical size={11} color="var(--text3)" style={{ flexShrink: 0 }} />
                    <input
                      type="text"
                      value={col.label}
                      onChange={e => {
                        const updated = mapping.customColumns.map(c =>
                          c.id === col.id ? { ...c, label: e.target.value } : c
                        );
                        onChange({ ...mapping, customColumns: updated });
                      }}
                      placeholder="Column label"
                      maxLength={40}
                      style={{
                        flex: 1, padding: '4px 8px',
                        border: `1px solid ${col.label ? 'var(--green-ring)' : 'var(--border2)'}`,
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--surface)', color: 'var(--text)', fontSize: 12, outline: 'none',
                      }}
                    />
                    <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>← {col.sourceColumn}</span>
                    <button
                      onClick={() => onChange({ ...mapping, customColumns: mapping.customColumns.filter(c => c.id !== col.id) })}
                      style={{
                        width: 22, height: 22, border: '1px solid var(--border)', background: 'none',
                        borderRadius: 'var(--radius-sm)', color: 'var(--text3)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Divider ── */}
        <div style={{ height: 1, background: 'var(--border)' }} />

        {/* ── Currency Fallback (preserved from ColumnMapper) ── */}
        <div>
          <span style={label13}>Default Currency</span>
          <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10, marginTop: -4 }}>
            Used when no currency column is mapped or a cell is empty.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {COMMON_CURRENCIES.map(({ code, sub }) => {
              const active = !showOther && mapping.forcedCurrency === code;
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
              onClick={() => { setShowOther(true); onChange({ ...mapping, forcedCurrency: otherCurrency || '' }); }}
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
          {mapping.currency && (
            <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text3)' }}>
              <span style={{ color: 'var(--green)', fontWeight: 600 }}>Currency column mapped</span> — per-row values will be used; default is the fallback only.
            </p>
          )}
        </div>

      </div>
    );
  }
  ```

- [ ] **Step 2: Verify build passes**

  ```bash
  npm run build
  ```

  Expected: clean build. If TypeScript errors appear, they will point to specific mismatches between the new types and the helper functions — fix them before proceeding.

- [ ] **Step 3: Commit**

  ```bash
  git add src/components/MappingSandbox.tsx
  git commit -m "feat: add MappingSandbox drag-and-drop column mapping component"
  ```

---

## Task 4: Wire Up and Remove Old Component

**Files:**
- Modify: `src/pages/LandingPage.tsx:8`
- Delete: `src/components/ColumnMapper.tsx`

- [ ] **Step 1: Swap the import in LandingPage**

  In `src/pages/LandingPage.tsx`, change line 8:

  ```ts
  // Before
  import { ColumnMapper } from '../components/ColumnMapper';

  // After
  import { MappingSandbox } from '../components/MappingSandbox';
  ```

- [ ] **Step 2: Replace the JSX usage**

  In `src/pages/LandingPage.tsx`, find the `<ColumnMapper` usage (around line 299) and replace it:

  ```tsx
  // Before
  <ColumnMapper
    headers={currentSheet.headers}
    mapping={ctx.columnMapping}
    onChange={ctx.setColumnMapping}
    previewRows={currentSheet.rows.slice(0, 3)}
  />

  // After
  <MappingSandbox
    headers={currentSheet.headers}
    mapping={ctx.columnMapping}
    onChange={ctx.setColumnMapping}
    previewRows={currentSheet.rows.slice(0, 3)}
  />
  ```

- [ ] **Step 3: Delete ColumnMapper**

  ```bash
  rm src/components/ColumnMapper.tsx
  ```

- [ ] **Step 4: Verify build passes**

  ```bash
  npm run build
  ```

  Expected: clean build with no references to `ColumnMapper` remaining.

- [ ] **Step 5: Manual smoke test**

  ```bash
  npm run dev
  ```

  Open the app and verify:
  1. Upload a sample `.xlsx` or `.csv` file
  2. Step 1 shows the new sandbox: column cards in the pool with example values
  3. Auto-detected columns appear pre-placed in their zones
  4. Dragging a card from the pool into a core zone assigns it (card turns ghost in pool)
  5. Clicking a ghost card unassigns it (returns to active in pool)
  6. Dragging a card into Extra Columns zone creates an editable entry
  7. Trying to continue without Amount mapped shows the error
  8. Completing mapping and clicking Continue navigates to Step 2 / Recap correctly
  9. Currency picker still works

- [ ] **Step 6: Commit**

  ```bash
  git add src/pages/LandingPage.tsx
  git rm src/components/ColumnMapper.tsx
  git commit -m "feat: replace ColumnMapper with MappingSandbox, complete data mapping sandbox"
  ```
