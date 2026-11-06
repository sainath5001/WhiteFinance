import { describe, expect, it } from "vitest";
import { eventId, eventIdFromLog } from "./event-id";
import type { Log } from "viem";

describe("event identity", () => {
  it("builds stable ids from chainId:tx:logIndex", () => {
    const id = eventId({
      chainId: 1874,
      transactionHash: "0xABC",
      logIndex: 3,
    });
    expect(id).toBe("1874:0xabc:3");
  });

  it("derives id from log", () => {
    const log = {
      transactionHash: "0xDeadBeef",
      logIndex: 7,
    } as Log;
    expect(eventIdFromLog(1874, log)).toBe("1874:0xdeadbeef:7");
  });
});
