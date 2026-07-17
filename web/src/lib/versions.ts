import versions from "../../versions.json";

/** Frontend build version (baked at build time). */
export const FE_VERSION: string = versions.fe;

/** Backend build version (source of truth for GET /api/version). */
export const BE_VERSION: string = versions.be;
