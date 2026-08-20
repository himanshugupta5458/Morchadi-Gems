import type { Metadata } from "next";
import { headers } from "next/headers";
import { resolveAdminOrdersHref, resolveRequestHostname } from "@/lib/admin-routing";
import { ButtonLink } from "@/components/ButtonLink";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Not found",
  robots: { index: false, follow: false },
};

/**
 * The panel's own 404, and the boundary that keeps the shop out of it.
 *
 * An order id typed wrong is the common way to reach this, so it says so and offers the list
 * rather than the shop. It also exists for a second, less visible reason: a `not-found.tsx` is
 * serialised into the payload of **every** page beneath the segment it sits in, as the tree to
 * swap in if that page calls `notFound()`. Without this file the panel's boundary was the
 * storefront's 404, which meant every admin page shipped the shop header, the footer, the
 * floating WhatsApp button and the whole catalogue index inside its flight data — invisible on
 * screen, and still storefront chrome travelling with an admin screen. See
 * [ADR-044](/docs/decisions/ADR-044-admin-order-detail-and-layout-split.md).
 */
export default function AdminNotFound(): JSX.Element {
  const ordersHref = resolveAdminOrdersHref(
    resolveRequestHostname((name) => headers().get(name)),
  );

  return (
    <div className="flex flex-col items-start gap-6 py-10">
      <div className="flex flex-col gap-3">
        <span className="text-eyebrow uppercase tracking-caps-wide text-muted">404</span>
        <h1 className="font-display text-heading text-ink">Nothing at this address</h1>
        <p className="max-w-prose text-body-sm text-muted">
          The page or order number you asked for does not exist. Order numbers are ten
          characters and use no <span className="text-ink">0</span>,{" "}
          <span className="text-ink">O</span>, <span className="text-ink">1</span>,{" "}
          <span className="text-ink">I</span> or <span className="text-ink">L</span>, so a
          misread label is the usual reason to land here.
        </p>
      </div>

      <ButtonLink href={ordersHref} size="sm">
        Back to orders
      </ButtonLink>
    </div>
  );
}
