import { describe, expect, it, beforeEach } from "vitest";
import {
  hasProcessed,
  markProcessed,
  resetProcessedEventsForTests,
} from "./scanner";

describe("idempotent event processing", () => {
  beforeEach(() => {
    resetProcessedEventsForTests();
  });

  it("marks new events once", () => {
    expect(markProcessed("1874:0x1:0")).toBe(true);
    expect(markProcessed("1874:0x1:0")).toBe(false);
    expect(hasProcessed("1874:0x1:0")).toBe(true);
  });

  it("treats distinct log indexes as distinct events", () => {
    expect(markProcessed("1874:0x1:0")).toBe(true);
    expect(markProcessed("1874:0x1:1")).toBe(true);
  });
});
