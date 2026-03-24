import { useState, useEffect, useCallback } from 'react';
import { X, Copy, Check, Pause, Play, ChevronLeft, ChevronRight, Moon, TrendingUp } from 'lucide-react';
import { formatCurrency } from '../utils/insightsEngine';
import type { DonationInsights } from '../types';

interface TopDonor {
  name: string;
  amount: number;
  count: number;
  isRecurring: boolean;
}

interface Props {
  insights: DonationInsights;
  onClose: () => void;
  donorCount?: number;
  topDonors?: TopDonor[];
}

interface Slide {
  id: string;
  bg: string;
  accentRgb: string; // for the backdrop glow — e.g. "34,197,94"
  render: () => React.ReactNode;
}

const SLIDE_DURATION = 5000;

// ── Decorative helpers ────────────────────────────────
const Orb = ({ color, size, style }: { color: string; size: number; style?: React.CSSProperties }) => (
  <div style={{
    position: 'absolute', width: size, height: size, borderRadius: '50%',
    background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
    pointerEvents: 'none', ...style,
  }} />
);

const Ring = ({ color, size, opacity = 0.08, style }: { color: string; size: number; opacity?: number; style?: React.CSSProperties }) => (
  <div style={{
    position: 'absolute', width: size, height: size, borderRadius: '50%',
    border: `1px solid ${color}`, opacity, pointerEvents: 'none', ...style,
  }} />
);

// ── Slides builder ────────────────────────────────────
function buildSlides(
  insights: DonationInsights,
  donorCount?: number,
  customTitle?: string,
  topDonors?: TopDonor[],
): Slide[] {
  const year = insights.ramadanYear ?? new Date().getFullYear();
  const slides: Slide[] = [];

  // ── 1. Intro ──────────────────────────────────────
  slides.push({
    id: 'intro',
    bg: 'radial-gradient(ellipse at 50% 85%, #0d2a12 0%, #040906 100%)',
    accentRgb: '34,197,94',
    render: () => (
      <div style={{
        position: 'relative', height: '100%', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '0 28px', textAlign: 'center',
      }}>
        <Orb color="rgba(34,197,94,0.28)" size={340} style={{ bottom: -100, left: '50%', transform: 'translateX(-50%)' }} />
        <Orb color="rgba(74,222,128,0.1)" size={180} style={{ top: -30, right: -60 }} />
        <Ring color="#22c55e" size={200} opacity={0.06} style={{ top: -60, right: -60 }} />
        <Ring color="#22c55e" size={100} opacity={0.05} style={{ bottom: 80, left: -20 }} />

        {/* Moon with glow */}
        <div style={{ position: 'relative', marginBottom: 22 }}>
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 100, height: 100, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(34,197,94,0.35) 0%, transparent 70%)',
          }} />
          <Moon size={62} color="#22c55e" strokeWidth={1.5} />
        </div>

        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.25em',
          textTransform: 'uppercase', color: 'rgba(34,197,94,0.8)', marginBottom: 16,
        }}>
          Ramadan {year}
        </div>
        <div style={{ fontSize: 44, fontWeight: 900, color: '#fff', lineHeight: 1.05, letterSpacing: '-2px' }}>
          {(customTitle || 'A Ramadan to Remember').split(' ').reduce<React.ReactNode[]>((acc, word, i, arr) => {
            acc.push(word);
            // line-break roughly in the middle for 3+ words
            if (i === Math.floor((arr.length - 1) / 2) && arr.length > 2) acc.push(<br key={i} />);
            else if (i < arr.length - 1) acc.push(' ');
            return acc;
          }, [])}
        </div>
        <div style={{
          fontSize: 14, color: 'rgba(255,255,255,0.38)', marginTop: 16, lineHeight: 1.6,
        }}>
          Here's what your generosity<br />made possible.
        </div>
        <div style={{
          width: 36, height: 2,
          background: 'linear-gradient(90deg, #16a34a, #22c55e, #4ade80)',
          borderRadius: 2, marginTop: 20,
        }} />
      </div>
    ),
  });

  // ── 2. Total raised ───────────────────────────────
  slides.push({
    id: 'total',
    bg: 'radial-gradient(ellipse at 25% 55%, #140b30 0%, #060313 100%)',
    accentRgb: '167,139,250',
    render: () => (
      <div style={{
        position: 'relative', height: '100%', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 28px',
      }}>
        <Orb color="rgba(139,92,246,0.3)" size={300} style={{ top: -60, right: -80 }} />
        <Orb color="rgba(167,139,250,0.1)" size={160} style={{ bottom: 40, left: -50 }} />
        <Ring color="#a78bfa" size={240} opacity={0.05} style={{ top: -50, right: -50 }} />
        <Ring color="#a78bfa" size={150} opacity={0.07} style={{ bottom: 30, left: -60 }} />

        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.25em',
          textTransform: 'uppercase', color: 'rgba(167,139,250,0.65)', marginBottom: 8,
        }}>
          This Ramadan, you gave
        </div>
        <div style={{
          fontSize: insights.total > 9999999 ? 34 : insights.total > 999999 ? 40 : 48,
          fontWeight: 900, lineHeight: 1, letterSpacing: '-2px', wordBreak: 'break-word',
          background: 'linear-gradient(140deg, #ffffff 20%, #c4b5fd 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          marginBottom: 16,
        }}>
          {formatCurrency(insights.total, insights.currency)}
        </div>

        <div style={{
          fontSize: 13, fontStyle: 'italic', color: 'rgba(196,181,253,0.6)',
          marginBottom: 20, letterSpacing: '0.01em',
        }}>
          Every gift opened a door.
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
          {[
            { val: insights.count.toLocaleString(), lbl: 'donations given' },
            ...(insights.donationsByDay.length > 0 ? [{ val: insights.donationsByDay.length.toString(), lbl: 'days of giving' }] : []),
            { val: formatCurrency(insights.average, insights.currency), lbl: 'avg gift' },
          ].map(({ val, lbl }) => (
            <div key={lbl} style={{
              padding: '6px 12px',
              background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)',
              borderRadius: 24,
            }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                <span style={{ fontWeight: 800, color: '#c4b5fd', fontSize: 13 }}>{val}</span>
                {' '}{lbl}
              </span>
            </div>
          ))}
        </div>

        <div style={{ height: 2, background: 'rgba(139,92,246,0.15)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: '100%', background: 'linear-gradient(90deg, #5b21b6, #7c3aed, #a78bfa, #c4b5fd)', borderRadius: 2 }} />
        </div>
      </div>
    ),
  });

  // ── 3. Supporters ─────────────────────────────────
  const supporterCount = donorCount ?? insights.count;
  const isDonors = !!donorCount;
  slides.push({
    id: 'supporters',
    bg: 'radial-gradient(ellipse at 70% 25%, #081a17 0%, #030c0a 100%)',
    accentRgb: '45,212,191',
    render: () => (
      <div style={{
        position: 'relative', height: '100%', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 28px',
      }}>
        <Orb color="rgba(45,212,191,0.22)" size={280} style={{ top: -60, right: -60 }} />
        <Orb color="rgba(20,184,166,0.12)" size={160} style={{ bottom: -30, left: -50 }} />
        <Ring color="#2dd4bf" size={220} opacity={0.07} style={{ top: -60, right: -60 }} />
        <Ring color="#2dd4bf" size={340} opacity={0.03} style={{ top: -110, right: -110 }} />

        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.25em',
          textTransform: 'uppercase', color: 'rgba(45,212,191,0.7)', marginBottom: 18,
        }}>
          {isDonors ? 'You Showed Up' : 'The Impact'}
        </div>
        <div style={{
          fontSize: supporterCount > 99999 ? 60 : supporterCount > 9999 ? 70 : supporterCount > 999 ? 80 : 88,
          fontWeight: 900, color: '#fff', lineHeight: 0.9, letterSpacing: '-4px',
          textShadow: '0 0 60px rgba(45,212,191,0.25)',
          marginBottom: 16,
        }}>
          {supporterCount.toLocaleString()}
        </div>
        <div style={{
          fontSize: isDonors ? 18 : 16, fontWeight: 600,
          color: 'rgba(255,255,255,0.45)', lineHeight: 1.5, whiteSpace: 'pre-line',
        }}>
          {isDonors
            ? 'donors kept\nthe doors open.'
            : 'donations made\nthis Ramadan possible.'}
        </div>

        {insights.hasRecurringData && insights.recurringCount > 0 && (
          <div style={{
            marginTop: 24, display: 'inline-flex', alignItems: 'center', gap: 10,
            padding: '11px 16px',
            background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.16)',
            borderRadius: 14,
          }}>
            <TrendingUp size={14} color="#2dd4bf" />
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
              <span style={{ fontSize: 18, fontWeight: 900, color: '#2dd4bf' }}>
                {insights.recurringCount}
              </span>
              {' '}showing up — month after month
            </span>
          </div>
        )}
      </div>
    ),
  });

  // ── 4. Top category ───────────────────────────────
  const topItem = insights.topCategory;
  if (topItem) {
    const pct = insights.total > 0 ? ((topItem.amount / insights.total) * 100).toFixed(0) : '0';
    slides.push({
      id: 'top-fund',
      bg: 'radial-gradient(ellipse at 50% 75%, #1f1200 0%, #0d0700 100%)',
      accentRgb: '251,191,36',
      render: () => (
        <div style={{
          position: 'relative', height: '100%', overflow: 'hidden',
          display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 28px',
        }}>
          <Orb color="rgba(251,191,36,0.2)" size={260} style={{ bottom: -50, right: -70 }} />
          <Orb color="rgba(245,158,11,0.08)" size={150} style={{ top: 20, left: -60 }} />
          <Ring color="#fbbf24" size={200} opacity={0.07} style={{ bottom: -50, right: -50 }} />
          <Ring color="#fbbf24" size={110} opacity={0.05} style={{ top: 30, left: -40 }} />

          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.25em',
            textTransform: 'uppercase', color: 'rgba(251,191,36,0.7)', marginBottom: 14,
          }}>
            Where your heart led you
          </div>
          <div style={{
            fontSize: Math.max(22, 38 - Math.max(0, topItem.name.length - 14) * 1.1),
            fontWeight: 900, color: '#fff', lineHeight: 1.1, marginBottom: 14, letterSpacing: '-0.5px',
          }}>
            {topItem.name}
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
            <span style={{
              fontSize: 62, fontWeight: 900, lineHeight: 1, letterSpacing: '-3px',
              background: 'linear-gradient(135deg, #fcd34d 0%, #f59e0b 60%, #d97706 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>{pct}%</span>
            <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>of your giving</span>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(251,191,36,0.45)', marginBottom: 8, fontStyle: 'italic' }}>
            You kept this cause alive.
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginBottom: 20 }}>
            {formatCurrency(topItem.amount, insights.currency)} raised for this cause
          </div>

          {/* Donor thank-you list */}
          <div>
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.2em',
              textTransform: 'uppercase', color: 'rgba(251,191,36,0.45)',
              marginBottom: 10,
            }}>
              Special thanks to
            </div>
            {topDonors && topDonors.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {topDonors.slice(0, 5).map((donor, i) => {
                  const name = donor.name.length > 24 ? donor.name.slice(0, 24) + '…' : donor.name;
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '7px 12px',
                      background: 'rgba(251,191,36,0.06)',
                      border: '1px solid rgba(251,191,36,0.12)',
                      borderRadius: 9,
                    }}>
                      <span style={{
                        fontSize: 9, fontWeight: 800, color: 'rgba(251,191,36,0.5)',
                        width: 14, textAlign: 'center', flexShrink: 0,
                      }}>
                        {i + 1}
                      </span>
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {name}
                      </span>
                      {donor.isRecurring && (
                        <span style={{
                          fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 20,
                          background: 'rgba(251,191,36,0.12)', color: 'rgba(251,191,36,0.6)',
                          letterSpacing: '0.08em', textTransform: 'uppercase', flexShrink: 0,
                        }}>Recurring</span>
                      )}
                    </div>
                  );
                })}
                {topDonors.length > 5 && (
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', textAlign: 'center', marginTop: 2 }}>
                    + {topDonors.length - 5} more generous souls
                  </p>
                )}
              </div>
            ) : (
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic', lineHeight: 1.6 }}>
                Thank you to every soul<br />who chose to give.
              </p>
            )}
          </div>
        </div>
      ),
    });
  }

  // ── 5. Last 10 nights ─────────────────────────────
  if (insights.last10NightsTotal > 0) {
    const pct = insights.total > 0 ? ((insights.last10NightsTotal / insights.total) * 100).toFixed(0) : '0';
    const STARS: [number, number, number][] = [
      [7,14,2.5],[9,71,1.5],[4,44,1],[17,86,2],[21,28,1.5],[12,58,2],[25,8,1.5],
      [14,50,1],[5,33,2],[19,79,1.5],[26,52,1],[6,91,2],[11,38,1],[22,65,2.5],
    ];
    slides.push({
      id: 'last10',
      bg: 'radial-gradient(ellipse at 50% 10%, #090c24 0%, #020306 100%)',
      accentRgb: '96,165,250',
      render: () => (
        <div style={{
          position: 'relative', height: '100%', overflow: 'hidden',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '0 28px', textAlign: 'center',
        }}>
          {STARS.map(([top, left, size], i) => (
            <div key={i} style={{
              position: 'absolute', top: `${top}%`, left: `${left}%`,
              width: size, height: size, borderRadius: '50%',
              background: 'rgba(255,255,255,0.65)',
              boxShadow: `0 0 ${size * 3}px rgba(147,197,253,0.5)`,
              pointerEvents: 'none',
            }} />
          ))}
          <Orb color="rgba(59,130,246,0.22)" size={260} style={{ top: -80, left: '50%', transform: 'translateX(-50%)' }} />
          <Ring color="#60a5fa" size={300} opacity={0.04} style={{ top: -100, left: '50%', transform: 'translateX(-50%)' }} />

          {/* Moon with layered glow */}
          <div style={{ position: 'relative', marginBottom: 18 }}>
            <div style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
              width: 110, height: 110, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(96,165,250,0.3) 0%, transparent 65%)',
            }} />
            <Moon size={54} color="#93c5fd" strokeWidth={1.5} />
          </div>

          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.25em',
            textTransform: 'uppercase', color: 'rgba(96,165,250,0.75)', marginBottom: 10,
          }}>
            Laylatul Qadr called.
          </div>
          <div style={{
            fontSize: 26, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px',
            marginBottom: 4, fontStyle: 'italic',
          }}>
            You answered.
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'rgba(255,255,255,0.7)', letterSpacing: '-0.3px', marginBottom: 8 }}>
            {formatCurrency(insights.last10NightsTotal, insights.currency)}
          </div>
          <div style={{
            fontSize: 70, fontWeight: 900, color: '#60a5fa', lineHeight: 1, letterSpacing: '-3px',
            margin: '4px 0 10px',
            textShadow: '0 0 50px rgba(96,165,250,0.4)',
          }}>
            {pct}%
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', lineHeight: 1.65 }}>
            of your giving — in the<br />
            <span style={{ color: 'rgba(96,165,250,0.65)', fontWeight: 500 }}>
              most sacred nights of the year.
            </span>
          </div>
          <div style={{ marginTop: 22, width: '75%', height: 3, background: 'rgba(96,165,250,0.1)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #1d4ed8, #3b82f6, #60a5fa)', borderRadius: 2 }} />
          </div>
        </div>
      ),
    });
  }

  // ── 6. Outro ──────────────────────────────────────
  slides.push({
    id: 'outro',
    bg: 'radial-gradient(ellipse at 50% 100%, #102214 0%, #030806 100%)',
    accentRgb: '34,197,94',
    render: () => (
      <div style={{
        position: 'relative', height: '100%', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '0 32px', textAlign: 'center',
      }}>
        <Orb color="rgba(34,197,94,0.22)" size={300} style={{ bottom: -70, left: '50%', transform: 'translateX(-50%)' }} />
        <Ring color="#22c55e" size={200} opacity={0.05} style={{ bottom: -20, left: '50%', transform: 'translateX(-50%)' }} />
        <Orb color="rgba(74,222,128,0.08)" size={140} style={{ top: -30, right: -40 }} />

        {/* Geometric star ornament */}
        <div style={{ position: 'relative', width: 44, height: 44, marginBottom: 26, flexShrink: 0 }}>
          {[0, 45].map(r => (
            <div key={r} style={{
              position: 'absolute', inset: 0,
              background: 'rgba(34,197,94,0.22)', borderRadius: 7,
              transform: `rotate(${r}deg)`,
            }} />
          ))}
          <div style={{
            position: 'absolute', inset: '28%', background: 'rgba(34,197,94,0.55)',
            borderRadius: '50%',
          }} />
        </div>

        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.28)', marginBottom: 18, lineHeight: 1.7, letterSpacing: '0.01em' }}>
          Your generosity will echo<br />long after this Ramadan.
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', lineHeight: 1.5, marginBottom: 8, letterSpacing: '0.02em' }}>
          Taqabbal Allahu<br />minna wa minkum
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', marginBottom: 28, lineHeight: 1.55, fontStyle: 'italic' }}>
          May Allah accept from us and from you
        </div>

        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', justifyContent: 'center' }}>
          {[`#RamadanWrapped`, `#Ramadan${year}`].map(tag => (
            <span key={tag} style={{
              fontSize: 10, padding: '4px 11px', borderRadius: 24, fontWeight: 700,
              background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)',
              color: 'rgba(34,197,94,0.72)', letterSpacing: '0.02em',
            }}>{tag}</span>
          ))}
        </div>
      </div>
    ),
  });

  return slides;
}

// ── Share text ────────────────────────────────────────
function buildShareText(insights: DonationInsights, donorCount?: number): string {
  const year = insights.ramadanYear ?? new Date().getFullYear();
  const lines = [
    `🌙 My Ramadan ${year} Giving Wrapped`,
    '',
    `💰 ${formatCurrency(insights.total, insights.currency)} raised`,
  ];
  if (donorCount) lines.push(`👥 ${donorCount.toLocaleString()} donors`);
  else lines.push(`📋 ${insights.count.toLocaleString()} donations`);
  if (insights.hasRecurringData && insights.recurringCount > 0)
    lines.push(`🔁 ${insights.recurringCount} recurring donors`);
  if (insights.last10NightsTotal > 0) {
    const pct = ((insights.last10NightsTotal / insights.total) * 100).toFixed(0);
    lines.push(`⭐ ${pct}% given in the Last 10 Nights`);
  }
  if (insights.topCategory) lines.push(`🎯 Top cause: ${insights.topCategory.name}`);
  lines.push('', `#RamadanWrapped #Ramadan${year}`);
  return lines.join('\n');
}

// ── Component ─────────────────────────────────────────
export function ShareModal({ insights, onClose, donorCount, topDonors }: Props) {
  const [customTitle, setCustomTitle] = useState('A Ramadan to Remember');
  const slides = buildSlides(insights, donorCount, customTitle, topDonors);
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [copied, setCopied] = useState(false);

  const next = useCallback(() => setCurrent(i => Math.min(i + 1, slides.length - 1)), [slides.length]);
  const prev = useCallback(() => setCurrent(i => Math.max(i - 1, 0)), []);

  useEffect(() => {
    if (!playing || current >= slides.length - 1) return;
    const t = setTimeout(next, SLIDE_DURATION);
    return () => clearTimeout(t);
  }, [current, playing, next, slides.length]);

  const shareText = buildShareText(insights, donorCount);
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const twitterUrl  = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleNativeShare = async () => {
    try { await navigator.share({ title: `Ramadan ${insights.ramadanYear} Wrapped`, text: shareText }); }
    catch { /* dismissed */ }
  };

  const slide = slides[current];

  return (
    <>
      <style>{`
        @keyframes rw-slide-in {
          from { opacity: 0; transform: scale(0.97) translateY(6px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes rw-progress {
          from { width: 0%; }
          to   { width: 100%; }
        }
        @keyframes rw-fade-up {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Backdrop */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: `radial-gradient(ellipse at center, rgba(${slide.accentRgb},0.06) 0%, rgba(0,0,0,0.88) 55%)`,
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px', gap: 36,
          transition: 'background 600ms ease',
        }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        {/* ── Phone frame ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, flexShrink: 0 }}>
          <div style={{
            width: 308, height: 630,
            background: '#0a0a0a',
            borderRadius: 52,
            border: '7px solid #1c1c1c',
            boxShadow: '0 0 0 1px #2d2d2d, 0 40px 100px rgba(0,0,0,0.8), inset 0 0 0 1px rgba(255,255,255,0.04)',
            overflow: 'hidden',
            position: 'relative',
            flexShrink: 0,
          }}>
            {/* Dynamic island */}
            <div style={{
              position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
              width: 92, height: 28, background: '#000',
              borderRadius: 20, zIndex: 20,
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05)',
            }} />

            {/* Side button (decorative) */}
            <div style={{
              position: 'absolute', right: -9, top: 120,
              width: 4, height: 64, background: '#1c1c1c',
              borderRadius: '0 4px 4px 0',
            }} />
            <div style={{
              position: 'absolute', left: -9, top: 100,
              width: 4, height: 36, background: '#1c1c1c',
              borderRadius: '4px 0 0 4px',
            }} />
            <div style={{
              position: 'absolute', left: -9, top: 148,
              width: 4, height: 52, background: '#1c1c1c',
              borderRadius: '4px 0 0 4px',
            }} />
            <div style={{
              position: 'absolute', left: -9, top: 212,
              width: 4, height: 52, background: '#1c1c1c',
              borderRadius: '4px 0 0 4px',
            }} />

            {/* Screen top gloss */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 80, zIndex: 15,
              background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 100%)',
              pointerEvents: 'none', borderRadius: '46px 46px 0 0',
            }} />

            {/* Slide content */}
            <div
              key={current}
              style={{
                position: 'absolute', inset: 0,
                background: slide.bg,
                animation: 'rw-slide-in 0.3s cubic-bezier(0.16,1,0.3,1) forwards',
                color: '#fff',
              }}
            >
              {slide.render()}
            </div>

            {/* Overlays: progress bars + brand mark */}
            <div style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none' }}>
              {/* Progress bars */}
              <div style={{
                position: 'absolute', top: 52, left: 14, right: 14,
                display: 'flex', gap: 3,
              }}>
                {slides.map((s, i) => (
                  <div key={s.id} style={{
                    flex: 1, height: 2.5, borderRadius: 2,
                    background: 'rgba(255,255,255,0.2)', overflow: 'hidden',
                  }}>
                    {i < current && (
                      <div style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,0.85)' }} />
                    )}
                    {i === current && playing && (
                      <div key={`${current}-p`} style={{
                        height: '100%', background: '#fff', borderRadius: 2,
                        animation: `rw-progress ${SLIDE_DURATION}ms linear forwards`,
                      }} />
                    )}
                    {i === current && !playing && (
                      <div style={{ width: '40%', height: '100%', background: 'rgba(255,255,255,0.85)' }} />
                    )}
                  </div>
                ))}
              </div>

              {/* Brand watermark — bottom center */}
              <div style={{
                position: 'absolute', bottom: 20, left: 0, right: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              }}>
                <Moon size={9} color="rgba(255,255,255,0.22)" strokeWidth={2} />
                <span style={{
                  fontSize: 8.5, fontWeight: 700, letterSpacing: '0.22em',
                  textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)',
                }}>
                  Ramadan Wrapped
                </span>
              </div>
            </div>

            {/* Tap zones */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', zIndex: 5 }}>
              <div style={{ flex: 1, cursor: current === 0 ? 'default' : 'pointer' }} onClick={prev} />
              <div style={{ flex: 1, cursor: current === slides.length - 1 ? 'default' : 'pointer' }} onClick={next} />
            </div>
          </div>

          {/* Controls below phone */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={prev} disabled={current === 0} style={{
              width: 34, height: 34, borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.12)',
              background: current === 0 ? 'transparent' : 'rgba(255,255,255,0.06)',
              color: current === 0 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.75)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: current === 0 ? 'default' : 'pointer',
              transition: 'all 150ms',
            }}>
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => setPlaying(p => !p)} style={{
              width: 34, height: 34, borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 150ms',
            }}>
              {playing ? <Pause size={13} /> : <Play size={13} />}
            </button>
            <button onClick={next} disabled={current === slides.length - 1} style={{
              width: 34, height: 34, borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.12)',
              background: current === slides.length - 1 ? 'transparent' : 'rgba(255,255,255,0.06)',
              color: current === slides.length - 1 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.75)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: current === slides.length - 1 ? 'default' : 'pointer',
              transition: 'all 150ms',
            }}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* ── Side panel ── */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 0,
          width: 248,
          animation: 'rw-fade-up 0.4s cubic-bezier(0.16,1,0.3,1) both 0.1s',
        }}>
          {/* Close */}
          <button onClick={onClose} style={{
            width: 30, height: 30, marginBottom: 22,
            border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: 8, background: 'rgba(255,255,255,0.05)',
            color: 'rgba(255,255,255,0.45)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            transition: 'all 150ms',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; }}
          >
            <X size={13} />
          </button>

          <p style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 6, letterSpacing: '-0.5px' }}>
            Share Your Wrapped
          </p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', lineHeight: 1.6, marginBottom: 24 }}>
            Swipe through your story, then share the summary with your community.
          </p>

          {/* Customise intro title */}
          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
              textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: 7,
            }}>
              Intro title
            </label>
            <input
              value={customTitle}
              onChange={e => { setCustomTitle(e.target.value); setCurrent(0); }}
              placeholder="A Ramadan to Remember"
              maxLength={40}
              style={{
                width: '100%', padding: '9px 13px', boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10, color: '#fff', fontSize: 13, fontFamily: 'inherit',
                outline: 'none', transition: 'border-color 150ms',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.28)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
            />
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)', marginTop: 5 }}>
              Edits live on slide 1 as you type.
            </p>
          </div>

          {/* Slide dot indicator */}
          <div style={{ display: 'flex', gap: 5, marginBottom: 24, alignItems: 'center' }}>
            {slides.map((_, i) => (
              <button key={i} onClick={() => { setCurrent(i); setPlaying(false); }} style={{
                height: 5,
                width: i === current ? 22 : 5,
                borderRadius: 3,
                background: i === current ? '#fff' : 'rgba(255,255,255,0.2)',
                border: 'none', cursor: 'pointer', padding: 0,
                transition: 'all 300ms cubic-bezier(0.16,1,0.3,1)',
                flexShrink: 0,
              }} />
            ))}
          </div>

          {/* Share buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <a
              href={whatsappUrl}
              target="_blank" rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '12px 0', borderRadius: 12,
                background: 'linear-gradient(135deg, #1ead55 0%, #25D366 100%)',
                color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none',
                boxShadow: '0 4px 16px rgba(37,211,102,0.25)',
                transition: 'opacity 150ms, box-shadow 150ms',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.9'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1'; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp
            </a>

            <a
              href={twitterUrl}
              target="_blank" rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '12px 0', borderRadius: 12,
                background: '#000', border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none',
                transition: 'background 150ms',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#111'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#000'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.736-8.849L2.249 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              Post on 𝕏
            </a>

            {typeof navigator.share === 'function' && (
              <button onClick={handleNativeShare} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '12px 0', borderRadius: 12,
                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                transition: 'background 150ms',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
              >
                ↗ More options
              </button>
            )}

            <button onClick={handleCopy} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '12px 0', borderRadius: 12,
              background: copied ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.09)'}`,
              color: copied ? '#22c55e' : 'rgba(255,255,255,0.5)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              transition: 'all 200ms',
            }}
              onMouseEnter={e => { if (!copied) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
              onMouseLeave={e => { if (!copied) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
            >
              {copied
                ? <><Check size={13} /> Copied to clipboard</>
                : <><Copy size={13} /> Copy summary text</>
              }
            </button>
          </div>

          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', lineHeight: 1.6, marginTop: 18 }}>
            Tap the dots to jump to a slide. Tap left/right on the phone to navigate.
          </p>
        </div>
      </div>
    </>
  );
}
