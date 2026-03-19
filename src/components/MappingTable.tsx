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

  // Freeform custom columns: those in mapping.customColumns whose id is NOT a FIELD_DEFINITIONS id
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
