/**
 * Phone masking utilities — NCSA Law compliance.
 * Never render raw phone numbers in HTML or send them to the LLM.
 */

/**
 * Mask a Rwandan phone number.
 * Input examples: +250788123456, 0788123456
 * Output: 078***456  or  +250 78***456
 */
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;

  const digits = phone.replace(/\D/g, "");

  // Normalise to 12-digit form starting with 250
  let normalised = digits;
  if (digits.startsWith("250") && digits.length === 12) {
    normalised = digits;
  } else if (digits.startsWith("0") && digits.length === 10) {
    normalised = "250" + digits.slice(1);
  } else if (digits.length === 9) {
    normalised = "250" + digits;
  } else {
    // Unknown format — mask aggressively
    return phone.slice(0, 3) + "***" + phone.slice(-3);
  }

  // +250 78X XXX XXX → show first 5 and last 3 of national part
  const national = normalised.slice(3); // 9 digits
  const maskedNational =
    national.slice(0, 2) + "***" + national.slice(-3);

  return `0${maskedNational}`;
}

/**
 * Build a tel: URI only after explicit user action.
 * The frontend must never auto-generate this from a masked value.
 */
export function buildTelLink(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, "");
  if (digits.startsWith("250") && digits.length === 12) {
    return `tel:+${digits}`;
  }
  if (digits.startsWith("0") && digits.length === 10) {
    return `tel:+250${digits.slice(1)}`;
  }
  return `tel:+${digits}`;
}
