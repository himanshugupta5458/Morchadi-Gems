import { describe, expect, it } from "vitest";
import type { OrderStatus } from "@prisma/client";
import { ORDER_STATUSES } from "@/lib/order-status";
import {
  ADDRESS_EDITABLE_STATUSES,
  acceptsCodCollection,
  acceptsItemReceivedBack,
  isShippingAddressEditable,
  isTerminalOrderStatus,
  isValidOrderTransition,
  nextOrderStatuses,
  ORDER_STATUS_TRANSITIONS,
  requiresChangeReason,
  requiresRefundDecision,
} from "@/lib/order-transitions";

const OUTCOME_STATUSES: readonly OrderStatus[] = ["delivered", "rto", "returned", "cancelled"];

const DEAD_END_STATUSES: readonly OrderStatus[] = ["rto", "returned", "cancelled"];

describe("the order lifecycle", () => {
  it("names every status and invents none", () => {
    expect(Object.keys(ORDER_STATUS_TRANSITIONS).sort()).toEqual([...ORDER_STATUSES].sort());

    for (const status of ORDER_STATUSES) {
      for (const destination of nextOrderStatuses(status)) {
        expect(ORDER_STATUSES).toContain(destination);
      }
    }
  });

  it("never offers a status the move it is already at", () => {
    for (const status of ORDER_STATUSES) {
      expect(nextOrderStatuses(status)).not.toContain(status);
    }
  });

  it("moves a parcel forward one step at a time", () => {
    expect(nextOrderStatuses("placed")).toContain("packed");
    expect(nextOrderStatuses("packed")).toContain("shipped");
    expect(nextOrderStatuses("shipped")).toContain("delivered");

    expect(isValidOrderTransition("placed", "shipped")).toBe(false);
    expect(isValidOrderTransition("placed", "delivered")).toBe(false);
    expect(isValidOrderTransition("packed", "delivered")).toBe(false);
  });

  /**
   * The owner said cancellation can happen "at any stage after placed" and did not exclude
   * `shipped`. Reading that as "before dispatch only" would have been the code narrowing a
   * business rule, so `shipped` is here on purpose and this test is what stops it being quietly
   * removed as an oversight later.
   */
  it("allows cancellation from placed, packed and shipped alike", () => {
    expect(isValidOrderTransition("placed", "cancelled")).toBe(true);
    expect(isValidOrderTransition("packed", "cancelled")).toBe(true);
    expect(isValidOrderTransition("shipped", "cancelled")).toBe(true);
  });

  it("does not let an order that has already ended be cancelled", () => {
    for (const status of OUTCOME_STATUSES) {
      expect(isValidOrderTransition(status, "cancelled")).toBe(false);
    }
  });

  /** A parcel refused at the door never arrived: that is an RTO, and only a delivery returns. */
  it("reaches returned only from delivered, and rto only from shipped", () => {
    for (const status of ORDER_STATUSES) {
      expect(isValidOrderTransition(status, "returned")).toBe(status === "delivered");
      expect(isValidOrderTransition(status, "rto")).toBe(status === "shipped");
    }
  });

  it("treats the three bad endings as final and delivered as not quite", () => {
    for (const status of DEAD_END_STATUSES) {
      expect(nextOrderStatuses(status)).toEqual([]);
      expect(isTerminalOrderStatus(status)).toBe(true);
    }

    expect(nextOrderStatuses("delivered")).toEqual(["returned"]);
    expect(isTerminalOrderStatus("delivered")).toBe(false);

    for (const status of ["placed", "packed", "shipped"] as const) {
      expect(isTerminalOrderStatus(status)).toBe(false);
    }
  });

  it("never returns an order to placed", () => {
    for (const status of ORDER_STATUSES) {
      expect(isValidOrderTransition(status, "placed")).toBe(false);
    }
  });

  /** Every status an order can be in has to be reachable from the one every order starts in. */
  it("can reach all seven statuses from placed", () => {
    const reached = new Set<OrderStatus>(["placed"]);
    const queue: OrderStatus[] = ["placed"];

    while (queue.length > 0) {
      const current = queue.shift() as OrderStatus;
      for (const destination of nextOrderStatuses(current)) {
        if (reached.has(destination)) continue;
        reached.add(destination);
        queue.push(destination);
      }
    }

    expect(Array.from(reached).sort()).toEqual([...ORDER_STATUSES].sort());
  });
});

describe("what a status change has to say for itself", () => {
  it("demands a reason for exactly the three unhappy outcomes", () => {
    for (const status of ORDER_STATUSES) {
      const isUnhappy = status === "rto" || status === "returned" || status === "cancelled";
      expect(requiresChangeReason(status)).toBe(isUnhappy);
      expect(requiresRefundDecision(status)).toBe(isUnhappy);
    }
  });

  it("asks the reason and the refund question of the same statuses", () => {
    for (const status of ORDER_STATUSES) {
      expect(requiresChangeReason(status)).toBe(requiresRefundDecision(status));
    }
  });
});

describe("the windows the panel opens and closes", () => {
  it("allows an address edit before dispatch and never after", () => {
    expect(ADDRESS_EDITABLE_STATUSES).toEqual(["placed", "packed"]);

    for (const status of ORDER_STATUSES) {
      const isBeforeDispatch = status === "placed" || status === "packed";
      expect(isShippingAddressEditable(status)).toBe(isBeforeDispatch);
    }
  });

  it("offers item-received-back only once something is coming back", () => {
    for (const status of ORDER_STATUSES) {
      expect(acceptsItemReceivedBack(status)).toBe(status === "rto" || status === "returned");
    }
  });

  it("offers COD collection only where there is cash to collect", () => {
    expect(acceptsCodCollection("cod")).toBe(true);
    expect(acceptsCodCollection("partial_cod")).toBe(true);
    expect(acceptsCodCollection("prepaid")).toBe(false);
  });
});
