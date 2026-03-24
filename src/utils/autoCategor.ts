import type { Donation } from '../types';

// ── Category taxonomy ────────────────────────────────
export const ALL_CATEGORIES = [
  'Zakat',
  'Zakat al-Fitr',
  'Sadaqah',
  'Kaffarah',
  'Waqf',
  'Orphan Sponsorship',
  'Food & Iftar',
  'Water & Sanitation',
  'Education',
  'Medical Aid',
  'Mosque & Masjid',
  'Palestine & Gaza',
  'Yemen Relief',
  'Syria Relief',
  'Sudan Relief',
  'Disaster Relief',
  'General Charity',
] as const;

export type Category = (typeof ALL_CATEGORIES)[number];

// ── Keyword rules (higher index = higher priority on tie) ──
const RULES: { category: Category; keywords: string[] }[] = [
  {
    category: 'Zakat',
    keywords: ['zakat', 'zakah', 'zakaat', 'زكاة', 'زكات', 'zakat al mal', 'zakat ul mal'],
  },
  {
    category: 'Zakat al-Fitr',
    keywords: ['fitr', 'fitrana', 'fitra', 'fidya', 'fidyah', 'zakatul fitr', 'zakat al fitr', 'zakat ul fitr'],
  },
  {
    category: 'Kaffarah',
    keywords: ['kaffarah', 'kaffara', 'expiation', 'كفارة', 'atonement'],
  },
  {
    category: 'Waqf',
    keywords: ['waqf', 'waqaf', 'endowment', 'perpetual', 'وقف'],
  },
  {
    category: 'Orphan Sponsorship',
    keywords: ['orphan', 'yateem', 'يتيم', 'child sponsor', 'sponsor a child', 'orphanage', 'kafala'],
  },
  {
    category: 'Food & Iftar',
    keywords: ['food', 'iftar', 'meal', 'feed', 'hunger', 'feeding', 'ration', 'grocery', 'bread', 'iftar meal', 'food pack', 'food basket', 'suhoor'],
  },
  {
    category: 'Water & Sanitation',
    keywords: ['water', 'well', 'borehole', 'sanitation', 'wash', 'clean water', 'مياه', 'water well'],
  },
  {
    category: 'Education',
    keywords: ['education', 'school', 'madrasa', 'quran', 'learning', 'student', 'scholarship', 'literacy', 'تعليم', 'مدرسة', 'university', 'college', 'teach'],
  },
  {
    category: 'Medical Aid',
    keywords: ['medical', 'health', 'hospital', 'clinic', 'medicine', 'doctor', 'treatment', 'ambulance', 'صحة', 'مستشفى', 'healthcare', 'surgical'],
  },
  {
    category: 'Mosque & Masjid',
    keywords: ['mosque', 'masjid', 'مسجد', 'prayer hall', 'islamic center', 'islamic centre'],
  },
  {
    category: 'Palestine & Gaza',
    keywords: ['palestine', 'gaza', 'غزة', 'فلسطين', 'al-aqsa', 'aqsa', 'west bank', 'gazan', 'palestinian'],
  },
  {
    category: 'Yemen Relief',
    keywords: ['yemen', 'يمن', 'yemeni'],
  },
  {
    category: 'Syria Relief',
    keywords: ['syria', 'syrian', 'سوريا', 'سوري', 'aleppo', 'idlib'],
  },
  {
    category: 'Sudan Relief',
    keywords: ['sudan', 'سودان', 'sudanese', 'darfur'],
  },
  {
    category: 'Disaster Relief',
    keywords: ['disaster', 'relief', 'emergency', 'flood', 'earthquake', 'hurricane', 'tsunami', 'crisis', 'refugee', 'IDPs', 'displaced'],
  },
  {
    category: 'Sadaqah',
    keywords: ['sadaqah', 'sadaqa', 'sadaka', 'صدقة', 'voluntary', 'charity', 'donation', 'general'],
  },
];

interface GuessResult {
  category: Category;
  confidence: 'high' | 'medium' | 'low';
}

export function guessCategory(text: string): GuessResult {
  const lower = text.toLowerCase();
  let bestCategory: Category = 'General Charity';
  let bestScore = 0;

  for (const { category, keywords } of RULES) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        // Longer keyword = more specific = higher score
        const score = kw.length + (lower === kw ? 20 : 0);
        if (score > bestScore) {
          bestScore = score;
          bestCategory = category;
        }
      }
    }
  }

  const confidence: GuessResult['confidence'] =
    bestScore === 0 ? 'low' :
    bestScore >= 8  ? 'high' : 'medium';

  return { category: bestCategory, confidence };
}

// ── Per-org segmentation ─────────────────────────────
export interface OrgSegment {
  org: string;
  suggestedCategory: Category;
  existingCategory: string; // from Excel, if any
  confidence: 'high' | 'medium' | 'low';
  count: number;
  totalAmount: number;
  donationIds: string[];
}

export function buildOrgSegments(donations: Donation[]): OrgSegment[] {
  const map = new Map<string, {
    donations: Donation[];
    totalAmount: number;
    existingCategories: string[];
  }>();

  for (const d of donations) {
    const key = (d.organization || '').trim() || 'Unknown';
    const entry = map.get(key);
    if (entry) {
      entry.donations.push(d);
      entry.totalAmount += d.amount;
      if (d.category) entry.existingCategories.push(d.category);
    } else {
      map.set(key, {
        donations: [d],
        totalAmount: d.amount,
        existingCategories: d.category ? [d.category] : [],
      });
    }
  }

  const segments: OrgSegment[] = [];

  for (const [org, { donations: orgDons, totalAmount, existingCategories }] of map) {
    // Most common existing category (if any)
    const existingCategory = existingCategories.length > 0
      ? mostCommon(existingCategories)
      : '';

    // Combine org name + all notes + existing category text for keyword matching
    const searchText = [org, ...orgDons.map(d => d.notes), existingCategory]
      .filter(Boolean)
      .join(' ');

    const { category, confidence } = guessCategory(searchText);

    segments.push({
      org,
      suggestedCategory: existingCategory
        ? (ALL_CATEGORIES.includes(existingCategory as Category)
          ? existingCategory as Category
          : category)
        : category,
      existingCategory,
      confidence: existingCategory ? 'high' : confidence,
      count: orgDons.length,
      totalAmount,
      donationIds: orgDons.map(d => d.id),
    });
  }

  return segments.sort((a, b) => b.totalAmount - a.totalAmount);
}

function mostCommon(arr: string[]): string {
  const freq = new Map<string, number>();
  for (const s of arr) freq.set(s, (freq.get(s) ?? 0) + 1);
  return [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/** Returns true when categorisation review is worthwhile */
export function needsCategoryReview(donations: Donation[]): boolean {
  if (!donations.length) return false;
  const uncategorized = donations.filter(d => !d.category?.trim()).length;
  return uncategorized / donations.length > 0.3; // >30% uncategorized
}

/** Apply org→category map to a donations array (returns new array) */
export function applyCategoryMap(
  donations: Donation[],
  orgMap: Map<string, Category>,
): Donation[] {
  return donations.map(d => {
    const org = (d.organization || '').trim() || 'Unknown';
    const override = orgMap.get(org);
    if (override && (!d.category?.trim() || override !== d.category)) {
      return { ...d, category: override };
    }
    return d;
  });
}
