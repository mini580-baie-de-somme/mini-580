import { describe, expect, it } from "vitest";
import {
  applyDateDigitMask,
  applyDatetimeDigitMask,
  isoDateToDisplay,
  isoDatetimeToDisplay,
  parseDisplayDate,
  parseDisplayDatetime,
} from "@/lib/date-input-mask";

describe("date-input-mask", () => {
  it("applies DD.MM.YYYY digit mask while typing", () => {
    expect(applyDateDigitMask("3")).toBe("3");
    expect(applyDateDigitMask("31")).toBe("31");
    expect(applyDateDigitMask("310")).toBe("31.0");
    expect(applyDateDigitMask("3101")).toBe("31.01");
    expect(applyDateDigitMask("31012025")).toBe("31.01.2025");
    expect(applyDateDigitMask("3.1.0.1.2.0.2.5")).toBe("31.01.2025");
  });

  it("applies DD.MM.YYYY HH:MM digit mask while typing", () => {
    expect(applyDatetimeDigitMask("310120251430")).toBe("31.01.2025 14:30");
    expect(applyDatetimeDigitMask("3.1.0.1.2.0.2.5.1.4.3.0")).toBe(
      "31.01.2025 14:30"
    );
  });

  it("parses dotted and ISO dates", () => {
    expect(parseDisplayDate("31.01.2025")).toBe("2025-01-31");
    expect(parseDisplayDate("2025-01-31")).toBe("2025-01-31");
    expect(parseDisplayDate("31.02.2025")).toBeNull();
    expect(parseDisplayDate("31.01.20")).toBeNull();
  });

  it("parses dotted and datetime-local datetimes", () => {
    expect(parseDisplayDatetime("31.01.2025 14:30")).toBe("2025-01-31T14:30");
    expect(parseDisplayDatetime("2025-01-31T14:30")).toBe("2025-01-31T14:30");
    expect(parseDisplayDatetime("31.01.2025 25:00")).toBeNull();
  });

  it("formats ISO values for display", () => {
    expect(isoDateToDisplay("2025-01-31")).toBe("31.01.2025");
    expect(isoDatetimeToDisplay("2025-01-31T14:30")).toBe("31.01.2025 14:30");
  });
});
