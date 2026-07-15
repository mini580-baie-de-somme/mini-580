export const HULLS = ["HULL_268", "HULL_269", "HULL_270"] as const;
export type HullValue = (typeof HULLS)[number];

export const HULL_LABELS: Record<HullValue, string> = {
  HULL_268: "#268",
  HULL_269: "#269",
  HULL_270: "#270",
};

export const SESSION_COOKIE = "mini580_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export const CLASS_GLOBE_LINKS = {
  website: "https://classglobe580.com/",
  plans: "https://classglobe580.com/buy-plans/",
  builders: "https://classglobe580.com/builders-blogs/",
  transat: "https://classglobe580.com/globe-580-transat/",
};
