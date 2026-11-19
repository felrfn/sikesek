import { describe, expect, it } from "vitest";
import { isSidebarCollapsed } from "./adminSidebarPreference";

describe("isSidebarCollapsed", () => {
  it("only treats an explicit 'collapsed' cookie as collapsed", () => {
    expect(isSidebarCollapsed("collapsed")).toBe(true);
    expect(isSidebarCollapsed("expanded")).toBe(false);
    expect(isSidebarCollapsed(undefined)).toBe(false);
    expect(isSidebarCollapsed("")).toBe(false);
    expect(isSidebarCollapsed("Collapsed")).toBe(false);
  });
});
