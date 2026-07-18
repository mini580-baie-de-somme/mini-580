import { describe, expect, it } from "vitest";
import { z } from "zod";
import { optionalNullableDateTime, requiredDateTime } from "@/lib/date-schema";
import { coerceDateTimeInput, fromDatetimeLocalValue } from "@/lib/utils";

describe("datetime coercion for editor/API", () => {
  it("coerces datetime-local, ISO-Z and offset to ISO-Z", () => {
    expect(coerceDateTimeInput("2026-07-18T14:30")).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(coerceDateTimeInput("2026-07-18T14:30:00.000Z")).toBe(
      "2026-07-18T14:30:00.000Z"
    );
    expect(coerceDateTimeInput("2026-07-18T14:30:00+02:00")).toBe(
      "2026-07-18T12:30:00.000Z"
    );
    expect(coerceDateTimeInput("")).toBeNull();
    expect(coerceDateTimeInput(null)).toBeNull();
    expect(coerceDateTimeInput(undefined)).toBeUndefined();
  });

  it("fromDatetimeLocalValue matches editor → API path", () => {
    const iso = fromDatetimeLocalValue("2025-06-15T10:30");
    expect(iso).toBeTruthy();
    expect(iso!.endsWith("Z")).toBe(true);
  });

  it("optionalNullableDateTime accepts editor formats", () => {
    const schema = z.object({ publishedAt: optionalNullableDateTime });
    expect(schema.parse({ publishedAt: "2025-06-15T10:30" }).publishedAt).toMatch(
      /Z$/
    );
    expect(schema.parse({ publishedAt: null }).publishedAt).toBeNull();
    expect(schema.parse({}).publishedAt).toBeUndefined();
  });

  it("requiredDateTime accepts date-only for milestones", () => {
    const iso = requiredDateTime.parse("2026-07-18");
    expect(iso).toMatch(/Z$/);
  });
});
