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
