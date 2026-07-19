/** Shared media storage integrity codes (client + server). */
export type MediaIntegrityIssue =
  | "REMOTE_ORIGIN"
  | "ORIGIN_NOT_LOCAL"
  | "ORIGIN_MISSING"
  | "VARIANT_NOT_LOCAL"
  | "VARIANT_MISSING";

export type MediaIntegrity = {
  /** All required files exist under local /media storage. */
  ok: boolean;
  /** IMAGE layout editor may open (local origin file present). */
  editable: boolean;
  issues: MediaIntegrityIssue[];
  /** Human-readable detail per issue (locale chosen by caller). */
  messages: string[];
};

export type MediaIntegrityInput = {
  kind: string;
  urlOrigin: string;
  urlPicto?: string | null;
  urlPetite?: string | null;
  urlMoyenne?: string | null;
  urlGrande?: string | null;
};
