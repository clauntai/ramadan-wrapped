import type { ColumnMapping } from '../types';

export type FieldGroup = 'transaction' | 'buyer' | 'tax';
export type FieldRole = 'insight' | 'info';

export interface FieldDefinition {
  id: string;
  label: string;
  group: FieldGroup;
  role: FieldRole;
  required?: boolean;
  mappingKey: keyof ColumnMapping | 'custom';
  autoDetectHints: string[];
}

export const FIELD_DEFINITIONS: FieldDefinition[] = [
  // ── Transaction Details — insight fields ───────────────
  {
    id: 'date', label: 'Payment Date', group: 'transaction', role: 'insight',
    mappingKey: 'date',
    autoDetectHints: [
      'date', 'payment date', 'transaction date', 'donation date', 'gift date',
      'created', 'created at', 'created_at', 'charged on', 'paid on',
      'received date', 'processed date', 'order date', 'charge date',
      'timestamp', 'datetime', 'dt', 'when', 'تاريخ',
    ],
  },
  {
    id: 'amount', label: 'Total Amount', group: 'transaction', role: 'insight', required: true,
    mappingKey: 'amount',
    autoDetectHints: [
      'amount', 'donation amount', 'gift amount', 'total amount', 'gross amount',
      'net amount', 'charge amount', 'payment amount', 'contribution amount',
      'total', 'sum', 'value', 'gross', 'net', 'price',
      'payment', 'paid', 'charged', 'contribution',
      'مبلغ', 'دونيشن',
    ],
  },
  {
    id: 'paymentStatus', label: 'Payment Status', group: 'transaction', role: 'insight',
    mappingKey: 'paymentStatus',
    autoDetectHints: [
      'payment status', 'transaction status', 'order status', 'donation status',
      'charge status', 'gift status', 'status',
    ],
  },
  {
    id: 'refundAmount', label: 'Refund Amount', group: 'transaction', role: 'insight',
    mappingKey: 'refundAmount',
    autoDetectHints: [
      'refund', 'refunded', 'refund amount', 'chargeback', 'reversal', 'reversed',
    ],
  },
  {
    id: 'recurringStatus', label: 'Recurring Status', group: 'transaction', role: 'insight',
    mappingKey: 'recurringStatus',
    autoDetectHints: [
      'recurring', 'recurrence', 'subscription', 'frequency', 'recurring type',
      'donation type', 'type of donation', 'pledge', 'installment',
      'recurring gift', 'is recurring', 'recur', 'repeat',
    ],
  },
  {
    id: 'organization', label: 'Organisation', group: 'transaction', role: 'insight',
    mappingKey: 'organization',
    autoDetectHints: [
      'organization', 'organisation', 'org', 'org name', 'charity', 'charity name',
      'recipient', 'beneficiary', 'nonprofit', 'entity',
      'company', 'company name', 'employer', 'business', 'جهة',
    ],
  },
  {
    id: 'category', label: 'Category / Cause', group: 'transaction', role: 'insight',
    mappingKey: 'category',
    autoDetectHints: [
      'category', 'category name', 'cause', 'cause name', 'cause title',
      'campaign', 'campaign name', 'campaign title',
      'sector', 'classification', 'theme', 'purpose', 'department', 'نوع',
    ],
  },
  {
    id: 'notes', label: 'Notes', group: 'transaction', role: 'insight',
    mappingKey: 'notes',
    autoDetectHints: [
      'note', 'notes', 'comment', 'comments', 'description', 'details', 'detail',
      'remark', 'remarks', 'memo', 'message', 'donor message', 'donor note',
      'tribute', 'in honor of', 'in memory of', 'desc', 'ملاحظة',
    ],
  },
  // ── Transaction Details — info fields ─────────────────
  {
    id: 'paymentMethod', label: 'Payment Method', group: 'transaction', role: 'info',
    mappingKey: 'custom',
    autoDetectHints: ['payment method', 'pay method', 'method of payment', 'tender', 'payment type'],
  },
  {
    id: 'payoutDate', label: 'Payout Date', group: 'transaction', role: 'info',
    mappingKey: 'custom',
    autoDetectHints: ['payout date', 'payout', 'disbursement date', 'settlement date'],
  },
  {
    id: 'extraDonation', label: 'Extra Donation', group: 'transaction', role: 'info',
    mappingKey: 'custom',
    autoDetectHints: ['extra donation', 'tip', 'additional donation', 'add-on'],
  },
  {
    id: 'discount', label: 'Discount', group: 'transaction', role: 'info',
    mappingKey: 'custom',
    autoDetectHints: ['discount', 'promo', 'coupon', 'promo code'],
  },
  // ── Buyer Information ──────────────────────────────────
  {
    id: 'firstName', label: 'First Name', group: 'buyer', role: 'info',
    mappingKey: 'custom',
    autoDetectHints: ['first name', 'firstname', 'fname', 'given name', 'donor first name'],
  },
  {
    id: 'lastName', label: 'Last Name', group: 'buyer', role: 'info',
    mappingKey: 'custom',
    autoDetectHints: ['last name', 'lastname', 'lname', 'surname', 'family name', 'donor last name'],
  },
  {
    id: 'email', label: 'Email', group: 'buyer', role: 'info',
    mappingKey: 'custom',
    autoDetectHints: ['email', 'e-mail', 'email address', 'donor email'],
  },
  {
    id: 'address', label: 'Address', group: 'buyer', role: 'info',
    mappingKey: 'custom',
    autoDetectHints: ['address', 'street address', 'billing address', 'addr'],
  },
  {
    id: 'city', label: 'City', group: 'buyer', role: 'info',
    mappingKey: 'custom',
    autoDetectHints: ['city', 'town', 'municipality', 'billing city'],
  },
  {
    id: 'postalCode', label: 'Postal Code', group: 'buyer', role: 'info',
    mappingKey: 'custom',
    autoDetectHints: ['postal code', 'postcode', 'zip code', 'zip', 'postal'],
  },
  {
    id: 'state', label: 'State', group: 'buyer', role: 'info',
    mappingKey: 'custom',
    autoDetectHints: ['state', 'province', 'region', 'billing state'],
  },
  {
    id: 'country', label: 'Country', group: 'buyer', role: 'info',
    mappingKey: 'custom',
    autoDetectHints: ['country', 'nation', 'billing country'],
  },
  {
    id: 'language', label: 'Language', group: 'buyer', role: 'info',
    mappingKey: 'custom',
    autoDetectHints: ['language', 'lang', 'locale'],
  },
  // ── Tax Receipt ────────────────────────────────────────
  {
    id: 'taxReceipt', label: 'Tax Receipt #', group: 'tax', role: 'info',
    mappingKey: 'custom',
    autoDetectHints: ['tax receipt', 'receipt number', 'receipt #', 'receipt no', 'receipt'],
  },
];
