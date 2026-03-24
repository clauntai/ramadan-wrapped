import type { ColumnMapping, Donation, DonationInsights, ParsedWorkbook } from '../types';

const CACHE_KEY = 'rw_session_v1';

export interface CachedSession {
  savedAt: string; // ISO string
  fileName: string;
  sheetNames: string[];
  selectedSheet: string | null;
  columnMapping: ColumnMapping;
  donations: Donation[];
  insights: DonationInsights | null;
}

// ── Serialise ─────────────────────────────────────────
export function saveSession(
  workbook: ParsedWorkbook,
  selectedSheet: string | null,
  columnMapping: ColumnMapping,
  donations: Donation[],
  insights: DonationInsights | null,
): void {
  const session: CachedSession = {
    savedAt: new Date().toISOString(),
    fileName: workbook.fileName,
    sheetNames: workbook.sheets.map(s => s.name),
    selectedSheet,
    columnMapping,
    donations,
    insights,
  };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(session));
  } catch {
    // Quota exceeded — silently skip
  }
}

// ── Deserialise ───────────────────────────────────────
function reviveDonation(d: Donation & { date: string | null }): Donation {
  return { ...d, date: d.date ? new Date(d.date) : null };
}

function reviveInsights(ins: DonationInsights & {
  mostGenerousDay: { date: string; amount: number; count: number } | null;
  donationsByDay: { date: string; amount: number; count: number }[];
  largest: (Donation & { date: string | null }) | null;
}): DonationInsights {
  return {
    ...ins,
    largest: ins.largest ? reviveDonation(ins.largest) : null,
    mostGenerousDay: ins.mostGenerousDay
      ? { ...ins.mostGenerousDay, date: new Date(ins.mostGenerousDay.date) }
      : null,
    donationsByDay: ins.donationsByDay.map(x => ({ ...x, date: new Date(x.date) })),
  };
}

export function loadSession(): CachedSession | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = JSON.parse(raw) as any;
    return {
      ...parsed,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      donations: (parsed.donations as any[]).map(reviveDonation),
      insights: parsed.insights ? reviveInsights(parsed.insights) : null,
    } as CachedSession;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(CACHE_KEY);
}
