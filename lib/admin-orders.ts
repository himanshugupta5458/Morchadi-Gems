import "server-only";
import { Prisma, type OrderStatus, type PaymentType, type PrismaClient } from "@prisma/client";
import {
  ACTIVE_ORDER_STATUSES,
  RESOLVED_ORDER_STATUSES,
} from "@/lib/order-status";
import { prisma } from "@/lib/prisma";

/**
 * The two halves of the order list. `active` is work outstanding, `resolved` is work finished,
 * and the statuses behind each are in `lib/order-status.ts` so the split is stated once.
 */
export const ADMIN_ORDER_VIEWS = ["active", "resolved"] as const;

export type AdminOrderView = (typeof ADMIN_ORDER_VIEWS)[number];

export const DEFAULT_ADMIN_ORDER_VIEW: AdminOrderView = "active";

export const ADMIN_ORDER_SORTS = ["newest", "oldest", "total-high", "total-low"] as const;

export type AdminOrderSort = (typeof ADMIN_ORDER_SORTS)[number];

export const DEFAULT_ADMIN_ORDER_SORT: AdminOrderSort = "newest";

/**
 * Rows per page. Twenty-five is chosen for a solo operator on one screen rather than for a
 * database: it is a page that can be read without scrolling past the fold twice, and at this
 * shop's volume it is also most of a month. `skip`/`take` on an indexed `created_at` stays
 * cheap long past the point where that stops being true.
 */
export const ADMIN_ORDERS_PAGE_SIZE = 25;

/**
 * India is UTC+05:30 and observes no daylight saving, so one fixed offset converts a calendar
 * date the owner typed into the instant Postgres stores. `timestamp` columns here are UTC; a
 * date range compared against them without this shifts every boundary by five and a half
 * hours, which silently drops the evening's orders out of "today".
 */
export const IST_OFFSET_MINUTES = 330;

const MILLISECONDS_PER_MINUTE = 60_000;
const MILLISECONDS_PER_DAY = 24 * 60 * MILLISECONDS_PER_MINUTE;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The instant a `YYYY-MM-DD` day begins in India, as UTC. Null for anything that is not a real
 * calendar date — a filter the browser could not have produced is dropped rather than guessed
 * at, because a half-parsed range would quietly hide orders.
 */
export function startOfIstDayUtc(isoDate: string): Date | null {
  if (!ISO_DATE_PATTERN.test(isoDate)) return null;

  const midnightUtc = new Date(`${isoDate}T00:00:00.000Z`);
  if (Number.isNaN(midnightUtc.getTime())) return null;
  if (midnightUtc.toISOString().slice(0, 10) !== isoDate) return null;

  return new Date(midnightUtc.getTime() - IST_OFFSET_MINUTES * MILLISECONDS_PER_MINUTE);
}

/**
 * The instant the day *after* a `YYYY-MM-DD` begins in India, as UTC — an exclusive upper
 * bound. Exclusive rather than "23:59:59.999 inclusive" so nothing placed in the last
 * millisecond of a day can fall between two adjacent ranges.
 */
export function endOfIstDayUtc(isoDate: string): Date | null {
  const dayStart = startOfIstDayUtc(isoDate);
  return dayStart === null ? null : new Date(dayStart.getTime() + MILLISECONDS_PER_DAY);
}

/**
 * How one order reads in the list. Deliberately narrow: no line items, no address, no
 * `totalCost`. Margin data is not needed to decide which order to open, and a list query that
 * does not select it cannot leak it into a page's serialised props.
 */
export interface AdminOrderRow {
  id: string;
  createdAt: Date;
  status: OrderStatus;
  paymentType: PaymentType;
  total: number;
  /**
   * What is still owed on this order. Zero on every prepaid one, which is most of them, and the
   * whole point of carrying it in the *list*: an operator packing today's orders needs to know
   * which ones have money to collect before they open any of them, and a payment-type label
   * alone does not say how much. There is no collection flow behind it yet — the balance is
   * chased by hand — which is precisely why it has to be visible.
   */
  amountDue: number;
  customerName: string;
  customerPhone: string;
}

export interface AdminOrderQuery {
  view: AdminOrderView;
  /** A single status *within* the current view, or null for all of that view's statuses. */
  status: OrderStatus | null;
  search: string;
  /** `YYYY-MM-DD`, or the empty string for an open-ended bound. */
  from: string;
  to: string;
  sort: AdminOrderSort;
  page: number;
}

export interface AdminOrderPage {
  rows: AdminOrderRow[];
  totalCount: number;
  page: number;
  pageCount: number;
  pageSize: number;
}

/** What a Server Component's `searchParams` hands over. */
export type AdminOrderSearchParams = Record<string, string | string[] | undefined>;

function readParam(params: AdminOrderSearchParams, key: string): string {
  const raw = params[key];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" ? value.trim() : "";
}

export function statusesForView(view: AdminOrderView): readonly OrderStatus[] {
  return view === "active" ? ACTIVE_ORDER_STATUSES : RESOLVED_ORDER_STATUSES;
}

/**
 * How long a search term may be. Long enough for a full name, short enough that the `contains`
 * below cannot be handed a kilobyte of text to scan every row against.
 */
export const MAX_ADMIN_ORDER_SEARCH_LENGTH = 60;

/**
 * The URL reduced to a query this module can execute, with every field defaulted rather than
 * optional.
 *
 * Nothing here can fail. A URL is edited by hand, bookmarked, and truncated by chat clients,
 * so an unrecognised view, an impossible status, a malformed date or a page of `-4` all fall
 * back to the default they replace instead of producing an error page. The one rule this
 * enforces beyond shape is that **a status must belong to the view it is filtering** —
 * `?view=active&status=delivered` would otherwise return an empty list that looks like a
 * missing order rather than a contradictory filter.
 */
export function parseAdminOrderQuery(params: AdminOrderSearchParams): AdminOrderQuery {
  const requestedView = readParam(params, "view");
  const view = ADMIN_ORDER_VIEWS.find((candidate) => candidate === requestedView) ??
    DEFAULT_ADMIN_ORDER_VIEW;

  const requestedStatus = readParam(params, "status");
  const status =
    statusesForView(view).find((candidate) => candidate === requestedStatus) ?? null;

  const requestedSort = readParam(params, "sort");
  const sort =
    ADMIN_ORDER_SORTS.find((candidate) => candidate === requestedSort) ??
    DEFAULT_ADMIN_ORDER_SORT;

  const requestedPage = Number.parseInt(readParam(params, "page"), 10);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const from = startOfIstDayUtc(readParam(params, "from")) === null ? "" : readParam(params, "from");
  const to = endOfIstDayUtc(readParam(params, "to")) === null ? "" : readParam(params, "to");

  return {
    view,
    status,
    search: readParam(params, "search").slice(0, MAX_ADMIN_ORDER_SEARCH_LENGTH),
    from,
    to,
    sort,
    page,
  };
}

/**
 * The `created_at` bound, or undefined when neither end was given.
 *
 * A range whose ends are the wrong way round is returned as given rather than swapped: the
 * list then shows nothing, which is the honest rendering of what was asked for, and swapping
 * would answer a question the operator did not type.
 */
function buildCreatedAtFilter(query: AdminOrderQuery): Prisma.DateTimeFilter | undefined {
  const gte = query.from === "" ? null : startOfIstDayUtc(query.from);
  const lt = query.to === "" ? null : endOfIstDayUtc(query.to);

  if (gte === null && lt === null) return undefined;

  return {
    ...(gte === null ? {} : { gte }),
    ...(lt === null ? {} : { lt }),
  };
}

/**
 * The three fields one search box matches across: the order number, the customer's phone and
 * their name.
 *
 * All three are `contains` rather than equality, so a partial order number typed off a courier
 * label and the last four digits of a phone number both find their order. The phone branch is
 * matched against the term's digits alone, because a number is written down as `98765 43210`
 * and `+91-9876543210` and stored as neither.
 *
 * **A term containing a letter is not a phone number**, and its digits are not extracted. An
 * order number is alphanumeric, so searching for `32QBZ` would otherwise be searching phones
 * for `32` — and `32` is a substring of most ten-digit numbers, which turns a search for one
 * order into the whole list. Nothing a person types as a phone number contains a letter, so
 * this costs no real query and removes the failure entirely.
 *
 * Order numbers are uppercase by construction and phone numbers have no case, so `insensitive`
 * is what lets an operator type either in lowercase.
 */
function buildSearchFilter(search: string): Prisma.OrderWhereInput[] | undefined {
  const term = search.trim();
  if (term.length === 0) return undefined;

  const digits = /[a-z]/i.test(term) ? "" : term.replace(/\D/g, "");

  return [
    { id: { contains: term, mode: "insensitive" } },
    { customer: { name: { contains: term, mode: "insensitive" } } },
    ...(digits.length === 0 ? [] : [{ customer: { phone: { contains: digits } } }]),
  ];
}

/**
 * The `where` for one list query.
 *
 * The status clause is always an `in` over the view's statuses, narrowed to a single one when
 * the operator picked it. It is never omitted: a query without it would let a `delivered`
 * order appear in Active, which is the one thing the two tabs exist to prevent.
 */
export function buildAdminOrderWhere(query: AdminOrderQuery): Prisma.OrderWhereInput {
  const statuses = query.status === null ? statusesForView(query.view) : [query.status];
  const createdAt = buildCreatedAtFilter(query);
  const searchClauses = buildSearchFilter(query.search);

  return {
    status: { in: [...statuses] },
    ...(createdAt === undefined ? {} : { createdAt }),
    ...(searchClauses === undefined ? {} : { OR: searchClauses }),
  };
}

/**
 * Newest first by default, because the order an operator wants is almost always the one that
 * just arrived. Every sort breaks its tie on `id`, which is unique, so two orders sharing a
 * total or a millisecond cannot swap places between page one and page two and hide a row.
 */
export function buildAdminOrderOrderBy(
  sort: AdminOrderSort,
): Prisma.OrderOrderByWithRelationInput[] {
  switch (sort) {
    case "oldest":
      return [{ createdAt: "asc" }, { id: "asc" }];
    case "total-high":
      return [{ total: "desc" }, { id: "asc" }];
    case "total-low":
      return [{ total: "asc" }, { id: "asc" }];
    default:
      return [{ createdAt: "desc" }, { id: "asc" }];
  }
}

export function countPages(totalCount: number, pageSize: number): number {
  return Math.max(1, Math.ceil(totalCount / pageSize));
}

/**
 * The page actually shown, which is not always the page asked for. A filter that narrows the
 * list while the operator is on page three would otherwise leave them on an empty page with no
 * indication that anything matched at all.
 */
export function resolvePage(requestedPage: number, pageCount: number): number {
  return Math.min(Math.max(1, requestedPage), pageCount);
}

/** The subset of the client this module needs, so tests can hand in a transaction's. */
export type AdminOrderClient = Pick<PrismaClient, "order">;

/**
 * One page of orders, with the count of everything that matched.
 *
 * Two queries rather than one: the count is what turns "25 rows" into "25 of 112", and it has
 * to run against the same `where` without the `take`. They are issued together so the round
 * trips overlap.
 *
 * The count is read first so `page` can be clamped against a real page count before `skip` is
 * computed — the alternative is a second query after the fact, or an empty page.
 */
export async function findAdminOrderPage(
  query: AdminOrderQuery,
  client: AdminOrderClient = prisma,
): Promise<AdminOrderPage> {
  const where = buildAdminOrderWhere(query);
  const totalCount = await client.order.count({ where });
  const pageCount = countPages(totalCount, ADMIN_ORDERS_PAGE_SIZE);
  const page = resolvePage(query.page, pageCount);

  const orders = await client.order.findMany({
    where,
    orderBy: buildAdminOrderOrderBy(query.sort),
    skip: (page - 1) * ADMIN_ORDERS_PAGE_SIZE,
    take: ADMIN_ORDERS_PAGE_SIZE,
    select: {
      id: true,
      createdAt: true,
      status: true,
      paymentType: true,
      total: true,
      amountDue: true,
      customer: { select: { name: true, phone: true } },
    },
  });

  return {
    rows: orders.map((order) => ({
      id: order.id,
      createdAt: order.createdAt,
      status: order.status,
      paymentType: order.paymentType,
      total: order.total.toNumber(),
      amountDue: order.amountDue.toNumber(),
      customerName: order.customer.name,
      customerPhone: order.customer.phone,
    })),
    totalCount,
    page,
    pageCount,
    pageSize: ADMIN_ORDERS_PAGE_SIZE,
  };
}

/**
 * The list's own URL, rebuilt with some of its query changed.
 *
 * Every control on the page — a tab, a sort, a page arrow — is a link produced here rather
 * than a form field, so the whole of the list's state lives in the URL and a filtered view can
 * be bookmarked or sent to somebody. Defaults are omitted from the result, which keeps the
 * unfiltered list at a clean `/orders` and makes "am I looking at a filtered list?" answerable
 * by looking at the address bar.
 *
 * `page` resets to one on every change except a change of `page` itself: narrowing a filter
 * while on page three should show the first page of the new list, not its third.
 */
export function buildAdminOrdersHref(
  basePath: string,
  query: AdminOrderQuery,
  changes: Partial<AdminOrderQuery> = {},
): string {
  const next: AdminOrderQuery = {
    ...query,
    ...changes,
    page: changes.page ?? (Object.keys(changes).length === 0 ? query.page : 1),
  };

  const params = new URLSearchParams();
  if (next.view !== DEFAULT_ADMIN_ORDER_VIEW) params.set("view", next.view);
  if (next.status !== null) params.set("status", next.status);
  if (next.search !== "") params.set("search", next.search);
  if (next.from !== "") params.set("from", next.from);
  if (next.to !== "") params.set("to", next.to);
  if (next.sort !== DEFAULT_ADMIN_ORDER_SORT) params.set("sort", next.sort);
  if (next.page > 1) params.set("page", String(next.page));

  const queryString = params.toString();
  return queryString === "" ? basePath : `${basePath}?${queryString}`;
}

/**
 * Whether anything is narrowing the list. Drives the "Clear filters" link, which is worth
 * offering only when there is something to clear — and worth offering *loudly* when a search
 * is the reason an order appears to be missing.
 */
export function hasActiveAdminOrderFilters(query: AdminOrderQuery): boolean {
  return (
    query.status !== null || query.search !== "" || query.from !== "" || query.to !== ""
  );
}

const ADMIN_ORDER_DATE_FORMAT = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

/**
 * A placed-at timestamp as the owner reads it: Indian time, on a server that runs in UTC.
 * Formatted here rather than in the browser so the page stays a Server Component and two
 * operators in two places see the same string.
 */
export function formatAdminOrderDate(placedAt: Date): string {
  return ADMIN_ORDER_DATE_FORMAT.format(placedAt);
}

/**
 * `YYYY-MM-DD` for a `<input type="date">`, in Indian time so "today" in the date picker is
 * the same day the list labels an order with.
 */
export function toIstDateInputValue(instant: Date): string {
  return new Date(instant.getTime() + IST_OFFSET_MINUTES * MILLISECONDS_PER_MINUTE)
    .toISOString()
    .slice(0, 10);
}
