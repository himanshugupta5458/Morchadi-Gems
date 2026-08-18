import type { Metadata } from "next";
import type { Product } from "@/types/product";
import {
  getAllProducts,
  getFeaturedProducts,
  toCatalogueEntry,
} from "@/lib/products";
import { FLAT_SHIPPING_RATE, FREE_SHIPPING_THRESHOLD } from "@/lib/config";
import { formatRupees, hasVisibleDiscount } from "@/lib/format";
import { AddToCartButton } from "@/components/AddToCartButton";
import { Button } from "@/components/Button";
import { CartEmptyState } from "@/components/CartEmptyState";
import { CartSummary } from "@/components/CartSummary";
import { CheckoutGuardNotice } from "@/components/CheckoutGuardNotice";
import { CheckoutSteps } from "@/components/CheckoutSteps";
import { FormFieldPreview } from "@/components/FormFieldPreview";
import { PolicyDisclaimer } from "@/components/PolicyDisclaimer";
import { Prose } from "@/components/Prose";
import { TextAreaFieldPreview } from "@/components/TextAreaFieldPreview";
import { ButtonLink } from "@/components/ButtonLink";
import { CategoryTile } from "@/components/CategoryTile";
import { PriceDisplay } from "@/components/PriceDisplay";
import { ProductCard } from "@/components/ProductCard";
import { ProductGallery } from "@/components/ProductGallery";
import { ProductOptionSelectorPreview } from "@/components/ProductOptionSelectorPreview";
import { QuantityStepperPreview } from "@/components/QuantityStepperPreview";
import { ProductGrid } from "@/components/ProductGrid";
import { ViewAllLink } from "@/components/ViewAllLink";
import { CATEGORIES } from "@/types/product";
import { SectionHeading } from "@/components/SectionHeading";
import { StarRating } from "@/components/StarRating";
import { TestimonialCard } from "@/components/TestimonialCard";
import { TrustBadge } from "@/components/TrustBadge";
import { TrustStrip } from "@/components/TrustStrip";
import { getTestimonials } from "@/lib/testimonials";
import { NAV_MENUS } from "@/lib/navigation";
import { GemOutlineIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Style Guide",
  description: "Internal QA surface for design tokens and UI primitives.",
  robots: { index: false, follow: false },
};

const PALETTE = [
  { name: "ivory", hex: "#FDFBF7", className: "bg-ivory" },
  { name: "white", hex: "#FFFFFF", className: "bg-white" },
  { name: "charcoal / ink", hex: "#1C1C1C", className: "bg-charcoal" },
  { name: "gold", hex: "#C6A24C", className: "bg-gold" },
  { name: "gold-deep", hex: "#A9863A", className: "bg-gold-deep" },
  { name: "maroon", hex: "#4A1621", className: "bg-maroon" },
  { name: "honey", hex: "#CBA96C", className: "bg-honey" },
  { name: "amber", hex: "#F5A623", className: "bg-amber" },
  { name: "muted", hex: "#6B6B6B", className: "bg-muted" },
  { name: "sale", hex: "#E23A2E", className: "bg-sale" },
  { name: "line", hex: "#E8E4DC", className: "bg-line" },
];

const TYPE_SCALE = [
  { token: "display-lg", className: "text-display-lg" },
  { token: "display", className: "text-display" },
  { token: "heading-lg", className: "text-heading-lg" },
  { token: "heading", className: "text-heading" },
  { token: "heading-sm", className: "text-heading-sm" },
];

const RATING_SAMPLES = [5, 4.5, 4.2, 3.5, 0];

function Panel({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <section className="flex flex-col gap-6 border-t border-line pt-10">
      <div className="flex flex-col gap-1">
        <h2 className="font-sans text-label uppercase tracking-caps-wide text-muted">
          {title}
        </h2>
        {note ? <p className="max-w-prose text-body-sm text-muted">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

function withoutImages(product: Product): Product {
  return { ...product, images: [] };
}

function withoutDiscount(product: Product): Product {
  return { ...product, mrp: product.price };
}

export default function StyleGuidePage(): JSX.Element {
  const testimonials = getTestimonials();
  const catalogue = getAllProducts();
  const featured = getFeaturedProducts();
  const discountedProducts = featured.filter((product) =>
    hasVisibleDiscount(product.mrp, product.price),
  );
  const fullPriceProduct = catalogue.find(
    (product) => !hasVisibleDiscount(product.mrp, product.price),
  );
  const soldOutProduct = catalogue.find((product) => !product.inStock);
  const sampleProduct = discountedProducts[0];

  const addToCartSamples = [
    { caption: "In stock", item: toCatalogueEntry(discountedProducts[0]) },
    ...(soldOutProduct
      ? [{ caption: "Sold out — disabled", item: toCatalogueEntry(soldOutProduct) }]
      : []),
  ];

  const priceSamples = [discountedProducts[0], discountedProducts[1]];
  if (fullPriceProduct) priceSamples.push(fullPriceProduct);

  const cardSamples: { caption: string; product: Product }[] = [
    { caption: "Discounted", product: discountedProducts[0] },
    {
      caption: "No discount — price alone in ink",
      product: withoutDiscount(discountedProducts[1]),
    },
    {
      caption: "Empty images[] — placeholder",
      product: withoutImages(discountedProducts[2]),
    },
  ];

  if (soldOutProduct) {
    cardSamples.push({ caption: "Sold out — disabled button", product: soldOutProduct });
  }

  return (
    <div className="container flex max-w-6xl flex-col gap-14 py-16">
      <header className="flex flex-col gap-4">
        <span className="text-eyebrow uppercase tracking-caps-wide text-gold-deep">
          Internal QA — not linked from the storefront
        </span>
        <h1 className="font-display text-display">
          <span className="uppercase tracking-caps">Style</span>{" "}
          <span className="italic text-gold">Guide</span>
        </h1>
        <p className="max-w-prose text-body text-muted">
          Every design token and UI primitive rendered against real catalogue data, so
          the foundation can be verified before any page is built on top of it.
        </p>
      </header>

      <Panel title="Colour tokens">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {PALETTE.map((swatch) => (
            <div key={swatch.name} className="flex flex-col gap-2">
              <div
                className={`h-16 w-full rounded-card border border-line ${swatch.className}`}
              />
              <div className="flex flex-col">
                <span className="text-body-sm text-ink">{swatch.name}</span>
                <span className="text-body-sm text-muted">{swatch.hex}</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title="Typography"
        note="Fraunces carries every display size; Jost carries body and UI."
      >
        <div className="flex flex-col gap-5">
          {TYPE_SCALE.map((step) => (
            <div key={step.token} className="flex flex-col gap-1">
              <span className="text-eyebrow uppercase text-muted">{step.token}</span>
              <p className={`font-display ${step.className}`}>
                Morchadi <span className="italic text-gold">Gems</span>
              </p>
            </div>
          ))}
          <div className="flex flex-col gap-2 border-t border-line pt-5">
            <p className="text-body-lg">Body large — Jost 17px, for lead paragraphs.</p>
            <p className="text-body">Body — Jost 15px, the storefront default.</p>
            <p className="text-body-sm text-muted">Body small — Jost 13px, muted.</p>
            <p className="text-label uppercase tracking-caps">Label — uppercase, tracked</p>
            <p className="text-eyebrow uppercase tracking-caps-wide text-gold-deep">
              Eyebrow — uppercase, wide tracking
            </p>
          </div>
        </div>
      </Panel>

      <Panel
        title="SectionHeading"
        note="The signature two-tone lockup: uppercase roman, then an italic accent word. Two tones — gold on light grounds, maroon on the honey band, where gold on gold goes illegible."
      >
        <div className="flex flex-col gap-10">
          <div className="flex flex-col gap-3">
            <span className="text-eyebrow uppercase text-muted">
              tone=&quot;light&quot; (default)
            </span>
            <div className="border border-line bg-white px-6 py-12">
              <SectionHeading
                roman="New Arrivals"
                accent="Collection"
                subtitle="Freshly cut, freshly set, and ready to wear this season."
              />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-eyebrow uppercase text-muted">
              tone=&quot;honey&quot;
            </span>
            <div className="bg-honey px-6 py-12">
              <SectionHeading
                roman="Customer"
                accent="Speak"
                tone="honey"
                subtitle="What people tell us after the box arrives."
              />
            </div>
          </div>

          <SectionHeading roman="Shop by" accent="Category" align="left" />
        </div>
      </Panel>

      <Panel title="Button">
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="primary">Add to cart</Button>
            <Button variant="secondary">View details</Button>
            <Button variant="primary" disabled>
              Sold out
            </Button>
            <Button variant="secondary" disabled>
              Unavailable
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="primary" size="sm">
              Small primary
            </Button>
            <Button variant="secondary" size="sm">
              Small secondary
            </Button>
          </div>
          <div className="max-w-xs">
            <Button variant="primary" fullWidth>
              Full width
            </Button>
          </div>
        </div>
      </Panel>

      <Panel
        title="ButtonLink"
        note="Same appearance as Button, rendered as an <a>. Both read their classes from lib/button-styles.ts, so a variant cannot drift between the two. Use this whenever the action is navigation."
      >
        <div className="flex flex-wrap items-center gap-4">
          <ButtonLink href="/shop">Shop Collection</ButtonLink>
          <ButtonLink href="/shop" variant="secondary">
            Explore Categories
          </ButtonLink>
          <ButtonLink href="/shop" size="sm" variant="secondary">
            Small link
          </ButtonLink>
        </div>
      </Panel>

      <Panel
        title="ViewAllLink"
        note="The shelf action that sits opposite a left-aligned SectionHeading. Arrow nudges right on hover."
      >
        <ViewAllLink href="/shop?sort=newest" />
      </Panel>

      <Panel title="StarRating" note="Halves render as a partially filled star.">
        <div className="flex flex-col gap-3">
          {RATING_SAMPLES.map((rating) => (
            <div key={rating} className="flex items-center gap-4">
              <span className="w-10 text-body-sm text-muted">{rating.toFixed(1)}</span>
              <StarRating value={rating} count={128} />
              <StarRating value={rating} size="md" />
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title="Price treatment"
        note="mrp is display-only. Every charged amount is computed on the server from price."
      >
        <div className="flex flex-col gap-2">
          {priceSamples.map((product) => (
            <div key={product.id} className="flex flex-wrap items-baseline gap-3">
              <span className="w-24 text-body-sm text-muted">{product.id}</span>
              <PriceDisplay mrp={product.mrp} price={product.price} />
              <PriceDisplay mrp={product.mrp} price={product.price} size="lg" />
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title="ProductCard"
        note="Real catalogue products. Cards rest flat on the hairline border with an ivory image area and no inner frame; the lift appears on hover only. The whole card links to /product/[id]; Add to cart sits above the stretched link and is the AddToCartButton island — the only part of the card that reaches the browser."
      >
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {cardSamples.map((sample) => (
            <div key={sample.caption} className="flex flex-col gap-3">
              <span className="text-eyebrow uppercase text-muted">{sample.caption}</span>
              <ProductCard product={sample.product} />
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="TrustBadge and TrustStrip">
        <div className="flex flex-col gap-8">
          <div className="max-w-xs">
            <TrustBadge
              icon={<GemOutlineIcon className="h-7 w-7" />}
              label="Single Badge"
              detail="One icon slot, one uppercase maroon serif label"
            />
          </div>
          <TrustStrip />
        </div>
      </Panel>

      <Panel
        title="ProductGrid"
        note="The reusable grid — 2 columns on mobile, 3 from md, 4 from lg. Page-agnostic: it renders whatever products it is handed. Home and the Shop page both compose it."
      >
        <ProductGrid products={featured.slice(0, 4)} />
      </Panel>

      <Panel
        title="CategoryTile"
        note="Portrait tile off /categories/{slug}.webp with a bottom scrim for label legibility and a gentle zoom on hover. The whole tile links to /shop?category={slug}."
      >
        <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
          {CATEGORIES.slice(0, 4).map((category) => (
            <li key={category.slug}>
              <CategoryTile category={category} />
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title="ProductGallery"
        note="Only rendered when a product carries more than one image. Every catalogued product currently has exactly one, so the product page renders ProductImagePanel directly and this path stays dormant — it is shown here against a synthetic two-image product so the swap logic is not shipped unseen."
      >
        <div className="max-w-sm">
          <ProductGallery
            images={[
              discountedProducts[0].images[0],
              discountedProducts[1].images[0],
            ]}
            productName={discountedProducts[0].name}
          />
        </div>
      </Panel>

      <Panel
        title="QuantityStepper"
        note="Min 1, max 10. Buttons disable at the bounds and every path — buttons, typing, paste — goes through clampQuantity, so an invalid value cannot exist. Second row is the sold-out (disabled) state."
      >
        <QuantityStepperPreview />
      </Panel>

      <Panel
        title="Product options"
        note="Six values or fewer render as radio chips; anything longer becomes a select, because twenty-five engraving letters as chips are a wall rather than a set of choices. Every group is pre-selected with its first value, so a personalized piece is addable without touching a selector, and the choice is echoed below. A recorded choice never changes a price, an image, or stock. The note is the refund policy's made-to-order carve-out, long form on the product page and short on a cart line."
      >
        <ProductOptionSelectorPreview />
      </Panel>

      <Panel
        title="TestimonialCard"
        note="Store-level testimonials, distinct from the per-product reviews on a product page. Monogram avatar from initials — no photos — alternating gold and charcoal."
      >
        <div className="bg-honey p-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {testimonials.slice(0, 3).map((testimonial, index) => (
              <TestimonialCard
                key={testimonial.name}
                testimonial={testimonial}
                accent={index % 2 === 0 ? "gold" : "charcoal"}
              />
            ))}
          </div>
        </div>
      </Panel>

      <Panel
        title="Global chrome"
        note="AnnouncementBar, Header, Footer, and WhatsAppButton are rendered by app/layout.tsx, so they wrap this page too — scroll and check them in place rather than here."
      >
        <div className="flex flex-col gap-4">
          <p className="max-w-prose text-body-sm text-muted">
            The nav is two dropdowns over one flat tier each — the ten categories a
            product belongs to, and the five collections that cut across them — plus
            About and Contact as top-level links. Every entry resolves to a{" "}
            <code className="text-ink">/shop</code> query param, so the nav, the filter
            sidebar and a pasted URL all express the same state. Both groups come from{" "}
            <code className="text-ink">CATEGORIES</code> and{" "}
            <code className="text-ink">COLLECTIONS</code>; nothing here is written twice.
          </p>
          {NAV_MENUS.map((menu) => (
            <div key={menu.key} className="flex flex-col gap-1">
              <h3 className="text-eyebrow uppercase text-gold-deep">{menu.label}</h3>
              <ul className="flex flex-col gap-1">
                {menu.items.map((item) => (
                  <li key={item.key} className="text-body-sm text-muted">
                    <span className="text-ink">{item.label}</span> →{" "}
                    <code>{item.href}</code>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="max-w-prose text-body-sm text-muted">
            The cart badge reads <code className="text-ink">itemCount</code> from{" "}
            <code className="text-ink">useCart()</code>. It renders nothing on the server
            and nothing on the first client render, then fills in once the persisted cart
            has been read — see ADR-010. The badge is hidden at 0.
          </p>
        </div>
      </Panel>

      <Panel
        title="AddToCartButton / toast"
        note="The client island a Server Component slots into a card. It takes a lean CatalogueEntry rather than a Product, adds one unit, and raises the shared toast. The sold-out entry is disabled and relabelled."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {addToCartSamples.map((sample) => (
            <div key={sample.caption} className="flex flex-col gap-3">
              <span className="text-eyebrow uppercase text-muted">{sample.caption}</span>
              <AddToCartButton item={sample.item} fullWidth />
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title="Cart summary"
        note="Three states: a subtotal at or over the free-shipping threshold, one below it showing the flat rate and the shortfall hint, and the blocked state an out-of-stock line produces. Both shipping numbers come from lib/config.ts."
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <CartSummary
            subtotal={4200}
            shipping={0}
            total={4200}
            isCheckoutBlocked={false}
          />
          <CartSummary
            subtotal={FREE_SHIPPING_THRESHOLD - 300}
            shipping={FLAT_SHIPPING_RATE}
            total={FREE_SHIPPING_THRESHOLD - 300 + FLAT_SHIPPING_RATE}
            isCheckoutBlocked={false}
          />
          <CartSummary
            subtotal={0}
            shipping={0}
            total={0}
            isCheckoutBlocked
          />
        </div>
      </Panel>

      <Panel
        title="Cart empty state"
        note="What /cart renders when the reconciled cart has no lines."
      >
        <CartEmptyState />
      </Panel>

      <Panel
        title="Form fields"
        note="TextField and SelectField, both composing FormField for the label, the error line and the aria wiring. The phone field is bound to the real validator, so the error shown is the one checkout produces. Errors move the border to sale, set aria-invalid, and point aria-describedby at the message."
      >
        <FormFieldPreview />
      </Panel>

      <Panel
        title="CheckoutSteps"
        note="Presentational only — no step is clickable. Steps before the current one read as done; the current one is marked with aria-current."
      >
        <div className="flex flex-col gap-6">
          <CheckoutSteps current={1} />
          <CheckoutSteps current={2} />
          <CheckoutSteps current={3} />
        </div>
      </Panel>

      <Panel
        title="CheckoutGuardNotice"
        note="What a checkout step renders when it is reached with nothing payable behind it. Never a redirect — it explains and offers the way back."
      >
        <CheckoutGuardNotice
          title="There is nothing to check out"
          message="Your cart is empty, so there are no delivery details to take yet. Pick something first and this step will be waiting."
        />
      </Panel>

      <Panel
        title="Prose"
        note="Long-form typography for pages written as prose rather than composed from components. It styles descendants by element, so a policy page writes plain semantic HTML. Measure is capped at max-w-prose (68ch)."
      >
        <Prose>
          <h2>A heading inside prose</h2>
          <p>
            Body copy sits at the body scale in muted, with the measure capped so a line
            never outruns comfortable reading. An <a href="/shop">inline link</a> is
            underlined in gold.
          </p>
          <h3>A subheading</h3>
          <ul>
            <li>List markers take the gold token</li>
            <li>
              <strong>Strong text</strong> lifts to ink at medium weight
            </li>
            <li>
              Inline <code>code</code> sits on an ivory ground
            </li>
          </ul>
        </Prose>
      </Panel>

      <Panel
        title="PolicyDisclaimer"
        note="Carried visibly above the content on all four policy pages. The sample copy matches how the store actually works but has not been reviewed by a lawyer, and this notice says so."
      >
        <PolicyDisclaimer />
      </Panel>

      <Panel
        title="TextAreaField"
        note="The multi-line sibling of TextField, composing the same FormField shell so the label, error line and aria wiring are identical. Used by the contact form."
      >
        <TextAreaFieldPreview />
      </Panel>

      <Panel title="Sample product record">
        <dl className="grid grid-cols-[8rem_1fr] gap-x-6 gap-y-2 text-body-sm">
          <dt className="text-muted">id</dt>
          <dd className="text-ink">{sampleProduct.id}</dd>
          <dt className="text-muted">name</dt>
          <dd className="text-ink">{sampleProduct.name}</dd>
          <dt className="text-muted">price (charged)</dt>
          <dd className="text-ink">{formatRupees(sampleProduct.price)}</dd>
          <dt className="text-muted">mrp (display only)</dt>
          <dd className="text-ink">{formatRupees(sampleProduct.mrp)}</dd>
          <dt className="text-muted">rating</dt>
          <dd className="text-ink">
            {sampleProduct.rating} from {sampleProduct.reviewCount} reviews
          </dd>
        </dl>
      </Panel>
    </div>
  );
}
