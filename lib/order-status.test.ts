import { describe, expect, it } from "vitest";
import { OrderStatus } from "@prisma/client";
import {
  ACTIVE_ORDER_STATUSES,
  ORDER_STATUSES,
  RESOLVED_ORDER_STATUSES,
  getOrderStatusLabel,
  getPaymentTypeLabel,
  orderStatusBadgeClasses,
} from "@/lib/order-status";

describe("the statuses the admin list knows about", () => {
  it("is exactly the schema's enum, so a status added there cannot go unrendered", () => {
    expect([...ORDER_STATUSES].sort()).toEqual(Object.values(OrderStatus).sort());
  });

  it("splits into Active and Resolved with nothing in both", () => {
    const overlap = ACTIVE_ORDER_STATUSES.filter((status) =>
      RESOLVED_ORDER_STATUSES.includes(status),
    );

    expect(overlap).toEqual([]);
  });

  it("splits with nothing in neither, so no order can hide between the two tabs", () => {
    const covered = [...ACTIVE_ORDER_STATUSES, ...RESOLVED_ORDER_STATUSES].sort();

    expect(covered).toEqual([...ORDER_STATUSES].sort());
  });

  it("calls the three outstanding ones Active", () => {
    expect(ACTIVE_ORDER_STATUSES).toEqual(["placed", "packed", "shipped"]);
  });

  it("calls the four finished ones Resolved", () => {
    expect(RESOLVED_ORDER_STATUSES).toEqual(["delivered", "rto", "returned", "cancelled"]);
  });
});

describe("how a status reads", () => {
  it("labels every status", () => {
    for (const status of ORDER_STATUSES) {
      expect(getOrderStatusLabel(status).length).toBeGreaterThan(0);
    }
  });

  it("keeps RTO as the abbreviation the courier industry uses", () => {
    expect(getOrderStatusLabel("rto")).toBe("RTO");
  });

  it("labels every payment type, including the two no checkout can produce yet", () => {
    expect(getPaymentTypeLabel("prepaid")).toBe("Prepaid");
    expect(getPaymentTypeLabel("cod")).toBe("COD");
    expect(getPaymentTypeLabel("partial_cod")).toBe("Partial COD");
  });
});

describe("the status badges", () => {
  it("gives every status its own colour, not a shared one", () => {
    const hues = ORDER_STATUSES.map((status) =>
      orderStatusBadgeClasses(status)
        .split(" ")
        .filter((className) => className.startsWith("text-status-")),
    );

    expect(new Set(hues.flat()).size).toBe(ORDER_STATUSES.length);
  });

  it("paints text, border and wash from that one hue", () => {
    const classes = orderStatusBadgeClasses("shipped");

    expect(classes).toContain("text-status-shipped");
    expect(classes).toContain("border-status-shipped/35");
    expect(classes).toContain("bg-status-shipped/10");
  });

  it("shares one shape across all seven, so the hue is the only variable", () => {
    const shapes = ORDER_STATUSES.map((status) =>
      orderStatusBadgeClasses(status)
        .split(" ")
        .filter((className) => !className.includes("status-"))
        .join(" "),
    );

    expect(new Set(shapes).size).toBe(1);
  });
});
