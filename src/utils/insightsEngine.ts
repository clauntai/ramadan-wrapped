import type { Donation, DonationInsights } from '../types';

// Ramadan last 10 nights are the final 10 days.
// We try to detect Ramadan year from the data by seeing which year has the most donations.
// Ramadan 2024: Mar 11 - Apr 9 | 2025: Mar 1 - Mar 29 | 2023: Mar 23 - Apr 20
// Last 10 nights: days 21-30 of Ramadan

export const FAILED_STATUSES = new Set(['refunded', 'failed', 'cancelled', 'chargeback']);

const RAMADAN_RANGES: Record<number, [Date, Date]> = {
  2025: [new Date(2025, 2, 1), new Date(2025, 2, 30)],
  2024: [new Date(2024, 2, 11), new Date(2024, 3, 9)],
  2023: [new Date(2023, 2, 23), new Date(2023, 3, 21)],
  2022: [new Date(2022, 3, 2), new Date(2022, 3, 30)],
  2026: [new Date(2026, 1, 19), new Date(2026, 2, 19)],
};

function detectRamadanYear(donations: Donation[]): number | null {
  const dated = donations.filter((d) => d.date);
  if (!dated.length) return null;

  const countByYear: Record<number, number> = {};
  for (const d of dated) {
    const y = d.date!.getFullYear();
    countByYear[y] = (countByYear[y] || 0) + 1;
  }

  // Find the year with most donations
  const topYear = Object.entries(countByYear).sort((a, b) => b[1] - a[1])[0];
  return topYear ? parseInt(topYear[0]) : null;
}

export function computeInsights(donations: Donation[]): DonationInsights {
  // Step 1: effective donations — exclude failed/refunded statuses
  const effective = donations.filter(
    d => !FAILED_STATUSES.has(d.paymentStatus.toLowerCase().trim())
  );

  const year = detectRamadanYear(effective);
  const currency = (effective[0] ?? donations[0])?.currency || 'SAR';

  // Step 2: gross total (existing `total` field)
  const total = effective.reduce((s, d) => s + d.amount, 0);
  const count = effective.length;
  const average = count > 0 ? total / count : 0;

  // Step 3: net total (gross minus partial refunds on effective donations)
  const netTotal = total - effective.reduce((s, d) => s + d.refundAmount, 0);
  const refundCount = donations.length - effective.length;

  const largest = effective.reduce<Donation | null>(
    (best, d) => (!best || d.amount > best.amount ? d : best), null
  );

  // By day
  const dayMap = new Map<string, { date: Date; amount: number; count: number }>();
  for (const d of effective) {
    if (!d.date) continue;
    const key = d.date.toISOString().split('T')[0];
    const existing = dayMap.get(key);
    if (existing) { existing.amount += d.amount; existing.count++; }
    else dayMap.set(key, { date: new Date(d.date), amount: d.amount, count: 1 });
  }
  const donationsByDay = Array.from(dayMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
  const mostGenerousDay = donationsByDay.reduce<{ date: Date; amount: number; count: number } | null>(
    (best, d) => (!best || d.amount > best.amount ? d : best), null
  );

  // By category — skip rows with no category
  const categoryMap = new Map<string, { name: string; amount: number; count: number }>();
  for (const d of effective) {
    if (!d.category) continue;
    const existing = categoryMap.get(d.category);
    if (existing) { existing.amount += d.amount; existing.count++; }
    else categoryMap.set(d.category, { name: d.category, amount: d.amount, count: 1 });
  }
  const donationsByCategory = Array.from(categoryMap.values()).sort((a, b) => b.amount - a.amount);

  // By organization — skip rows with no organization
  const orgMap = new Map<string, { name: string; amount: number; count: number }>();
  for (const d of effective) {
    if (!d.organization) continue;
    const existing = orgMap.get(d.organization);
    if (existing) { existing.amount += d.amount; existing.count++; }
    else orgMap.set(d.organization, { name: d.organization, amount: d.amount, count: 1 });
  }
  const donationsByOrganization = Array.from(orgMap.values()).sort((a, b) => b.amount - a.amount);

  const topOrganization = donationsByOrganization[0] || null;
  const topCategory = donationsByCategory[0] || null;

  // Last 10 nights
  let last10NightsTotal = 0;
  let last10NightsCount = 0;
  if (year && RAMADAN_RANGES[year]) {
    const [start] = RAMADAN_RANGES[year];
    const day21 = new Date(start);
    day21.setDate(day21.getDate() + 20);
    for (const d of effective) {
      if (d.date && d.date >= day21) { last10NightsTotal += d.amount; last10NightsCount++; }
    }
  }

  // Step 4: recurring breakdown
  // A row is recurring if its recurringStatus value signals recurrence.
  // Handles: "Recurring", "Yes", "true", "1", "Monthly", "Weekly", "Annual", "Subscription", etc.
  const RECURRING_POSITIVE = /recurring|recur|subscription|monthly|weekly|annual|yearly|regular|\byes\b|\btrue\b/i;
  let recurringCount = 0;
  let recurringTotal = 0;
  let oneTimeCount = 0;
  let oneTimeTotal = 0;
  const hasRecurringData = effective.some(d => d.recurringStatus.trim() !== '');
  for (const d of effective) {
    const val = d.recurringStatus.trim();
    const isRecurring = val !== '' && (RECURRING_POSITIVE.test(val) || val === '1');
    if (isRecurring) {
      recurringCount++; recurringTotal += d.amount;
    } else {
      oneTimeCount++; oneTimeTotal += d.amount;
    }
  }

  return {
    total,
    count,
    average,
    largest,
    mostGenerousDay,
    topOrganization,
    topCategory,
    currency,
    donationsByDay,
    donationsByCategory,
    donationsByOrganization,
    last10NightsTotal,
    last10NightsCount,
    ramadanYear: year,
    netTotal,
    refundCount,
    recurringCount,
    recurringTotal,
    oneTimeCount,
    oneTimeTotal,
    hasRecurringData,
  };
}

export function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  }
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
