import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Moon, Sun, ArrowLeft, Download, TrendingUp, TrendingDown,
  Wallet, Award, Calendar, Building2, Tag, ChevronUp, ChevronDown, ChevronsUpDown,
  SlidersHorizontal, X,
} from 'lucide-react';
import { useDonation } from '../context/DonationContext';
import { DonationTimeline } from '../components/charts/DonationTimeline';
import { CategoryBreakdown } from '../components/charts/CategoryBreakdown';
import { OrganizationChart } from '../components/charts/OrganizationChart';
import { MappingTable } from '../components/MappingTable';
import { ShareModal } from '../components/ShareModal';
import { buildDonations } from '../utils/excelParser';
import { formatCurrency, formatDate, formatShortDate, FAILED_STATUSES, computeInsights } from '../utils/insightsEngine';
import type { ColumnMapping, Donation } from '../types';

// ── Theme hook (shared) ───────────────────────────────
function useTheme() {
  const [theme, setTheme] = useState<'light'|'dark'>(() => {
    const s = localStorage.getItem('theme');
    if (s === 'dark' || s === 'light') return s;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);
  return { theme, toggle: () => setTheme(t => t === 'dark' ? 'light' : 'dark') };
}

const LAST10_START: Record<number, Date> = {
  2026: new Date(2026, 1, 19), 2025: new Date(2025, 2, 21),
  2024: new Date(2024, 3, 1),  2023: new Date(2023, 3, 12),
};

// ── KPI Card ─────────────────────────────────────────
function KpiCard({ icon, label, value, sub, accent, delay = 0 }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; accent?: boolean; delay?: number;
}) {
  return (
    <div
      className="animate-fade-up"
      style={{
        padding: '20px 22px',
        background: accent ? 'var(--green-gradient)' : 'var(--surface)',
        border: `1px solid ${accent ? 'transparent' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        boxShadow: accent ? '0 8px 24px rgba(22,163,74,0.35)' : 'var(--shadow-sm)',
        transition: 'transform 160ms ease, box-shadow 160ms ease',
        cursor: 'default',
        animationDelay: `${delay}ms`,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = accent
          ? '0 12px 32px rgba(22,163,74,0.45)'
          : 'var(--shadow)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.transform = '';
        (e.currentTarget as HTMLDivElement).style.boxShadow = accent
          ? '0 8px 24px rgba(22,163,74,0.35)'
          : 'var(--shadow-sm)';
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        color: accent ? 'rgba(255,255,255,0.8)' : 'var(--text3)',
        marginBottom: 10,
      }}>
        {icon}
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em' }}>
          {label}
        </span>
      </div>
      <p className="num" style={{
        fontSize: 26, fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.5px',
        color: accent ? 'white' : 'var(--text)',
        marginBottom: sub ? 5 : 0,
      }}>
        {value}
      </p>
      {sub && (
        <p style={{ fontSize: 12, color: accent ? 'rgba(255,255,255,0.72)' : 'var(--text3)', marginTop: 2 }}>
          {sub}
        </p>
      )}
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────
function Panel({ title, action, children, fullWidth, fillHeight }: {
  title: string; action?: React.ReactNode; children: React.ReactNode; fullWidth?: boolean; fillHeight?: boolean;
}) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)',
      overflow: 'hidden', gridColumn: fullWidth ? '1 / -1' : undefined,
      display: fillHeight ? 'flex' : undefined, flexDirection: fillHeight ? 'column' : undefined,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface2)',
      }}>
        <h2 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {title}
        </h2>
        {action}
      </div>
      <div style={{ padding: '20px', flex: fillHeight ? 1 : undefined, display: fillHeight ? 'flex' : undefined, flexDirection: fillHeight ? 'column' : undefined }}>
        {children}
      </div>
    </div>
  );
}

// ── Sortable table ────────────────────────────────────
type SortKey = 'date' | 'amount' | 'organization' | 'category' | `custom:${string}`;

function DonationTable({ donations, currency }: { donations: Donation[]; currency: string }) {
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const PAGE = 15;

  // Derive custom column labels from the first donation that has any
  const customLabels = useMemo(() => {
    for (const d of donations) {
      const keys = Object.keys(d.customFields ?? {});
      if (keys.length) return keys;
    }
    return [];
  }, [donations]);

  const sorted = useMemo(() => {
    return [...donations].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'date') cmp = (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0);
      else if (sortKey === 'amount') cmp = a.amount - b.amount;
      else if (sortKey === 'organization') cmp = a.organization.localeCompare(b.organization);
      else if (sortKey === 'category') cmp = a.category.localeCompare(b.category);
      else if (sortKey.startsWith('custom:')) {
        const label = sortKey.slice(7);
        cmp = (a.customFields?.[label] ?? '').localeCompare(b.customFields?.[label] ?? '');
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [donations, sortKey, sortDir]);

  const paged = sorted.slice(page * PAGE, (page + 1) * PAGE);
  const totalPages = Math.ceil(sorted.length / PAGE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
    setPage(0);
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ChevronsUpDown size={12} style={{ opacity: 0.35 }} />;
    return sortDir === 'asc' ? <ChevronUp size={12} color="var(--green)" /> : <ChevronDown size={12} color="var(--green)" />;
  };

  const th: React.CSSProperties = {
    padding: '10px 14px', fontSize: 10, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.09em',
    color: 'var(--text3)', background: 'var(--surface2)',
    borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
    cursor: 'pointer', userSelect: 'none',
  };
  const td: React.CSSProperties = {
    padding: '10px 14px', fontSize: 13, color: 'var(--text)',
    borderBottom: '1px solid var(--border)', verticalAlign: 'middle',
  };

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}
          aria-label="Donations table">
          <thead>
            <tr>
              {([['date','Date'],['amount','Amount'],['organization','Organization'],['category','Category']] as [SortKey,string][]).map(([k, lbl]) => (
                <th key={k} style={th} onClick={() => toggleSort(k)} aria-sort={sortKey === k ? sortDir === 'asc' ? 'ascending' : 'descending' : 'none'}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    {lbl} <SortIcon k={k} />
                  </span>
                </th>
              ))}
              <th style={{ ...th, cursor: 'default' }}>Notes</th>
              {/* Custom columns */}
              {customLabels.map(label => (
                <th key={label} style={th} onClick={() => toggleSort(`custom:${label}` as SortKey)}
                  aria-sort={sortKey === `custom:${label}` ? sortDir === 'asc' ? 'ascending' : 'descending' : 'none'}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    {label}
                    <SortIcon k={`custom:${label}` as SortKey} />
                    <span style={{
                      fontSize: 9, padding: '1px 5px', borderRadius: 8,
                      background: 'rgba(34,197,94,0.12)', color: 'var(--green)',
                      fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                      marginLeft: 2,
                    }}>Custom</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((d, i) => (
              <tr key={d.id}
                style={{ background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface2)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--green-bg)')}
                onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'var(--surface)' : 'var(--surface2)')}
              >
                <td style={td}>{d.date ? formatShortDate(d.date) : <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                <td style={{ ...td, fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--green)' }}>
                  {formatCurrency(d.amount, d.currency || currency)}
                </td>
                <td style={td}>{d.organization || <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>
                  {d.category
                    ? <span style={{
                        display: 'inline-block', padding: '2px 8px',
                        background: 'var(--green-bg)', color: 'var(--green)',
                        borderRadius: 20, fontSize: 11, fontWeight: 600,
                      }}>{d.category}</span>
                    : <span style={{ color: 'var(--text3)' }}>—</span>
                  }
                </td>
                <td style={{ ...td, color: 'var(--text3)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {d.notes || '—'}
                </td>
                {customLabels.map(label => (
                  <td key={label} style={{ ...td, color: 'var(--text2)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.customFields?.[label] || <span style={{ color: 'var(--text3)' }}>—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 0 2px', fontSize: 12, color: 'var(--text3)',
        }}>
          <span className="num">
            {page * PAGE + 1}–{Math.min((page + 1) * PAGE, sorted.length)} of {sorted.length.toLocaleString()}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => (
              <button key={i} onClick={() => setPage(i)} style={{
                width: 28, height: 28, borderRadius: 'var(--radius-sm)',
                border: `1px solid ${i === page ? 'var(--green)' : 'var(--border)'}`,
                background: i === page ? 'var(--green-bg)' : 'none',
                color: i === page ? 'var(--green)' : 'var(--text3)',
                fontSize: 12, fontWeight: i === page ? 700 : 400,
              }}>{i + 1}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main RecapPage ────────────────────────────────────
export function RecapPage() {
  const navigate = useNavigate();
  const ctx = useDonation();
  const { insights, donations, workbook } = ctx;
  const { theme, toggle } = useTheme();

  const [showSettings, setShowSettings] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [draftMapping, setDraftMapping] = useState<ColumnMapping | null>(null);

  const currentSheet = workbook?.sheets.find(s => s.name === ctx.selectedSheet) ?? null;

  const openSettings = () => {
    setDraftMapping(ctx.columnMapping);
    setShowSettings(true);
  };

  const applySettings = () => {
    if (!draftMapping || !currentSheet) return;
    const newDonations = buildDonations(currentSheet.rows, draftMapping);
    ctx.setColumnMapping(draftMapping);
    ctx.setDonations(newDonations);
    ctx.setInsights(computeInsights(newDonations));
    setShowSettings(false);
  };

  useEffect(() => { if (!insights) navigate('/'); }, [insights, navigate]);
  if (!insights) return null;

  const {
    total, count, average, largest, mostGenerousDay,
    topOrganization, topCategory, currency,
    donationsByDay, donationsByCategory, donationsByOrganization,
    last10NightsTotal, last10NightsCount, ramadanYear,
    recurringCount, recurringTotal, oneTimeCount, oneTimeTotal, hasRecurringData,
    netTotal, refundCount,
  } = insights;

  // Aggregate by donor identity (email preferred, fallback to full name)
  // Uses same payment-status filter as the insights engine
  const topDonors = useMemo(() => {
    const map = new Map<string, { name: string; amount: number; count: number; isRecurring: boolean }>();
    for (const d of donations) {
      if (FAILED_STATUSES.has(d.paymentStatus.toLowerCase().trim())) continue;
      const email     = d.customFields?.['Email'] ?? '';
      const firstName = d.customFields?.['First Name'] ?? '';
      const lastName  = d.customFields?.['Last Name'] ?? '';
      const fullName  = [firstName, lastName].filter(Boolean).join(' ');
      const key = email || fullName;
      if (!key) continue;
      const display = fullName || email;
      const val = d.recurringStatus.trim();
      const isRecurring = val !== '' && (/recurring|recur|subscription|monthly|weekly|annual|yearly|regular|\byes\b|\btrue\b/i.test(val) || val === '1');
      const existing = map.get(key);
      if (existing) {
        existing.amount += d.amount;
        existing.count++;
        if (isRecurring) existing.isRecurring = true;
      } else {
        map.set(key, { name: display, amount: d.amount, count: 1, isRecurring });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
  }, [donations]);

  const hasDonorData = topDonors.length > 0;

  const last10Start = ramadanYear ? LAST10_START[ramadanYear] : undefined;
  const last10Pct = total > 0 ? ((last10NightsTotal / total) * 100).toFixed(0) : '0';
  const last10Up = parseFloat(last10Pct) >= 40;

  const handleExport = () => {
    const cols = ['Date', 'Amount', 'Currency', 'Organization', 'Category', 'Notes'];
    const rows = donations.map(d => [
      d.date ? formatDate(d.date) : '',
      d.amount, d.currency, d.organization, d.category, d.notes,
    ]);
    const csv = [cols.join(','), ...rows.map(r => r.map(v => JSON.stringify(v ?? '')).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'ramadan-donations.csv' });
    a.click(); URL.revokeObjectURL(a.href);
  };

  const pill = (color: string, txt: string) => (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 9px',
      borderRadius: 20, fontSize: 12, fontWeight: 600,
      background: `rgba(${color},0.12)`, color: `rgb(${color})`,
    }}>{txt}</span>
  );

  return (
    <div style={{ minHeight: '100svh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Top bar ── */}
      <header style={{
        height: 'var(--header-h)', padding: '0 24px',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 50,
        gap: 12,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: 'var(--shadow-sm)',
      }}>
        {/* Left */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate('/')}
            aria-label="Back"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', background: 'none',
              fontSize: 12, color: 'var(--text2)', fontWeight: 500,
              transition: 'all 150ms',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--green)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <ArrowLeft size={13} /> Back
          </button>

          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'var(--green-gradient)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(22,163,74,0.4)',
            }}>
              <Moon size={14} color="white" />
            </div>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.4px' }}>
              Ramadan Wrapped
            </span>
          </div>

          {workbook && (
            <span style={{
              fontSize: 11, color: 'var(--text3)',
              padding: '2px 8px', borderRadius: 20,
              background: 'var(--surface2)', border: '1px solid var(--border)',
              display: 'none', // hidden on mobile, shown via media query below
            }} className="filename-badge">
              {workbook.fileName}
            </span>
          )}
        </div>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {ramadanYear && (
            <div style={{
              fontSize: 11, fontWeight: 700,
              padding: '4px 12px', borderRadius: 24,
              background: 'var(--green-bg)', color: 'var(--green)',
              border: '1px solid var(--green-ring)',
              letterSpacing: '0.04em',
            }}>
              Ramadan {ramadanYear}
            </div>
          )}
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            style={{
              width: 32, height: 32, borderRadius: 'var(--radius-sm)',
              background: 'var(--surface2)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text2)',
            }}
          >
            {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          </button>
          <button
            onClick={() => setShowShare(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 16px', background: 'var(--green-gradient)', border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12, color: 'white', fontWeight: 700,
              boxShadow: '0 2px 8px rgba(22,163,74,0.4)',
              letterSpacing: '0.01em',
              transition: 'opacity 150ms, box-shadow 150ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(22,163,74,0.5)'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(22,163,74,0.4)'; }}
          >
            ↗ Share Wrapped
          </button>
          <button
            onClick={openSettings}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', background: 'none',
              fontSize: 12, color: 'var(--text2)', fontWeight: 500,
              transition: 'all 150ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--green)'; e.currentTarget.style.color = 'var(--green)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)'; }}
          >
            <SlidersHorizontal size={13} /> Mapping
          </button>
          <button
            onClick={handleExport}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 14px',
              background: 'none', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12, color: 'var(--text2)', fontWeight: 600,
              transition: 'all 150ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--green)'; e.currentTarget.style.color = 'var(--green)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)'; }}
          >
            <Download size={13} /> Export CSV
          </button>
        </div>
      </header>

      {/* ── Summary bar ── */}
      <div style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '16px 24px',
        display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
      }}>
        <div>
          <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', display: 'block', marginBottom: 2 }}>
            Total Raised
          </span>
          <span className="num" style={{ fontSize: 32, fontWeight: 800, color: 'var(--green)', letterSpacing: '-1px', lineHeight: 1 }}>
            {formatCurrency(total, currency)}
          </span>
        </div>
        <div style={{ width: 1, height: 40, background: 'var(--border)', flexShrink: 0 }} />
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {[
            { l: 'Transactions', v: count.toLocaleString() },
            { l: 'Avg Gift', v: formatCurrency(average, currency) },
            { l: 'Giving Orgs', v: donationsByOrganization.length.toString() },
            ...(last10NightsCount > 0 ? [{ l: 'Last 10 Nights', v: formatCurrency(last10NightsTotal, currency) }] : []),
          ].map(({ l, v }) => (
            <div key={l}>
              <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', display: 'block', marginBottom: 2 }}>{l}</span>
              <span className="num" style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.2px' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Dashboard body ── */}
      <div style={{ flex: 1, padding: '24px', maxWidth: 1320, margin: '0 auto', width: '100%' }}>

        {/* KPI row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
          gap: 14, marginBottom: 24,
        }}>
          <KpiCard
            icon={<Wallet size={13} />}
            label="Supporters"
            value={(hasDonorData ? topDonors.length : count).toLocaleString()}
            sub={hasDonorData
              ? `${formatCurrency(total / topDonors.length, currency)} avg per donor`
              : `${count.toLocaleString()} transactions`}
            accent
            delay={0}
          />
          {hasRecurringData ? (
            <KpiCard
              icon={<TrendingUp size={13} />}
              label="Recurring Revenue"
              value={formatCurrency(recurringTotal, currency)}
              sub={`${recurringCount} committed donor${recurringCount !== 1 ? 's' : ''}`}
              delay={50}
            />
          ) : hasDonorData ? (
            <KpiCard
              icon={<TrendingUp size={13} />}
              label="Unique Donors"
              value={topDonors.length.toLocaleString()}
              sub={`avg ${formatCurrency(average, currency)} per gift`}
              delay={50}
            />
          ) : null}
          {largest && (
            <KpiCard
              icon={<Award size={13} />}
              label="Largest Gift"
              value={formatCurrency(largest.amount, currency)}
              sub={largest.organization || (largest.date ? formatDate(largest.date) : undefined)}
              delay={100}
            />
          )}
          {mostGenerousDay && (
            <KpiCard
              icon={<Calendar size={13} />}
              label="Top Day"
              value={formatDate(mostGenerousDay.date)}
              sub={`${formatCurrency(mostGenerousDay.amount, currency)}`}
              delay={150}
            />
          )}
          {topOrganization && (
            <KpiCard
              icon={<Building2 size={13} />}
              label="Top Giving Org"
              value={formatCurrency(topOrganization.amount, currency)}
              sub={topOrganization.name}
              delay={200}
            />
          )}
          {topCategory && (
            <KpiCard
              icon={<Tag size={13} />}
              label="Top Category"
              value={`${((topCategory.amount / total) * 100).toFixed(0)}%`}
              sub={topCategory.name}
              delay={250}
            />
          )}
        </div>

        {/* Last 10 Nights banner */}
        {last10NightsCount > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 20,
            padding: '18px 24px', marginBottom: 20,
            background: 'linear-gradient(135deg, rgba(22,163,74,0.08) 0%, rgba(74,222,128,0.04) 100%)',
            border: '1px solid var(--green-ring)',
            borderRadius: 'var(--radius)',
            boxShadow: '0 2px 12px rgba(22,163,74,0.08)',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', right: -24, top: -24, width: 100, height: 100,
              borderRadius: '50%', background: 'radial-gradient(circle, rgba(34,197,94,0.12) 0%, transparent 70%)',
              pointerEvents: 'none',
            }} />
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: 'var(--green-gradient)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(22,163,74,0.4)', flexShrink: 0,
            }}>
              <Moon size={20} color="white" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 4 }}>
                Last 10 Nights of Ramadan
              </p>
              <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.5 }}>
                <strong className="num" style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums', fontSize: 18, letterSpacing: '-0.3px' }}>
                  {formatCurrency(last10NightsTotal, currency)}
                </strong>
                <span style={{ marginLeft: 8 }}>
                  across {last10NightsCount} donation{last10NightsCount !== 1 ? 's' : ''} · {last10Pct}% of total giving
                </span>
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {last10Up
                ? <><TrendingUp size={14} color="var(--green)" /> {pill('34,197,94', last10Pct + '% of total')}</>
                : <><TrendingDown size={14} color="var(--text3)" /> {pill('148,163,184', last10Pct + '% of total')}</>
              }
            </div>
          </div>
        )}

        {/* Main chart grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: donationsByCategory.length > 0 ? '1fr 320px' : '1fr',
          gap: 16, marginBottom: 18,
        }}>
          {/* Timeline – main chart */}
          {donationsByDay.length > 1 && (
            <Panel
              title="Donation Timeline"
              action={
                <span style={{ fontSize: 11, color: 'var(--text3)', fontVariantNumeric: 'tabular-nums' }}>
                  {donationsByDay.length} active days
                </span>
              }
              fillHeight
            >
              <DonationTimeline data={donationsByDay} currency={currency} last10Start={last10Start} />
            </Panel>
          )}

          {/* Category donut */}
          {donationsByCategory.length > 0 && (
            <Panel title="By Category">
              <CategoryBreakdown data={donationsByCategory} currency={currency} />
            </Panel>
          )}
        </div>

        {/* Second row: orgs + quick stats */}
        {donationsByOrganization.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: donationsByOrganization.length > 3 ? '1fr 280px' : '1fr',
            gap: 16, marginBottom: 16,
          }}>
            <Panel
              title="Top Organizations"
              action={
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                  {donationsByOrganization.length} total
                </span>
              }
            >
              <OrganizationChart data={donationsByOrganization} currency={currency} />
            </Panel>

            {/* Leaderboard list */}
            {donationsByOrganization.length > 3 && (
              <Panel title="Giving Breakdown">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {donationsByOrganization.slice(0, 8).map((org, i) => {
                    const pct = (org.amount / total) * 100;
                    return (
                      <div key={org.name} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 0',
                        borderBottom: i < 7 ? '1px solid var(--border)' : 'none',
                      }}>
                        <span className="num" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', width: 18, flexShrink: 0 }}>
                          {i + 1}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>
                            {org.name}
                          </p>
                          <div style={{ height: 3, borderRadius: 2, background: 'var(--border2)', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: `rgba(34,197,94,${0.9 - i * 0.08})`, borderRadius: 2 }} />
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <p className="num" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                            {formatCurrency(org.amount, currency)}
                          </p>
                          <p className="num" style={{ fontSize: 11, color: 'var(--text3)' }}>
                            {pct.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            )}
          </div>
        )}

        {/* Donor overview + Top donors row */}
        {count > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: hasDonorData ? '1fr 1fr' : '1fr',
            gap: 16, marginBottom: 16,
          }}>
            {/* Donor overview */}
            <Panel title="Donor Overview">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

                {/* Big numbers */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
                  {[
                    { label: 'Total donations', value: count.toLocaleString() },
                    { label: 'Net received', value: formatCurrency(netTotal, currency) },
                    { label: 'Avg gift', value: formatCurrency(average, currency) },
                  ].map(({ label, value }) => (
                    <div key={label} style={{
                      padding: '12px 14px',
                      background: 'var(--surface2)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                    }}>
                      <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--text3)', marginBottom: 5 }}>{label}</p>
                      <p className="num" style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.3px' }}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Recurring breakdown */}
                {hasRecurringData ? (
                  <>
                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text3)', marginBottom: 10 }}>
                      Donor type
                    </p>
                    {[
                      { label: 'Recurring donors', count: recurringCount, amount: recurringTotal, color: '34,197,94' },
                      { label: 'One-time donors', count: oneTimeCount, amount: oneTimeTotal, color: '148,163,184' },
                    ].map(seg => {
                      const pct = total > 0 ? (seg.amount / total) * 100 : 0;
                      return (
                        <div key={seg.label} style={{ marginBottom: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                            <span style={{ fontSize: 13, color: 'var(--text2)' }}>
                              {seg.label}
                              <span className="num" style={{ marginLeft: 7, fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                                {seg.count.toLocaleString()}
                              </span>
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                              <span className="num" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                                {formatCurrency(seg.amount, currency)}
                              </span>
                              <span className="num" style={{
                                fontSize: 10, padding: '1px 6px', borderRadius: 20, fontWeight: 700,
                                background: `rgba(${seg.color},0.12)`, color: `rgb(${seg.color})`,
                              }}>
                                {pct.toFixed(0)}%
                              </span>
                            </span>
                          </div>
                          <div style={{ height: 4, borderRadius: 2, background: 'var(--border2)', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: `rgb(${seg.color})`, borderRadius: 2 }} />
                          </div>
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {[
                      { label: 'Active giving days', value: donationsByDay.length.toLocaleString(), sub: mostGenerousDay ? `peak ${formatShortDate(mostGenerousDay.date)}` : undefined },
                      { label: 'Largest gift', value: largest ? formatCurrency(largest.amount, currency) : '—', sub: largest?.organization || undefined },
                      ...(refundCount > 0 ? [{ label: 'Refunds / failed', value: refundCount.toLocaleString(), sub: 'excluded from totals' }] : []),
                    ].map(({ label, value, sub }, i, arr) => (
                      <div key={label} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '10px 0',
                        borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                      }}>
                        <div>
                          <p style={{ fontSize: 13, color: 'var(--text2)' }}>{label}</p>
                          {sub && <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{sub}</p>}
                        </div>
                        <span className="num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Panel>

            {/* Top donors leaderboard */}
            {hasDonorData && (
              <Panel
                title="Top Donors"
                action={<span style={{ fontSize: 11, color: 'var(--text3)' }}>{topDonors.length.toLocaleString()} identified</span>}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {topDonors.slice(0, 8).map((donor, i) => {
                    const pct = total > 0 ? (donor.amount / total) * 100 : 0;
                    return (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 0',
                        borderBottom: i < Math.min(topDonors.length, 8) - 1 ? '1px solid var(--border)' : 'none',
                      }}>
                        <span className="num" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', width: 18, flexShrink: 0 }}>
                          {i + 1}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {donor.name}
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                              <span className="num" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                                {formatCurrency(donor.amount, currency)}
                              </span>
                              {donor.isRecurring && (
                                <span style={{
                                  fontSize: 9, padding: '1px 5px', borderRadius: 8, fontWeight: 700,
                                  background: 'var(--green-bg)', color: 'var(--green)',
                                  textTransform: 'uppercase', letterSpacing: '0.05em',
                                }}>
                                  Recurring
                                </span>
                              )}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'var(--border2)', overflow: 'hidden' }}>
                              <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: `rgba(34,197,94,${0.9 - i * 0.08})`, borderRadius: 2 }} />
                            </div>
                            <span className="num" style={{ fontSize: 10, color: 'var(--text3)', flexShrink: 0 }}>
                              {donor.count > 1 ? `${donor.count} gifts` : '1 gift'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            )}
          </div>
        )}

        {/* Full transaction table */}
        <Panel
          title="All Transactions"
          action={
            <span style={{ fontSize: 11, color: 'var(--text3)', fontVariantNumeric: 'tabular-nums' }}>
              {donations.length.toLocaleString()} records
            </span>
          }
          fullWidth
        >
          <DonationTable donations={donations} currency={currency} />
        </Panel>

        {/* ── Share modal ── */}
      {showShare && (
        <ShareModal
          insights={insights}
          donorCount={hasDonorData ? topDonors.length : undefined}
          topDonors={hasDonorData ? topDonors : undefined}
          onClose={() => setShowShare(false)}
        />
      )}

      {/* ── Mapping settings modal ── */}
      {showSettings && draftMapping && currentSheet && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px',
          }}
          onClick={e => { if (e.target === e.currentTarget) setShowSettings(false); }}
        >
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 1100,
            maxHeight: '90vh', display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}>
            {/* Modal header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 24px', borderBottom: '1px solid var(--border)',
              background: 'var(--surface2)', flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <SlidersHorizontal size={14} color="var(--green)" />
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Column Mapping</span>
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>— adjust and re-apply to refresh the dashboard</span>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                style={{
                  width: 28, height: 28, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                  background: 'none', color: 'var(--text2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={13} />
              </button>
            </div>

            {/* Mapping table */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <MappingTable
                headers={currentSheet.headers}
                mapping={draftMapping}
                onChange={setDraftMapping}
                previewRows={currentSheet.rows.slice(0, 5)}
              />
            </div>

            {/* Modal footer */}
            <div style={{
              display: 'flex', justifyContent: 'flex-end', gap: 10,
              padding: '14px 24px', borderTop: '1px solid var(--border)',
              background: 'var(--surface2)', flexShrink: 0,
            }}>
              <button
                onClick={() => setShowSettings(false)}
                style={{
                  padding: '8px 16px', background: 'none', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--text2)', fontWeight: 500, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={applySettings}
                style={{
                  padding: '8px 20px', background: 'var(--green)', border: 'none',
                  borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'white', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Apply & Refresh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer quote */}
        <div style={{ textAlign: 'center', padding: '48px 0 28px', borderTop: '1px solid var(--border)', marginTop: 32 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36, borderRadius: 10, marginBottom: 14,
            background: 'var(--green-gradient)',
            boxShadow: '0 4px 12px rgba(22,163,74,0.35)',
          }}>
            <Moon size={16} color="white" />
          </div>
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text2)', fontStyle: 'italic', letterSpacing: '0.01em' }}>
            Taqabbal Allahu minna wa minkum
          </p>
          <p style={{ fontSize: 13, color: 'var(--text3)', marginTop: 6 }}>
            May Allah accept from us and from you.
          </p>
        </div>
      </div>
    </div>
  );
}
