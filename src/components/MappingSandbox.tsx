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
    // No-op if dropped back onto the same zone it already belongs to
    if (getFieldColumns(mapping, field).includes(draggedCol)) {
      setDraggedCol(null);
      return;
    }
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
