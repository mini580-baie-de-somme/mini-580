/** Sentinel password hash for OTP-only accounts (no password login until set). */
export const OTP_ONLY_PASSWORD_HASH = "!";

export function isOtpOnlyPasswordHash(hash: string): boolean {
  return hash === OTP_ONLY_PASSWORD_HASH;
}
