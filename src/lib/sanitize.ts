/**
 * Input sanitization and validation utilities for public-facing API routes.
 * Strips dangerous characters, enforces length limits, and validates common field types.
 */

// ── String sanitization ───────────────────────────────────────────────────────

/**
 * Strip HTML tags, null bytes, and control characters from a string.
 * Trims whitespace and enforces a maximum length.
 */
export function sanitizeString(value: unknown, maxLength = 500): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // control chars (keep \t \n \r)
    .replace(/<[^>]*>/g, '')                             // strip HTML tags
    .replace(/javascript:/gi, '')                        // strip JS protocol
    .replace(/on\w+\s*=/gi, '')                          // strip inline event handlers
    .trim()
    .slice(0, maxLength);
}

/**
 * Sanitize a plain-text message body (allows newlines, strips HTML).
 */
export function sanitizeMessage(value: unknown, maxLength = 2000): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim()
    .slice(0, maxLength);
}

// ── Email validation ──────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

export function isValidEmail(email: unknown): boolean {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim();
  return trimmed.length >= 5 && trimmed.length <= 254 && EMAIL_REGEX.test(trimmed);
}

export function sanitizeEmail(email: unknown): string {
  if (typeof email !== 'string') return '';
  return email.toLowerCase().trim().slice(0, 254);
}

// ── Phone validation ──────────────────────────────────────────────────────────

export function isValidPhone(phone: unknown): boolean {
  if (typeof phone !== 'string') return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

export function sanitizePhone(phone: unknown): string {
  if (typeof phone !== 'string') return '';
  // Keep only digits, spaces, dashes, parens, plus
  return phone.replace(/[^\d\s\-().+]/g, '').trim().slice(0, 20);
}

// ── Allowlist validation ──────────────────────────────────────────────────────

/**
 * Validate that a value is one of the allowed options.
 */
export function isAllowedValue(value: unknown, allowed: string[]): boolean {
  return typeof value === 'string' && allowed.includes(value);
}

// ── Contact form validation ───────────────────────────────────────────────────

export interface ContactFormFields {
  name: string;
  firm: string;
  email: string;
  service: string;
  message: string;
  retainerTier?: string;
  phone?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  sanitized: ContactFormFields & Record<string, string | undefined>;
}

const ALLOWED_SERVICES = [
  'Legal Research',
  'Document Drafting',
  'Case Management',
  'Trial Preparation',
  'Contract Review',
  'Paralegal Services',
  'Retainer',
  'Other',
];

const ALLOWED_RETAINER_TIERS = ['starter', 'professional', 'enterprise', 'project', ''];

export function validateContactForm(body: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];

  const name = sanitizeString(body.name, 100);
  const firm = sanitizeString(body.firm, 150);
  const email = sanitizeEmail(body.email);
  const service = sanitizeString(body.service, 100);
  const message = sanitizeMessage(body.message, 2000);
  const retainerTier = sanitizeString(body.retainerTier, 50);
  const phone = body.phone ? sanitizePhone(body.phone) : undefined;

  if (!name || name.length < 2) errors.push('Name must be at least 2 characters.');
  if (!firm || firm.length < 1) errors.push('Firm or company name is required.');
  if (!isValidEmail(email)) errors.push('A valid email address is required.');
  if (!service || service.length < 2) errors.push('Please select a service.');
  if (!message || message.length < 10) errors.push('Message must be at least 10 characters.');
  if (retainerTier && !ALLOWED_RETAINER_TIERS.includes(retainerTier)) {
    errors.push('Invalid retainer tier selection.');
  }
  if (phone && !isValidPhone(phone)) {
    errors.push('Phone number format is invalid.');
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized: { name, firm, email, service, message, retainerTier, phone },
  };
}

// ── Consultation booking validation ──────────────────────────────────────────

export interface BookingFormFields {
  clientName: string;
  clientEmail: string;
  bookingDate: string;
  bookingTime: string;
  durationMinutes: number;
  notes?: string;
  clientPhone?: string;
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^\d{2}:\d{2}$/;
const ALLOWED_DURATIONS = [15, 30, 60];

export function validateBookingForm(body: Record<string, unknown>): {
  valid: boolean;
  errors: string[];
  sanitized: BookingFormFields;
} {
  const errors: string[] = [];

  const clientName = sanitizeString(body.clientName, 100);
  const clientEmail = sanitizeEmail(body.clientEmail);
  const bookingDate = sanitizeString(body.bookingDate, 10);
  const bookingTime = sanitizeString(body.bookingTime, 5);
  const durationMinutes = Number(body.durationMinutes);
  const notes = body.notes ? sanitizeMessage(body.notes, 1000) : undefined;
  const clientPhone = body.clientPhone ? sanitizePhone(body.clientPhone) : undefined;

  if (!clientName || clientName.length < 2) errors.push('Client name is required.');
  if (!isValidEmail(clientEmail)) errors.push('A valid email address is required.');
  if (!DATE_REGEX.test(bookingDate)) errors.push('Invalid booking date format.');
  if (!TIME_REGEX.test(bookingTime)) errors.push('Invalid booking time format.');
  if (!ALLOWED_DURATIONS.includes(durationMinutes)) errors.push('Invalid session duration.');
  if (clientPhone && !isValidPhone(clientPhone)) errors.push('Phone number format is invalid.');

  // Validate date is not in the past
  if (DATE_REGEX.test(bookingDate)) {
    const [y, m, d] = bookingDate.split('-').map(Number);
    const bookDate = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (bookDate < today) errors.push('Booking date cannot be in the past.');
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized: { clientName, clientEmail, bookingDate, bookingTime, durationMinutes, notes, clientPhone },
  };
}

// ── Email opt-in validation ───────────────────────────────────────────────────

export function validateEmailOptIn(body: Record<string, unknown>): {
  valid: boolean;
  error?: string;
  email: string;
} {
  const email = sanitizeEmail(body.email);
  if (!isValidEmail(email)) {
    return { valid: false, error: 'A valid email address is required.', email: '' };
  }
  return { valid: true, email };
}
