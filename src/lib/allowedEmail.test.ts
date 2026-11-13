import { describe, expect, it } from "vitest";
import { isAllowedEmail } from "./allowedEmail";

describe("isAllowedEmail", () => {
  it("accepts the allowed address, ignoring case and surrounding spaces", () => {
    expect(isAllowedEmail(" Me@Example.com ", "me@example.com")).toBe(true);
  });

  it("refuses any other address", () => {
    expect(isAllowedEmail("someone@example.com", "me@example.com")).toBe(false);
  });

  it("refuses everyone when ALLOWED_EMAIL is missing or empty", () => {
    expect(isAllowedEmail("me@example.com", undefined)).toBe(false);
    expect(isAllowedEmail("", "")).toBe(false);
  });

  it("refuses a missing address", () => {
    expect(isAllowedEmail(undefined, "me@example.com")).toBe(false);
  });
});
