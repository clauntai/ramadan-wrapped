import { useState, useMemo } from 'react';
import { Sparkles, Search, CheckCheck, ChevronDown, Info } from 'lucide-react';
import { ALL_CATEGORIES, type Category, type OrgSegment } from '../utils/autoCategor';
import { formatCurrency } from '../utils/insightsEngine';

interface Props {
  segments: OrgSegment[];
  currency: string;
  onChange: (orgMap: Map<string, Category>) => void;
}

const CONFIDENCE_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  high:   { bg: 'var(--green-bg)',              color: 'var(--green)',   label: 'Detected' },
  medium: { bg: 'rgba(245,158,11,0.10)',         color: '#D97706',        label: 'Guessed'  },
  low:    { bg: 'rgba(148,163,184,0.10)',        color: 'var(--text3)',   label: 'Default'  },
};

export function CategoryReview({ segments, currency, onChange }: Props) {
  // org → chosen category
  const [assignments, setAssignments] = useState<Map<string, Category>>(() => {
    const m = new Map<string, Category>();
    for (const s of segments) m.set(s.org, s.suggestedCategory);
    return m;
  });

  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q ? segments.filter(s => s.org.toLowerCase().includes(q)) : segments;
  }, [segments, search]);

  const update = (org: string, cat: Category) => {
    const next = new Map(assignments);
    next.set(org, cat);
    setAssignments(next);
    onChange(next);
  };

  const acceptAll = () => {
    const next = new Map<string, Category>();
    for (const s of segments) next.set(s.org, s.suggestedCategory);
    setAssignments(next);
    onChange(next);
  };

  const setCategoryAll = (cat: Category) => {
    const next = new Map<string, Category>();
    for (const s of filtered) next.set(s.org, cat);
    // keep others unchanged
    for (const [k, v] of assignments) {
      if (!next.has(k)) next.set(k, v);
    }
    setAssignments(next);
    onChange(next);
  };

  const highCount  = segments.filter(s => s.confidence === 'high').length;
  const totalCount = segments.length;

  return (
    <div>
      {/* Info bar */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '12px 16px', marginBottom: 20,
        background: 'var(--green-bg)', border: '1px solid var(--green-ring)',
        borderRadius: 'var(--radius-sm)', fontSize: 13,
      }}>
        <Info size={15} color="var(--green)" style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <span style={{ fontWeight: 600, color: 'var(--green)' }}>
            Auto-detected {highCount}/{totalCount} categories
          </span>
          <span style={{ color: 'var(--text2)' }}>
            {' '}— review and adjust below. Changes apply to all donations from that organisation.
          </span>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{
          flex: 1, minWidth: 180,
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 12px',
          background: 'var(--surface2)', border: '1px solid var(--border2)',
          borderRadius: 'var(--radius-sm)',
        }}>
          <Search size={13} color="var(--text3)" />
          <input
            type="text"
            placeholder="Filter organisations…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              border: 'none', background: 'none', outline: 'none',
              fontSize: 13, color: 'var(--text)', width: '100%',
            }}
          />
        </div>

        {/* Accept all suggestions */}
        <button
          onClick={acceptAll}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 'var(--radius-sm)',
            background: 'var(--green-bg)', border: '1px solid var(--green-ring)',
            color: 'var(--green)', fontSize: 13, fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--green)' }
          onMouseLeave={e => e.currentTarget.style.background = 'var(--green-bg)' }
          // reset text color on leave too
          onMouseOver={e => (e.currentTarget.style.color = 'white')}
          onMouseOut={e => (e.currentTarget.style.color = 'var(--green)')}
        >
          <CheckCheck size={13} /> Accept all suggestions
        </button>

        {/* Bulk assign visible rows */}
        <div style={{ position: 'relative' }}>
          <select
            defaultValue=""
            onChange={e => {
              if (e.target.value) setCategoryAll(e.target.value as Category);
              e.target.value = '';
            }}
            style={{
              padding: '7px 30px 7px 12px',
              border: '1px solid var(--border2)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--surface2)',
              color: 'var(--text2)', fontSize: 13,
              appearance: 'none', cursor: 'pointer',
            }}
          >
            <option value="" disabled>Bulk assign…</option>
            {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <ChevronDown size={12} color="var(--text3)" style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        </div>
      </div>

      {/* Table */}
      <div style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 60px 100px 180px',
          gap: 0,
          padding: '8px 14px',
          background: 'var(--surface2)',
          borderBottom: '1px solid var(--border)',
          fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.07em', color: 'var(--text3)',
        }}>
          <span>Organisation</span>
          <span style={{ textAlign: 'center' }}>Txns</span>
          <span style={{ textAlign: 'right' }}>Amount</span>
          <span style={{ paddingLeft: 10 }}>Category</span>
        </div>

        {/* Rows */}
        <div style={{ maxHeight: 380, overflowY: 'auto' }}>
          {filtered.length === 0 && (
            <p style={{ padding: '20px 14px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
              No organisations match your search.
            </p>
          )}
          {filtered.map((seg, i) => {
            const cat = assignments.get(seg.org) ?? seg.suggestedCategory;
            const conf = CONFIDENCE_STYLE[seg.confidence];
            const isLast = i === filtered.length - 1;

            return (
              <div
                key={seg.org}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 60px 100px 180px',
                  alignItems: 'center',
                  gap: 0,
                  padding: '9px 14px',
                  borderBottom: isLast ? 'none' : '1px solid var(--border)',
                  background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface2)',
                  transition: 'background 120ms',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--green-bg)')}
                onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'var(--surface)' : 'var(--surface2)')}
              >
                {/* Org name */}
                <div style={{ overflow: 'hidden' }}>
                  <p style={{
                    fontSize: 13, fontWeight: 500, color: 'var(--text)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {seg.org}
                  </p>
                  {seg.existingCategory && seg.existingCategory !== cat && (
                    <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
                      was: {seg.existingCategory}
                    </p>
                  )}
                </div>

                {/* Count */}
                <p className="num" style={{ textAlign: 'center', fontSize: 12, color: 'var(--text3)', fontVariantNumeric: 'tabular-nums' }}>
                  {seg.count}
                </p>

                {/* Amount */}
                <p className="num" style={{ textAlign: 'right', fontSize: 13, fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrency(seg.totalAmount, currency)}
                </p>

                {/* Category select */}
                <div style={{ paddingLeft: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '2px 6px', borderRadius: 10,
                    background: conf.bg, color: conf.color,
                    fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.06em', flexShrink: 0,
                  }}>
                    <Sparkles size={8} />
                    {conf.label}
                  </span>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <select
                      value={cat}
                      onChange={e => update(seg.org, e.target.value as Category)}
                      aria-label={`Category for ${seg.org}`}
                      style={{
                        width: '100%', padding: '5px 24px 5px 8px',
                        border: '1px solid var(--border2)',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--surface)',
                        color: 'var(--text)', fontSize: 12,
                        appearance: 'none', cursor: 'pointer',
                      }}
                    >
                      {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <ChevronDown size={10} color="var(--text3)" style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer summary */}
      <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 12, color: 'var(--text3)' }}>
        {Object.entries(CONFIDENCE_STYLE).map(([k, v]) => {
          const n = segments.filter(s => s.confidence === k).length;
          return n > 0 ? (
            <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: v.color, display: 'inline-block' }} />
              {v.label}: {n}
            </span>
          ) : null;
        })}
        <span style={{ marginLeft: 'auto' }}>
          {segments.length} organisation{segments.length !== 1 ? 's' : ''} · {segments.reduce((s, x) => s + x.count, 0)} donations
        </span>
      </div>
    </div>
  );
}
