import type { Metadata } from "next";
import { headers } from "next/headers";
import { Breadcrumb } from "@/components/Breadcrumb";
import { OrderTrackingForm } from "@/components/OrderTrackingForm";
import { OrderTrackingResult } from "@/components/OrderTrackingResult";
import { SITE_CONFIG } from "@/lib/config";
import { TRACK_ORDER_QUERY_PARAM } from "@/lib/navigation";
import { findPublicOrderTracking } from "@/lib/order-tracking";
import { TRACKING_THROTTLED_MESSAGE } from "@/lib/order-tracking-copy";
import {
  recordTrackingLookup,
  resolveTrackingClientKey,
} from "@/lib/tracking-lookup-limit";

/**
 * With an order number in the query string this page renders the state of one person's order,
 * so an indexed copy of it is somebody else's order status sitting in a search result. Without
 * one it is a single empty input box, which is nothing to rank either way. `/track` is in
 * `NON_INDEXABLE_PATHS` alongside the rest of the funnel, which is what disallows it in
 * `robots.txt` and keeps it out of the sitemap; this is the same instruction said on the page.
 */
export const metadata: Metadata = {
  title: "Track Your Order",
  description: `Look up a ${SITE_CONFIG.brandName} order with the order number from your confirmation.`,
  robots: { index: false, follow: true },
};

/**
 * A lookup reads the database for whatever number is in the URL, so there is nothing here to
 * cache and a cached answer would be a stale one.
 */
export const dynamic = "force-dynamic";

interface TrackOrderPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

function readSubmittedOrderId(
  searchParams: TrackOrderPageProps["searchParams"],
): string | null {
  const submitted = searchParams[TRACK_ORDER_QUERY_PARAM];
  if (typeof submitted === "string") return submitted;
  return Array.isArray(submitted) ? submitted[0] ?? null : null;
}

export default async function TrackOrderPage({
  searchParams,
}: TrackOrderPageProps): Promise<JSX.Element> {
  const submittedOrderId = readSubmittedOrderId(searchParams);
  const hasSubmittedOrderId = submittedOrderId !== null && submittedOrderId.trim().length > 0;

  const requestHeaders = headers();
  const lookupVerdict = hasSubmittedOrderId
    ? recordTrackingLookup(
        resolveTrackingClientKey((name) => requestHeaders.get(name)),
        Date.now(),
      )
    : "allowed";

  const tracking =
    hasSubmittedOrderId && lookupVerdict === "allowed"
      ? await findPublicOrderTracking(submittedOrderId)
      : null;

  return (
    <div className="container py-6 sm:py-8 lg:py-12">
      <Breadcrumb trail={[{ label: "Home", href: "/" }, { label: "Track Order" }]} />

      <h1 className="mt-5 font-display text-heading-sm sm:mt-8 sm:text-heading-lg lg:mt-10">
        <span className="uppercase tracking-caps text-ink">Track Your</span>{" "}
        <span className="italic text-gold">Order</span>
      </h1>

      <div className="mt-6 flex max-w-2xl flex-col gap-10 sm:mt-10 lg:mt-12">
        <OrderTrackingForm submittedOrderId={submittedOrderId ?? ""} />

        {hasSubmittedOrderId ? (
          lookupVerdict === "throttled" ? (
            <p className="text-body-sm text-muted">{TRACKING_THROTTLED_MESSAGE}</p>
          ) : (
            <OrderTrackingResult tracking={tracking} />
          )
        ) : null}
      </div>
    </div>
  );
}
