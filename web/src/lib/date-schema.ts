import { z } from "zod";
import { coerceDateTimeInput } from "@/lib/utils";

/**
 * Zod field for optional/nullable datetimes from the editor or agents.
 * Accepts ISO-Z, offset, datetime-local, "" → null; omitted → undefined.
 * Outputs ISO-Z string or null (never a bare datetime-local).
 */
export const optionalNullableDateTime = z.preprocess(
  (value) => {
    if (value === undefined) return undefined;
    return coerceDateTimeInput(value);
  },
  z.union([z.string().datetime(), z.null()]).optional()
);

/** Required date/datetime (milestones, etc.). */
export const requiredDateTime = z.preprocess((value) => {
  const coerced = coerceDateTimeInput(value);
  if (coerced === undefined || coerced === null) return value;
  return coerced;
}, z.string().datetime());
