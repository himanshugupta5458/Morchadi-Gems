import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma, type OrderStatus } from "@prisma/client";
import {
  ADMIN_ORDERS_PAGE_SIZE,
  buildAdminOrderOrderBy,
  buildAdminOrderWhere,
  buildAdminOrdersHref,
  countPages,
  endOfIstDayUtc,
  findAdminOrderPage,
  formatAdminOrderDate,
  hasActiveAdminOrderFilters,
  parseAdminOrderQuery,
  resolvePage,
  startOfIstDayUtc,
  statusesForView,
  toIstDateInputValue,
  type AdminOrderQuery,
} from "@/lib/admin-orders";
import { prisma } from "@/lib/prisma";

const START_POSTGRES_HINT = "start it with `docker compose up -d` — see docs/DEV-DATABASE.md";

let unavailableReason: string | null = null;

function firstLineOf(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n").map((line) => line.trim()).filter(Boolean)[0] ?? "unknown error";
}

/**
 * Every row this file writes carries this prefix in its order id and its Cashfree id, and
 * every customer it creates carries it in their name. The prefix is what the cleanup below
 * deletes by, and — because each block searches for its own token — what keeps these tests
 * from seeing each other's rows or the developer's real ones.
 */
const SEED_PREFIX = "ZZT";

const SEED_PHONE_PREFIX = "5550";

interface SeedOrder {
  id: string;
  status: OrderStatus;
  total: number;
  createdAt: Date;
}

async function seedCustomerWithOrders(
  token: string,
  phoneSuffix: string,
  orders: readonly SeedOrder[],
): Promise<string> {
  const customer = await prisma.customer.create({
    data: {
      phone: `${SEED_PHONE_PREFIX}${phoneSuffix}`,
      name: `${token} Buyer`,
      email: `${token.toLowerCase()}@example.test`,
    },
    select: { id: true },
  });

  await prisma.order.createMany({
    data: orders.map((order) => ({
      id: order.id,
      customerId: customer.id,
      status: order.status,
      createdAt: order.createdAt,
      subtotal: new Prisma.Decimal(order.total),
      shippingFee: new Prisma.Decimal(0),
      total: new Prisma.Decimal(order.total),
      totalCost: new Prisma.Decimal(0),
      amountPrepaid: new Prisma.Decimal(order.total),
      amountDue: new Prisma.Decimal(0),
      cashfreeOrderId: `MG_${SEED_PREFIX}_${order.id}`,
      cashfreePaymentStatus: "PAID",
      shippingAddress: { name: `${token} Buyer` },
    })),
  });

  return customer.id;
}

async function removeSeededRows(): Promise<void> {
  if (unavailableReason !== null) return;

  await prisma.order.deleteMany({ where: { id: { startsWith: SEED_PREFIX } } });
  await prisma.customer.deleteMany({
    where: { phone: { startsWith: SEED_PHONE_PREFIX } },
  });
}

function query(overrides: Partial<AdminOrderQuery> = {}): AdminOrderQuery {
  return {
    view: "active",
    status: null,
    search: "",
    from: "",
    to: "",
    sort: "newest",
    page: 1,
    ...overrides,
  };
}

const VIEW_TOKEN = "ZZTVIEW";
const SORT_TOKEN = "ZZTSORT";
const PAGE_TOKEN = "ZZTPAGE";
const DATE_TOKEN = "ZZTDATE";

const PAGE_SEED_COUNT = ADMIN_ORDERS_PAGE_SIZE + 5;

beforeAll(async () => {
  try {
    await prisma.$connect();
  } catch (error) {
    unavailableReason = `no database at DATABASE_URL (${firstLineOf(error)}) — ${START_POSTGRES_HINT}`;
    return;
  }

  await removeSeededRows();

  await seedCustomerWithOrders(VIEW_TOKEN, "0001", [
    { id: "ZZTVIEWPLA", status: "placed", total: 100, createdAt: new Date("2026-05-01T06:00:00Z") },
    { id: "ZZTVIEWPAC", status: "packed", total: 200, createdAt: new Date("2026-05-02T06:00:00Z") },
    { id: "ZZTVIEWSHI", status: "shipped", total: 300, createdAt: new Date("2026-05-03T06:00:00Z") },
    { id: "ZZTVIEWDEL", status: "delivered", total: 400, createdAt: new Date("2026-05-04T06:00:00Z") },
    { id: "ZZTVIEWRTO", status: "rto", total: 500, createdAt: new Date("2026-05-05T06:00:00Z") },
    { id: "ZZTVIEWRET", status: "returned", total: 600, createdAt: new Date("2026-05-06T06:00:00Z") },
    { id: "ZZTVIEWCAN", status: "cancelled", total: 700, createdAt: new Date("2026-05-07T06:00:00Z") },
  ]);

  await seedCustomerWithOrders(SORT_TOKEN, "0002", [
    { id: "ZZTSORTLOW", status: "placed", total: 149, createdAt: new Date("2026-06-03T06:00:00Z") },
    { id: "ZZTSORTMID", status: "placed", total: 749, createdAt: new Date("2026-06-01T06:00:00Z") },
    { id: "ZZTSORTTOP", status: "placed", total: 1499, createdAt: new Date("2026-06-02T06:00:00Z") },
  ]);

  await seedCustomerWithOrders(
    PAGE_TOKEN,
    "0003",
    Array.from({ length: PAGE_SEED_COUNT }, (_unused, index) => ({
      id: `ZZTPAGE${String(index).padStart(3, "0")}`,
      status: "placed" as OrderStatus,
      total: 100 + index,
      createdAt: new Date(Date.UTC(2026, 6, 1, 0, index)),
    })),
  );

  /**
   * 30 June 2026 at 23:00 UTC is already 1 July in India. It is here to prove the range
   * boundaries are Indian days rather than UTC ones — a UTC comparison files this order under
   * June and it disappears from a search for "orders placed on 1 July".
   */
  await seedCustomerWithOrders(DATE_TOKEN, "0004", [
    { id: "ZZTDATEJUN", status: "placed", total: 100, createdAt: new Date("2026-06-30T12:00:00Z") },
    { id: "ZZTDATEEVE", status: "placed", total: 200, createdAt: new Date("2026-06-30T23:00:00Z") },
    { id: "ZZTDATEJUL", status: "placed", total: 300, createdAt: new Date("2026-07-01T12:00:00Z") },
  ]);

  await prisma.customer.create({
    data: {
      phone: `${SEED_PHONE_PREFIX}9876`,
      name: "Meenakshi Zztfind Rao",
      email: "zztfind@example.test",
      orders: {
        create: [
          {
            id: "ZZTFIND23A",
            status: "placed",
            createdAt: new Date("2026-08-01T06:00:00Z"),
            subtotal: new Prisma.Decimal(999),
            shippingFee: new Prisma.Decimal(0),
            total: new Prisma.Decimal(999),
            totalCost: new Prisma.Decimal(0),
            amountPrepaid: new Prisma.Decimal(999),
            amountDue: new Prisma.Decimal(0),
            cashfreeOrderId: `MG_${SEED_PREFIX}_ZZTFIND23A`,
            cashfreePaymentStatus: "PAID",
            shippingAddress: { name: "Meenakshi Zztfind Rao" },
          },
        ],
      },
    },
  });
});

afterAll(async () => {
  await removeSeededRows();
  await prisma.$disconnect();
});

describe("reading the list's state off the URL", () => {
  it("defaults to Active, newest first, page one, nothing filtered", () => {
    expect(parseAdminOrderQuery({})).toEqual(query());
  });

  it("takes the view, status, search, dates, sort and page it is given", () => {
    expect(
      parseAdminOrderQuery({
        view: "resolved",
        status: "rto",
        search: "  Ananya  ",
        from: "2026-08-01",
        to: "2026-08-20",
        sort: "total-high",
        page: "3",
      }),
    ).toEqual({
      view: "resolved",
      status: "rto",
      search: "Ananya",
      from: "2026-08-01",
      to: "2026-08-20",
      sort: "total-high",
      page: 3,
    });
  });

  it("refuses a status that does not belong to the view being filtered", () => {
    expect(parseAdminOrderQuery({ view: "active", status: "delivered" }).status).toBeNull();
    expect(parseAdminOrderQuery({ view: "resolved", status: "packed" }).status).toBeNull();
  });

  it("falls back rather than erroring on a hand-edited URL", () => {
    const parsed = parseAdminOrderQuery({
      view: "everything",
      status: "refunded",
      sort: "cheapest",
      page: "-4",
      from: "yesterday",
      to: "2026-13-45",
    });

    expect(parsed).toEqual(query());
  });

  it("takes the first value when a param is repeated", () => {
    expect(parseAdminOrderQuery({ view: ["resolved", "active"] }).view).toBe("resolved");
  });

  it("bounds a search term rather than passing a wall of text to the database", () => {
    expect(parseAdminOrderQuery({ search: "z".repeat(500) }).search).toHaveLength(60);
  });

  it("knows when something is narrowing the list", () => {
    expect(hasActiveAdminOrderFilters(query())).toBe(false);
    expect(hasActiveAdminOrderFilters(query({ view: "resolved" }))).toBe(false);
    expect(hasActiveAdminOrderFilters(query({ sort: "total-high" }))).toBe(false);
    expect(hasActiveAdminOrderFilters(query({ search: "9876" }))).toBe(true);
    expect(hasActiveAdminOrderFilters(query({ status: "packed" }))).toBe(true);
    expect(hasActiveAdminOrderFilters(query({ from: "2026-08-01" }))).toBe(true);
  });
});

describe("Indian calendar days against UTC timestamps", () => {
  it("starts a day five and a half hours before UTC midnight", () => {
    expect(startOfIstDayUtc("2026-07-01")?.toISOString()).toBe("2026-06-30T18:30:00.000Z");
  });

  it("ends it exclusively at the next day's start, so no instant falls between two ranges", () => {
    expect(endOfIstDayUtc("2026-07-01")?.toISOString()).toBe("2026-07-01T18:30:00.000Z");
  });

  it("refuses anything that is not a real calendar date", () => {
    expect(startOfIstDayUtc("2026-02-30")).toBeNull();
    expect(startOfIstDayUtc("2026-13-01")).toBeNull();
    expect(startOfIstDayUtc("01-07-2026")).toBeNull();
    expect(startOfIstDayUtc("")).toBeNull();
  });

  it("renders a date input's value in Indian time, not the server's", () => {
    expect(toIstDateInputValue(new Date("2026-06-30T23:00:00Z"))).toBe("2026-07-01");
  });

  it("labels a placed-at instant in Indian time", () => {
    expect(formatAdminOrderDate(new Date("2026-06-30T23:00:00Z"))).toContain("01 Jul 2026");
  });
});

describe("the where clause", () => {
  it("always restricts to the view's statuses, so a tab cannot leak the other's orders", () => {
    expect(buildAdminOrderWhere(query()).status).toEqual({
      in: [...statusesForView("active")],
    });
    expect(buildAdminOrderWhere(query({ view: "resolved" })).status).toEqual({
      in: [...statusesForView("resolved")],
    });
  });

  it("narrows to the one status when the operator picked it", () => {
    expect(buildAdminOrderWhere(query({ status: "packed" })).status).toEqual({
      in: ["packed"],
    });
  });

  it("matches a search across the order number, the name and the phone", () => {
    expect(buildAdminOrderWhere(query({ search: "9876" })).OR).toEqual([
      { id: { contains: "9876", mode: "insensitive" } },
      { customer: { name: { contains: "9876", mode: "insensitive" } } },
      { customer: { phone: { contains: "9876" } } },
    ]);
  });

  it("drops the phone branch for a term with no digits, which would match every row", () => {
    expect(buildAdminOrderWhere(query({ search: "Ananya" })).OR).toEqual([
      { id: { contains: "Ananya", mode: "insensitive" } },
      { customer: { name: { contains: "Ananya", mode: "insensitive" } } },
    ]);
  });

  it("drops it for a partial order number too — its digits are not a phone number", () => {
    expect(buildAdminOrderWhere(query({ search: "32QBZ" })).OR).toEqual([
      { id: { contains: "32QBZ", mode: "insensitive" } },
      { customer: { name: { contains: "32QBZ", mode: "insensitive" } } },
    ]);
  });

  it("reduces a written-out phone number to its digits", () => {
    const clauses = buildAdminOrderWhere(query({ search: "+91 98765-43210" })).OR ?? [];

    expect(clauses).toContainEqual({ customer: { phone: { contains: "919876543210" } } });
  });

  it("carries no date bound when neither end was given", () => {
    expect(buildAdminOrderWhere(query()).createdAt).toBeUndefined();
  });

  it("carries one end when only one was given", () => {
    expect(buildAdminOrderWhere(query({ from: "2026-07-01" })).createdAt).toEqual({
      gte: new Date("2026-06-30T18:30:00.000Z"),
    });
  });
});

describe("the order by", () => {
  it("is newest first by default", () => {
    expect(buildAdminOrderOrderBy("newest")[0]).toEqual({ createdAt: "desc" });
  });

  it("sorts by total in both directions", () => {
    expect(buildAdminOrderOrderBy("total-high")[0]).toEqual({ total: "desc" });
    expect(buildAdminOrderOrderBy("total-low")[0]).toEqual({ total: "asc" });
  });

  it("breaks every tie on the unique id, so a row cannot hide between two pages", () => {
    for (const sort of ["newest", "oldest", "total-high", "total-low"] as const) {
      expect(buildAdminOrderOrderBy(sort).at(-1)).toHaveProperty("id");
    }
  });
});

describe("paging arithmetic", () => {
  it("is one page for an empty list rather than zero", () => {
    expect(countPages(0, 25)).toBe(1);
  });

  it("rounds a partial page up", () => {
    expect(countPages(26, 25)).toBe(2);
    expect(countPages(50, 25)).toBe(2);
    expect(countPages(51, 25)).toBe(3);
  });

  it("clamps a page beyond the end back onto the last one", () => {
    expect(resolvePage(9, 2)).toBe(2);
    expect(resolvePage(0, 2)).toBe(1);
  });
});

describe("the list's own links", () => {
  const BASE = "/admin/orders";

  it("leaves the default view at a clean URL", () => {
    expect(buildAdminOrdersHref(BASE, query())).toBe(BASE);
  });

  it("names only what differs from the default", () => {
    expect(buildAdminOrdersHref(BASE, query({ view: "resolved", status: "rto" }))).toBe(
      `${BASE}?view=resolved&status=rto`,
    );
  });

  it("returns to page one when a filter changes", () => {
    expect(
      buildAdminOrdersHref(BASE, query({ page: 4 }), { status: "packed" }),
    ).toBe(`${BASE}?status=packed`);
  });

  it("keeps the page when the page is what changed", () => {
    expect(buildAdminOrdersHref(BASE, query({ page: 2 }), { page: 3 })).toBe(`${BASE}?page=3`);
  });

  it("escapes a search term rather than letting it edit the query string", () => {
    expect(buildAdminOrdersHref(BASE, query({ search: "a&b=c" }))).toBe(
      `${BASE}?search=a%26b%3Dc`,
    );
  });
});

describe("the list against the real database", () => {
  it("shows only the three outstanding statuses in Active", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const { rows } = await findAdminOrderPage(query({ search: VIEW_TOKEN }));

    expect(rows.map((row) => row.status).sort()).toEqual(["packed", "placed", "shipped"]);
  });

  it("shows only the four finished statuses in Resolved", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const { rows } = await findAdminOrderPage(
      query({ view: "resolved", search: VIEW_TOKEN }),
    );

    expect(rows.map((row) => row.status).sort()).toEqual([
      "cancelled",
      "delivered",
      "returned",
      "rto",
    ]);
  });

  it("narrows to one status inside a view", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const { rows, totalCount } = await findAdminOrderPage(
      query({ status: "packed", search: VIEW_TOKEN }),
    );

    expect(totalCount).toBe(1);
    expect(rows[0]?.id).toBe("ZZTVIEWPAC");
  });

  it("finds an order by its full order number", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const { rows } = await findAdminOrderPage(query({ search: "ZZTFIND23A" }));

    expect(rows.map((row) => row.id)).toEqual(["ZZTFIND23A"]);
  });

  it("finds it from a lowercase partial, which is how it gets typed", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const { rows } = await findAdminOrderPage(query({ search: "zztfind23" }));

    expect(rows.map((row) => row.id)).toEqual(["ZZTFIND23A"]);
  });

  /**
   * The failure this guards was found by looking at the real rendered list rather than at a
   * test: searching an order number that happens to contain two digits returned every order
   * belonging to a phone number those digits appear inside, which is most of them.
   */
  it("does not drag in unrelated orders whose phone contains the term's digits", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const noise = await prisma.customer.create({
      data: {
        phone: `${SEED_PHONE_PREFIX}0123`,
        name: "Zztnoise Buyer",
        email: "zztnoise@example.test",
        orders: {
          create: [
            {
              id: "ZZTNOISE01",
              status: "placed",
              subtotal: new Prisma.Decimal(100),
              shippingFee: new Prisma.Decimal(0),
              total: new Prisma.Decimal(100),
              totalCost: new Prisma.Decimal(0),
              amountPrepaid: new Prisma.Decimal(100),
              amountDue: new Prisma.Decimal(0),
              cashfreeOrderId: `MG_${SEED_PREFIX}_ZZTNOISE01`,
              cashfreePaymentStatus: "PAID",
              shippingAddress: { name: "Zztnoise Buyer" },
            },
          ],
        },
      },
      select: { id: true },
    });

    const { rows } = await findAdminOrderPage(query({ search: "ZZTFIND23" }));

    expect(rows.map((row) => row.id)).toEqual(["ZZTFIND23A"]);
    expect(noise.id.length).toBeGreaterThan(0);
  });

  it("finds an order by the customer's phone number", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const { rows } = await findAdminOrderPage(query({ search: "55509876" }));

    expect(rows.map((row) => row.id)).toEqual(["ZZTFIND23A"]);
  });

  it("finds it from the last digits of that number", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const { rows } = await findAdminOrderPage(query({ search: "9876" }));

    expect(rows.map((row) => row.id)).toContain("ZZTFIND23A");
  });

  it("finds an order by part of the customer's name", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const { rows } = await findAdminOrderPage(query({ search: "meenakshi" }));

    expect(rows.map((row) => row.id)).toEqual(["ZZTFIND23A"]);
  });

  it("returns nothing for a term that matches none of the three", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const { rows, totalCount } = await findAdminOrderPage(
      query({ search: "zzt-nobody-by-that-name" }),
    );

    expect(rows).toEqual([]);
    expect(totalCount).toBe(0);
  });

  it("sorts newest first by default", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const { rows } = await findAdminOrderPage(query({ search: SORT_TOKEN }));

    expect(rows.map((row) => row.id)).toEqual(["ZZTSORTLOW", "ZZTSORTTOP", "ZZTSORTMID"]);
  });

  it("sorts by total in both directions", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const high = await findAdminOrderPage(query({ search: SORT_TOKEN, sort: "total-high" }));
    const low = await findAdminOrderPage(query({ search: SORT_TOKEN, sort: "total-low" }));

    expect(high.rows.map((row) => row.total)).toEqual([1499, 749, 149]);
    expect(low.rows.map((row) => row.total)).toEqual([149, 749, 1499]);
  });

  it("reads a rupee total back as a number, not a Decimal", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const { rows } = await findAdminOrderPage(query({ search: "ZZTSORTTOP" }));

    expect(rows[0]?.total).toBe(1499);
    expect(typeof rows[0]?.total).toBe("number");
  });

  it("filters to a single Indian calendar day, evening orders included", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const { rows } = await findAdminOrderPage(
      query({ search: DATE_TOKEN, from: "2026-07-01", to: "2026-07-01" }),
    );

    expect(rows.map((row) => row.id).sort()).toEqual(["ZZTDATEEVE", "ZZTDATEJUL"]);
  });

  it("excludes the day before that range, which UTC would have included", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const { rows } = await findAdminOrderPage(
      query({ search: DATE_TOKEN, from: "2026-06-30", to: "2026-06-30" }),
    );

    expect(rows.map((row) => row.id)).toEqual(["ZZTDATEJUN"]);
  });

  it("takes an open-ended lower bound", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const { rows } = await findAdminOrderPage(
      query({ search: DATE_TOKEN, from: "2026-07-01" }),
    );

    expect(rows.map((row) => row.id).sort()).toEqual(["ZZTDATEEVE", "ZZTDATEJUL"]);
  });

  it("shows a full page and reports how many matched in total", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const first = await findAdminOrderPage(query({ search: PAGE_TOKEN }));

    expect(first.rows).toHaveLength(ADMIN_ORDERS_PAGE_SIZE);
    expect(first.totalCount).toBe(PAGE_SEED_COUNT);
    expect(first.pageCount).toBe(2);
    expect(first.page).toBe(1);
  });

  it("shows the remainder on the second page, with no row on both", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const first = await findAdminOrderPage(query({ search: PAGE_TOKEN }));
    const second = await findAdminOrderPage(query({ search: PAGE_TOKEN, page: 2 }));

    expect(second.rows).toHaveLength(PAGE_SEED_COUNT - ADMIN_ORDERS_PAGE_SIZE);

    const seen = new Set([...first.rows, ...second.rows].map((row) => row.id));
    expect(seen.size).toBe(PAGE_SEED_COUNT);
  });

  it("clamps a page past the end onto the last one rather than showing nothing", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const beyond = await findAdminOrderPage(query({ search: PAGE_TOKEN, page: 99 }));

    expect(beyond.page).toBe(2);
    expect(beyond.rows).not.toHaveLength(0);
  });

  it("carries the customer's name and phone onto every row", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const { rows } = await findAdminOrderPage(query({ search: "ZZTFIND23A" }));

    expect(rows[0]).toMatchObject({
      id: "ZZTFIND23A",
      customerName: "Meenakshi Zztfind Rao",
      customerPhone: "55509876",
      paymentType: "prepaid",
      status: "placed",
    });
  });

  it("selects no margin data, so a list cannot leak what an order cost the shop", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const { rows } = await findAdminOrderPage(query({ search: "ZZTFIND23A" }));

    expect(Object.keys(rows[0] ?? {}).sort()).toEqual([
      "amountDue",
      "createdAt",
      "customerName",
      "customerPhone",
      "id",
      "paymentType",
      "status",
      "total",
    ]);
  });
});
