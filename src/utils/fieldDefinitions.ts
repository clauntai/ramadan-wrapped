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
    autoDetectHints: ['date', 'day', 'when', 'time', 'on', 'dt'],
  },
  {
    id: 'amount', label: 'Total Amount', group: 'transaction', role: 'insight', required: true,
    mappingKey: 'amount',
    autoDetectHints: ['amount', 'sum', 'total', 'donation', 'value', 'price', 'payment', 'paid'],
  },
  {
    id: 'paymentStatus', label: 'Payment Status', group: 'transaction', role: 'insight',
    mappingKey: 'paymentStatus',
    autoDetectHints: ['status', 'payment status', 'state', 'transaction status'],
  },
  {
    id: 'refundAmount', label: 'Refund Amount', group: 'transaction', role: 'insight',
    mappingKey: 'refundAmount',
    autoDetectHints: ['refund', 'refunded', 'chargeback'],
  },
  {
    id: 'recurringStatus', label: 'Recurring Status', group: 'transaction', role: 'insight',
    mappingKey: 'recurringStatus',
    autoDetectHints: ['recurring', 'recurrence', 'subscription', 'frequency'],
  },
  {
    id: 'fund', label: 'Fund', group: 'transaction', role: 'insight',
    mappingKey: 'fund',
    autoDetectHints: ['fund', 'campaign', 'cause', 'appeal', 'designation'],
  },
  {
    id: 'organization', label: 'Organisation', group: 'transaction', role: 'insight',
    mappingKey: 'organization',
    autoDetectHints: ['org', 'organization', 'charity', 'recipient', 'to', 'beneficiary'],
  },
  {
    id: 'category', label: 'Category / Cause', group: 'transaction', role: 'insight',
    mappingKey: 'category',
    autoDetectHints: ['category', 'type', 'cause', 'purpose', 'kind', 'group'],
  },
  {
    id: 'currency', label: 'Currency Column', group: 'transaction', role: 'insight',
    mappingKey: 'currency',
    autoDetectHints: ['currency', 'curr', 'ccy'],
  },
  {
    id: 'notes', label: 'Notes', group: 'transaction', role: 'insight',
    mappingKey: 'notes',
    autoDetectHints: ['note', 'notes', 'comment', 'description', 'detail', 'remark', 'memo'],
  },
  // ── Transaction Details — info fields ─────────────────
  {
    id: 'paymentMethod', label: 'Payment Method', group: 'transaction', role: 'info',
    mappingKey: 'custom',
    autoDetectHints: ['method', 'payment method', 'pay method'],
  },
  {
    id: 'payoutDate', label: 'Payout Date', group: 'transaction', role: 'info',
    mappingKey: 'custom',
    autoDetectHints: ['payout', 'payout date', 'disbursement'],
  },
  {
    id: 'extraDonation', label: 'Extra Donation', group: 'transaction', role: 'info',
    mappingKey: 'custom',
    autoDetectHints: ['extra', 'tip', 'additional', 'add-on'],
  },
  {
    id: 'discount', label: 'Discount', group: 'transaction', role: 'info',
    mappingKey: 'custom',
    autoDetectHints: ['discount', 'promo', 'coupon'],
  },
  // ── Buyer Information ──────────────────────────────────
  {
    id: 'firstName', label: 'First Name', group: 'buyer', role: 'info',
    mappingKey: 'custom',
    autoDetectHints: ['first name', 'first', 'fname', 'given name'],
  },
  {
    id: 'lastName', label: 'Last Name', group: 'buyer', role: 'info',
    mappingKey: 'custom',
    autoDetectHints: ['last name', 'last', 'lname', 'surname', 'family name'],
  },
  {
    id: 'email', label: 'Email', group: 'buyer', role: 'info',
    mappingKey: 'custom',
    autoDetectHints: ['email', 'e-mail', 'email address'],
  },
  {
    id: 'companyName', label: 'Company Name', group: 'buyer', role: 'info',
    mappingKey: 'custom',
    autoDetectHints: ['company', 'employer', 'business'],
  },
  {
    id: 'address', label: 'Address', group: 'buyer', role: 'info',
    mappingKey: 'custom',
    autoDetectHints: ['address', 'street', 'addr'],
  },
  {
    id: 'city', label: 'City', group: 'buyer', role: 'info',
    mappingKey: 'custom',
    autoDetectHints: ['city', 'town', 'municipality'],
  },
  {
    id: 'postalCode', label: 'Postal Code', group: 'buyer', role: 'info',
    mappingKey: 'custom',
    autoDetectHints: ['postal', 'zip', 'postcode', 'postal code'],
  },
  {
    id: 'state', label: 'State', group: 'buyer', role: 'info',
    mappingKey: 'custom',
    autoDetectHints: ['state', 'province', 'region'],
  },
  {
    id: 'country', label: 'Country', group: 'buyer', role: 'info',
    mappingKey: 'custom',
    autoDetectHints: ['country', 'nation'],
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
    autoDetectHints: ['tax receipt', 'receipt', 'receipt number', 'tax no'],
  },
];
