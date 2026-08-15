/** Generic auth messages — never reveal whether an email exists (anti-enumeration). */

export const AUTH_INVALID_CREDENTIALS = "Identifiants invalides";

export const AUTH_OTP_REQUEST_ACK =
  "Si un compte associé existe, un code a été envoyé sur Telegram (valide 5 minutes).";

export const AUTH_OTP_VERIFY_FAILED = "Code invalide ou expiré";
