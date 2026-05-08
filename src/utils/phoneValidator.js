/**
 * DRC Phone Number Validator
 * Supports: Orange, Airtel, Vodacom, Africell
 * Accepts formats: +243XXXXXXXXX, 0XXXXXXXXX, XXXXXXXXX (9 digits)
 */

const OPERATORS = {
  orange:   { prefixes: ['84', '85', '86', '89'], name: 'Orange' },
  airtel:   { prefixes: ['97', '99', '98', '72', '73', '74', '75', '76', '77', '78'], name: 'Airtel' },
  vodacom:  { prefixes: ['81', '82', '83', '80'], name: 'Vodacom' },
  africell: { prefixes: ['90', '91', '92', '93', '94', '95', '96'], name: 'Africell' },
};

/**
 * Normalize a phone number to 9-digit local format (no country code, no leading 0)
 */
export function normalizePhone(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/\s+/g, '').replace(/-/g, '');
  if (cleaned.startsWith('+243')) return cleaned.slice(4);
  if (cleaned.startsWith('243')) return cleaned.slice(3);
  if (cleaned.startsWith('0') && cleaned.length === 10) return cleaned.slice(1);
  return cleaned;
}

/**
 * Detect operator from phone number.
 * Returns { valid: boolean, operator: string|null, formatted: string }
 */
export function detectOperator(phone) {
  const local = normalizePhone(phone);

  if (local.length !== 9 || !/^\d{9}$/.test(local)) {
    return { valid: false, operator: null, formatted: phone };
  }

  const prefix2 = local.slice(0, 2);
  for (const [key, op] of Object.entries(OPERATORS)) {
    if (op.prefixes.includes(prefix2)) {
      return {
        valid: true,
        operator: op.name,
        key,
        formatted: `+243 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5)}`,
      };
    }
  }

  return { valid: false, operator: null, formatted: phone };
}

/**
 * Simple boolean validation
 */
export function isValidPhone(phone) {
  if (!phone || phone.trim() === '') return true; // empty = optional, pass
  return detectOperator(phone).valid;
}

/**
 * Get operator color for UI
 */
export function operatorColor(operatorName) {
  const colors = {
    Orange:   '#FF6B00',
    Airtel:   '#E60026',
    Vodacom:  '#E60000',
    Africell: '#005BAA',
  };
  return colors[operatorName] || '#64748B';
}
