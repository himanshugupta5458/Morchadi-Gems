/** @vitest-environment jsdom */

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { OrderStatus } from "@prisma/client";
import { ORDER_STATUSES, getOrderStatusLabel, orderStatusBadgeClasses } from "@/lib/order-status";
import { collapseRepeatedStatuses, type PublicOrderStatusEvent } from "@/lib/order-tracking";
import {
  formatTrackingDate,
  formatTrackingDateTime,
  getCustomerOrderStatusLabel,
} from "@/lib/order-tracking-copy";
import { OrderTrackingTimeline } from "@/components/OrderTrackingTimeline";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";

afterEach(cleanup);

function event(status: OrderStatus, iso: string): PublicOrderStatusEvent {
  return { status, changedAt: new Date(iso) };
}

const PLACED = event("placed", "2026-05-01T06:00:00Z");
const PLACED_AGAIN = event("placed", "2026-05-01T09:00:00Z");
const PACKED = event("packed", "2026-05-01T11:30:00Z");
const SHIPPED = event("shipped", "2026-05-03T06:00:00Z");

/**
 * The behaviours the vertical timeline had, asserted against the horizontal one. A redesign
 * that quietly dropped one of these would look finished and be wrong.
 */
describe("what the redesign had to keep", () => {
  it("still collapses a run of the same status to the first of it", () => {
    expect(collapseRepeatedStatuses([PLACED, PLACED_AGAIN, PACKED, SHIPPED])).toEqual([
      PLACED,
      PACKED,
      SHIPPED,
    ]);
  });

  it("keeps the date the status was actually reached, not the address edit's", () => {
    const [first] = collapseRepeatedStatuses([PLACED, PLACED_AGAIN]);

    expect(first.changedAt.toISOString()).toBe("2026-05-01T06:00:00.000Z");
  });

  it("renders one step per collapsed event and no step for the swallowed row", () => {
    const history = collapseRepeatedStatuses([PLACED, PLACED_AGAIN, PACKED, SHIPPED]);
    const { container } = render(
      <OrderTrackingTimeline history={history} currentStatus="shipped" />,
    );

    expect(container.querySelectorAll("li")).toHaveLength(3);
    expect(container.textContent).toContain(getCustomerOrderStatusLabel("placed"));
    expect(container.textContent).toContain(getCustomerOrderStatusLabel("packed"));
  });

  /**
   * `changedBy` and `reason` are not merely unrendered — they are not in
   * `PublicOrderStatusEvent`, so the component has nothing to render them from. This checks the
   * type's shape as well as the markup, because a component can only leak what it was handed.
   */
  it("has no operator and no reason to render", () => {
    const history = [PLACED, PACKED];
    const { container } = render(
      <OrderTrackingTimeline history={history} currentStatus="packed" />,
    );

    for (const step of history) {
      expect(Object.keys(step).sort()).toEqual(["changedAt", "status"]);
    }
    expect(container.textContent).not.toMatch(/reason/i);
    expect(container.textContent).not.toMatch(/changed by/i);
  });

  it("keeps the empty-history fallback for the case that cannot happen yet", () => {
    const { container } = render(
      <OrderTrackingTimeline history={[]} currentStatus="placed" />,
    );

    expect(container.textContent).toContain("We have no dated history for this order");
    expect(container.querySelectorAll("li")).toHaveLength(0);
  });

  it("marks the last step as the current state when it matches the order's status", () => {
    const { container } = render(
      <OrderTrackingTimeline history={[PLACED, PACKED]} currentStatus="packed" />,
    );

    expect(container.textContent).toContain("Where it is now");
  });

  it("marks nothing as current when the last step is not the order's status", () => {
    const { container } = render(
      <OrderTrackingTimeline history={[PLACED, PACKED]} currentStatus="shipped" />,
    );

    expect(container.textContent).not.toContain("Where it is now");
  });
});

describe("the timestamps", () => {
  it("shows the clock time beside the date", () => {
    expect(formatTrackingDateTime(new Date("2026-05-01T06:00:00Z"))).toBe(
      "1 May 2026, 11:30 am",
    );
  });

  /**
   * The whole reason for the change. Two events on one day used to render as two identical
   * strings, which read as a timeline that had not moved.
   */
  it("tells two events on the same day apart", () => {
    const morning = formatTrackingDateTime(new Date("2026-05-01T06:00:00Z"));
    const evening = formatTrackingDateTime(new Date("2026-05-01T13:45:00Z"));

    expect(morning).not.toBe(evening);
    expect(formatTrackingDate(new Date("2026-05-01T06:00:00Z"))).toBe(
      formatTrackingDate(new Date("2026-05-01T13:45:00Z")),
    );
  });

  it("is still Indian time on a server that runs in UTC", () => {
    expect(formatTrackingDateTime(new Date("2026-05-01T19:00:00Z"))).toBe(
      "2 May 2026, 12:30 am",
    );
  });

  /**
   * `formatTrackingDate` stays day-only and stays in use: the confirmation email's "Placed on"
   * line reads it, and nothing about that line needed a clock time.
   */
  it("leaves the day-only format alone for the email and the refund sentence", () => {
    expect(formatTrackingDate(new Date("2026-05-01T06:00:00Z"))).toBe("1 May 2026");
  });

  it("puts a time under every step of the rendered timeline", () => {
    const { container } = render(
      <OrderTrackingTimeline history={[PLACED, PACKED]} currentStatus="packed" />,
    );

    expect(container.textContent).toContain("1 May 2026, 11:30 am");
    expect(container.textContent).toContain("1 May 2026, 5:00 pm");
  });
});

describe("the non-linear outcomes", () => {
  const NON_LINEAR: readonly OrderStatus[] = ["cancelled", "rto", "returned"];

  /**
   * The admin order detail page has no special treatment for these three: it badges every
   * status with `orderStatusBadgeClasses`, one hue each, label always written. The customer
   * timeline mirrors that by calling the same function — so this asserts the two produce
   * byte-identical class strings rather than that they merely look similar.
   */
  it("uses the admin panel's own class string for every status", () => {
    for (const status of ORDER_STATUSES) {
      const admin = render(<OrderStatusBadge status={status} />);
      const adminClasses = admin.container.firstElementChild?.getAttribute("class");
      cleanup();

      const customer = render(
        <OrderTrackingTimeline history={[event(status, "2026-05-01T06:00:00Z")]} currentStatus={status} />,
      );
      const chip = Array.from(customer.container.querySelectorAll("span")).find(
        (element) => element.textContent === getCustomerOrderStatusLabel(status),
      );

      expect(chip, `no ${status} chip rendered`).toBeDefined();
      expect(chip?.getAttribute("class")).toBe(orderStatusBadgeClasses(status));
      expect(adminClasses).toBe(orderStatusBadgeClasses(status));
      cleanup();
    }
  });

  it("gives each of the three its own hue rather than one shared unhappy colour", () => {
    const hues = new Set(NON_LINEAR.map((status) => orderStatusBadgeClasses(status)));

    expect(hues.size).toBe(NON_LINEAR.length);
  });

  /**
   * Same treatment, different vocabulary. The operator reads "RTO"; the customer reads what it
   * means. Colour is shared because it is the part that says these outcomes differ; wording is
   * not, because "RTO" tells a customer nothing.
   */
  it("keeps the customer's words rather than the operator's", () => {
    const { container } = render(
      <OrderTrackingTimeline
        history={[PLACED, event("rto", "2026-05-05T06:00:00Z")]}
        currentStatus="rto"
      />,
    );

    expect(container.textContent).toContain(getCustomerOrderStatusLabel("rto"));
    expect(container.textContent).not.toContain(getOrderStatusLabel("rto"));
  });

  it("reads the same way on an unhappy order as on a happy one", () => {
    const cancelled = render(
      <OrderTrackingTimeline
        history={[PLACED, event("cancelled", "2026-05-02T06:00:00Z")]}
        currentStatus="cancelled"
      />,
    );
    const cancelledSteps = cancelled.container.querySelectorAll("li").length;
    cleanup();

    const delivered = render(
      <OrderTrackingTimeline
        history={[PLACED, event("delivered", "2026-05-02T06:00:00Z")]}
        currentStatus="delivered"
      />,
    );

    expect(cancelledSteps).toBe(delivered.container.querySelectorAll("li").length);
    expect(delivered.container.textContent).toContain("Where it is now");
  });
});
