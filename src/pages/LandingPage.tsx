import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Moon, Sun, Upload, FileSpreadsheet,
  ChevronRight, Shield, Zap, BarChart3, AlertCircle, Tag,
} from 'lucide-react';
import { FileDropzone } from '../components/FileDropzone';
import { MappingTable } from '../components/MappingTable';
import { CategoryReview } from '../components/CategoryReview';
import { useDonation } from '../context/DonationContext';
import { parseWorkbook, detectColumns, buildDonations } from '../utils/excelParser';
import { computeInsights } from '../utils/insightsEngine';
import {
  buildOrgSegments, applyCategoryMap, needsCategoryReview,
  type Category, type OrgSegment,
} from '../utils/autoCategor';
import type { SheetData, Donation } from '../types';

// ── Theme ────────────────────────────────────────────
function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
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


// ── Component ────────────────────────────────────────
export function LandingPage() {
  const navigate = useNavigate();
  const ctx = useDonation();
  const { theme, toggle } = useTheme();

  // wizard state
  const [loading,             setLoading]             = useState(false);
  const [error,               setError]               = useState<string | null>(null);
  const [step,                setStep]                 = useState<0 | 1 | 2 | 3>(0);
  const [sheets,              setSheets]              = useState<SheetData[]>([]);
  const [selectedSheetName,   setSelectedSheetName]   = useState('');
  const [sheetPicker,         setSheetPicker]         = useState(false);

  // categorisation state (lives here, not in context)
  const [rawDonations,    setRawDonations]   = useState<Donation[]>([]);
  const [orgSegments,     setOrgSegments]    = useState<OrgSegment[]>([]);
  const [categoryMap,     setCategoryMap]    = useState<Map<string, Category>>(new Map());

  const currentSheet = sheets.find(s => s.name === selectedSheetName);

  // ── handlers ────────────────────────────────────────
  const handleFile = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const wb = await parseWorkbook(file);
      if (!wb.sheets.length || wb.sheets[0].rows.length === 0)
        throw new Error('The file appears to be empty.');
      ctx.setWorkbook(wb);
      setSheets(wb.sheets);
      const first = wb.sheets[0];
      setSelectedSheetName(first.name);
      ctx.setSelectedSheet(first.name);
      ctx.setColumnMapping(detectColumns(first.headers));
      if (wb.sheets.length > 1) setSheetPicker(true);
      setStep(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse file.');
    } finally {
      setLoading(false);
    }
  }, [ctx]);

  const handleSheetSelect = (name: string) => {
    const sheet = sheets.find(s => s.name === name);
    if (!sheet) return;
    setSelectedSheetName(name);
    ctx.setSelectedSheet(name);
    ctx.setColumnMapping(detectColumns(sheet.headers));
    setSheetPicker(false);
  };

  const handleMapContinue = () => {
    if (!ctx.columnMapping.amount) {
      setError('Please map the Amount column before continuing.');
      return;
    }
    const sheet = sheets.find(s => s.name === selectedSheetName);
    if (!sheet) return;
    const donations = buildDonations(sheet.rows, ctx.columnMapping);
    if (!donations.length) {
      setError('No valid donations found. Check that the Amount column contains numbers.');
      return;
    }
    setRawDonations(donations);
    setError(null);

    if (needsCategoryReview(donations)) {
      const segs = buildOrgSegments(donations);
      setOrgSegments(segs);
      // seed category map with suggestions
      const initial = new Map<string, Category>();
      for (const s of segs) initial.set(s.org, s.suggestedCategory);
      setCategoryMap(initial);
      setStep(2);
    } else {
      // skip categorise step — go straight to recap
      finalise(donations);
    }
  };

  const handleCategoriseContinue = () => {
    const categorised = applyCategoryMap(rawDonations, categoryMap);
    finalise(categorised);
  };

  const finalise = (donations: Donation[]) => {
    ctx.setDonations(donations);
    ctx.setInsights(computeInsights(donations));
    navigate('/recap');
  };

  const reset = () => {
    setStep(0); setError(null);
    setSheetPicker(false); setRawDonations([]);
    setOrgSegments([]); setCategoryMap(new Map());
    ctx.reset();
  };

  // ── visible step index for the indicator (0-based, 0=Map, 1=Categorise, 2=Recap)
  const indicatorStep = step === 0 ? -1 : step - 1;

  // ── Shared card style ─────────────────────────────
  const card: React.CSSProperties = {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', padding: '28px 32px',
  };

  return (
    <div style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>

      {/* ── Nav ── */}
      <nav style={{
        height: 'var(--header-h)', padding: '0 24px',
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: 'var(--green-bg)', border: '1px solid var(--green-ring)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Moon size={15} color="var(--green)" />
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px' }}>
            Ramadan Wrapped
          </span>
        </div>
        <button
          onClick={toggle}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          style={{
            width: 36, height: 36, borderRadius: 'var(--radius-sm)',
            background: 'var(--surface2)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text2)', transition: 'all 150ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--green)'; e.currentTarget.style.color = 'var(--green)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)'; }}
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </nav>

      {/* ── Main ── */}
      <main style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 24px 80px' }}>
        <div style={{ width: '100%', maxWidth: step === 2 ? 780 : 640 }}>

          {/* Hero */}
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 12px', borderRadius: 20,
              background: 'var(--green-bg)', border: '1px solid var(--green-ring)',
              fontSize: 12, fontWeight: 600, color: 'var(--green)',
              letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)' }} />
              Ramadan {new Date().getFullYear()}
            </div>
            <h1 style={{
              fontSize: 'clamp(26px, 5vw, 42px)', fontWeight: 700,
              color: 'var(--text)', letterSpacing: '-0.7px', lineHeight: 1.15,
              marginBottom: 12,
            }}>
              Your Giving, Visualised
            </h1>
            <p style={{ fontSize: 15, color: 'var(--text2)', lineHeight: 1.7, maxWidth: 440, margin: '0 auto' }}>
              Upload any donation spreadsheet and get an instant financial recap — charts, totals, and insights.
            </p>
          </div>

          {/* Step indicator (steps 1-3) */}
          {step > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
              {(['Map', 'Categorise', 'Recap'] as const).map((label, i) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', flex: i < 2 ? 1 : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%', fontSize: 11, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: i <= indicatorStep ? 'var(--green)' : 'var(--surface3)',
                      color: i <= indicatorStep ? 'white' : 'var(--text3)',
                      border: `1px solid ${i <= indicatorStep ? 'var(--green)' : 'var(--border)'}`,
                      transition: 'all 200ms',
                    }}>{i + 1}</div>
                    <span style={{ fontSize: 12, fontWeight: 500, color: i === indicatorStep ? 'var(--text)' : 'var(--text3)', whiteSpace: 'nowrap' }}>
                      {label}
                    </span>
                  </div>
                  {i < 2 && (
                    <div style={{ flex: 1, height: 1, background: i < indicatorStep ? 'var(--green)' : 'var(--border)', margin: '0 10px', transition: 'background 300ms' }} />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ─── Step 0: Upload ─── */}
          {step === 0 && (
            <FileDropzone onFile={handleFile} isLoading={loading} error={error} />
          )}

          {/* ─── Step 1: Map columns ─── */}
          {step === 1 && currentSheet && (
            <div style={card}>
              {/* Sheet picker (collapsed by default if only 1 sheet) */}
              {sheets.length > 1 && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Sheet</span>
                    <button onClick={() => setSheetPicker(v => !v)}
                      style={{ fontSize: 12, color: 'var(--green)', background: 'none', border: 'none', fontWeight: 600, cursor: 'pointer' }}>
                      Change
                    </button>
                  </div>
                  {sheetPicker ? (
                    <div style={{ display: 'grid', gap: 6 }}>
                      {sheets.map(sh => (
                        <button key={sh.name} onClick={() => handleSheetSelect(sh.name)}
                          style={{
                            padding: '9px 14px', background: sh.name === selectedSheetName ? 'var(--green-bg)' : 'var(--surface2)',
                            border: `1px solid ${sh.name === selectedSheetName ? 'var(--green-ring)' : 'var(--border)'}`,
                            borderRadius: 'var(--radius-sm)',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            color: 'var(--text)', fontSize: 13, fontWeight: 500,
                          }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <FileSpreadsheet size={13} color="var(--green)" /> {sh.name}
                          </span>
                          <span className="num" style={{ fontSize: 11, color: 'var(--text3)' }}>{sh.rows.length.toLocaleString()} rows</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div style={{
                      padding: '8px 12px', background: 'var(--green-bg)',
                      border: '1px solid var(--green-ring)', borderRadius: 'var(--radius-sm)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      fontSize: 13,
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <FileSpreadsheet size={13} color="var(--green)" />
                        <strong style={{ color: 'var(--text)' }}>{selectedSheetName}</strong>
                      </span>
                      <span className="num" style={{ fontSize: 11, color: 'var(--text3)' }}>{currentSheet.rows.length.toLocaleString()} rows · {currentSheet.headers.length} cols</span>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Map Columns</h2>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20,
                  background: 'var(--green-bg)', color: 'var(--green)',
                }}>
                  <Zap size={9} /> Auto-detected
                </div>
              </div>

              {/* slice(0, 5): MappingTable shows up to PREVIEW_ROW_COUNT=4 rows; 5 gives a small buffer */}
              <MappingTable
                headers={currentSheet.headers}
                mapping={ctx.columnMapping}
                onChange={ctx.setColumnMapping}
                previewRows={currentSheet.rows.slice(0, 5)}
              />

              {error && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 7, marginTop: 14,
                  padding: '9px 12px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--red-bg)', border: '1px solid rgba(220,38,38,0.2)',
                  fontSize: 13, color: 'var(--red)',
                }}>
                  <AlertCircle size={13} /> {error}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 22, gap: 10 }}>
                <button onClick={reset} style={{
                  padding: '8px 16px', background: 'none',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                  fontSize: 13, color: 'var(--text2)', fontWeight: 500,
                }}>← Start over</button>
                <button onClick={handleMapContinue} style={{
                  padding: '9px 20px', background: 'var(--green)', border: 'none',
                  borderRadius: 'var(--radius-sm)', color: 'white',
                  fontSize: 13, fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 6,
                  transition: 'opacity 150ms',
                }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                  Continue <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* ─── Step 2: Categorise ─── */}
          {step === 2 && (
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
                    Categorise Donations
                  </h2>
                  <p style={{ fontSize: 13, color: 'var(--text2)' }}>
                    No category data found — we auto-detected categories by organisation name.
                  </p>
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', borderRadius: 20,
                  background: 'var(--green-bg)', color: 'var(--green)',
                  fontSize: 11, fontWeight: 700,
                }}>
                  <Tag size={10} /> {orgSegments.length} orgs
                </div>
              </div>

              <CategoryReview
                segments={orgSegments}
                currency={rawDonations[0]?.currency ?? 'SAR'}
                onChange={setCategoryMap}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 22, gap: 10 }}>
                <button onClick={() => { setStep(1); setError(null); }} style={{
                  padding: '8px 16px', background: 'none',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                  fontSize: 13, color: 'var(--text2)', fontWeight: 500,
                }}>← Back</button>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => finalise(rawDonations)} style={{
                    padding: '9px 16px', background: 'none',
                    border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                    fontSize: 13, color: 'var(--text2)', fontWeight: 500,
                  }}>Skip</button>
                  <button onClick={handleCategoriseContinue} style={{
                    padding: '9px 20px', background: 'var(--green)', border: 'none',
                    borderRadius: 'var(--radius-sm)', color: 'white',
                    fontSize: 13, fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 6,
                      transition: 'opacity 150ms',
                  }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                  >
                    Generate Recap <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Feature strip (upload step only) */}
          {step === 0 && !loading && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginTop: 32 }}>
              {[
                { icon: <Upload size={15} />, t: 'Any Format', d: '.xlsx, .xls, .csv — no template' },
                { icon: <Zap size={15} />, t: 'Smart Mapping', d: 'Columns & categories auto-detected' },
                { icon: <BarChart3 size={15} />, t: 'Full Dashboard', d: 'Charts, KPIs & insights' },
              ].map(({ icon, t, d }) => (
                <div key={t} style={{
                  padding: '16px 14px', background: 'var(--surface)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                }}>
                  <div style={{ color: 'var(--green)', marginBottom: 7 }}>{icon}</div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>{t}</p>
                  <p style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>{d}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <footer style={{
        padding: '11px 24px', borderTop: '1px solid var(--border)',
        background: 'var(--surface)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        fontSize: 12, color: 'var(--text3)',
      }}>
        <Shield size={11} color="var(--green)" />
        All data stays in your browser — nothing is uploaded to any server.
      </footer>
    </div>
  );
}
