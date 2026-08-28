import type { Metadata } from "next";
import type { Product, ProductOption } from "@/types/product";
import {
  getAllProducts,
  getFeaturedProducts,
  getImageAlts,
  getPrimaryImage,
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
import { Prose } from "@/components/Prose";
import { TextAreaFieldPreview } from "@/components/TextAreaFieldPreview";
import { ButtonLink } from "@/components/ButtonLink";
import { CategoryTile } from "@/components/CategoryTile";
import { PriceDisplay } from "@/components/PriceDisplay";
import { ProductCard } from "@/components/ProductCard";
import { ProductGallery } from "@/components/ProductGallery";
import { ProductPurchaseActions } from "@/components/ProductPurchaseActions";
import { ProductSelectionProvider } from "@/lib/product-selection";
import { ProductOptionControlsPreview } from "@/components/ProductOptionControlsPreview";
import { QuantityStepperPreview } from "@/components/QuantityStepperPreview";
import { ProductGrid } from "@/components/ProductGrid";
import { ViewAllLink } from "@/components/ViewAllLink";
import { SURFACED_CATEGORIES, getCategoryLabel } from "@/types/product";
import { SectionHeading } from "@/components/SectionHeading";
import { TrustBadge } from "@/components/TrustBadge";
import { TrustStrip } from "@/components/TrustStrip";
import { NAV_MENUS } from "@/lib/navigation";
import { ORDER_STATUSES } from "@/lib/order-status";
import { OrderStatusBadge } from "@/components/OrderStatusBadge";
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

const SHOWCASE_GALLERY_IMAGE_COUNT = 3;

/**
 * One group per control type, which is the whole point: no catalogued product carries all
 * four, and a control that has never been looked at beside its siblings is a control nobody
 * has really checked. Values are plausible rather than invented stock — this record is a
 * rendering fixture, not a piece anyone can buy.
 */
const SHOWCASE_OPTIONS: ProductOption[] = [
  {
    name: "Colour",
    type: "swatch",
    values: ["Silver", "Golden", "Rose Gold"],
    default: "Silver",
  },
  { name: "Size", type: "pills", values: ["S", "M", "L"], default: "M" },
  {
    name: "Letter",
    type: "dropdown",
    values: "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),
    default: "A",
  },
  {
    name: "Shape",
    type: "chips",
    values: ["Oval", "Heart", "Round", "Square"],
    default: "Oval",
  },
];

/**
 * Built here and nowhere else. Its id is deliberately not a P-code, so it fails the
 * catalogue's own id rule on sight and could not be pasted into `data/products.json` without
 * `validate:products` refusing it. Nothing looks it up, nothing prices it, and the buy
 * handlers it is rendered with do nothing. See ADR-027.
 */
function buildOptionControlsShowcase(images: string[]): Product {
  return {
    id: "style-guide-showcase",
    name: "Option Controls Showcase",
    category: "rings",
    status: "active",
    pricing: { price: 999, mrp: 1499, cost: 599, minPrepaidAmount: 0 },
    media: { images },
    options: SHOWCASE_OPTIONS,
    specs: { material: "Not a real piece", type: "Style guide fixture" },
    description: "A synthetic record that exists to render every option control at once.",
    seo: {
      primaryKeyword: "style guide fixture",
      secondaryKeywords: [],
      metaTitle: "Option Controls Showcase",
      metaDescription: "A synthetic record that exists to render every option control at once.",
      imageAlt: "Style guide fixture standing in for a product photograph",
      ogTitle: "Option Controls Showcase",
      ogDescription: "A synthetic record that exists to render every option control at once.",
      ogImage: images[0] ?? "",
    },
    stock: { inStock: true },
    flags: { featured: false, isNew: false },
  };
}

function withoutImages(product: Product): Product {
  return { ...product, media: { ...product.media, images: [] } };
}

function withoutDiscount(product: Product): Product {
  return { ...product, pricing: { ...product.pricing, mrp: product.pricing.price } };
}

export default function StyleGuidePage(): JSX.Element {
  const catalogue = getAllProducts();
  const featured = getFeaturedProducts();
  const discountedProducts = featured.filter((product) =>
    hasVisibleDiscount(product.pricing.mrp, product.pricing.price),
  );
  const fullPriceProduct = catalogue.find(
    (product) => !hasVisibleDiscount(product.pricing.mrp, product.pricing.price),
  );
  const soldOutProduct = catalogue.find((product) => !product.stock.inStock);
  const multiImageProduct = catalogue.find(
    (product) => product.media.images.length > 1,
  );
  const variantImageProduct = catalogue.find(
    (product) => product.media.variantImages !== undefined,
  );
  const showcaseGalleryImages = catalogue
    .slice(0, SHOWCASE_GALLERY_IMAGE_COUNT)
    .map(getPrimaryImage)
    .filter((image): image is string => image !== null);
  const optionControlsShowcase = buildOptionControlsShowcase(showcaseGalleryImages);
  const sampleProduct = discountedProducts[0];

  const addToCartSamples = [
    { caption: "In stock", item: toCatalogueEntry(discountedProducts[0]) },
    ...(soldOutProduct
      ? [{ caption: "Sold out, disabled", item: toCatalogueEntry(soldOutProduct) }]
      : []),
  ];

  const priceSamples = [discountedProducts[0], discountedProducts[1]];
  if (fullPriceProduct) priceSamples.push(fullPriceProduct);

  const cardSamples: { caption: string; product: Product }[] = [
    { caption: "Discounted", product: discountedProducts[0] },
    {
      caption: "No discount, price alone in ink",
      product: withoutDiscount(discountedProducts[1]),
    },
    {
      caption: "Empty images[], placeholder",
      product: withoutImages(discountedProducts[2]),
    },
  ];

  if (soldOutProduct) {
    cardSamples.push({ caption: "Sold out, disabled button", product: soldOutProduct });
  }

  return (
    <div className="container flex max-w-6xl flex-col gap-14 py-16">
      <header className="flex flex-col gap-4">
        <span className="text-eyebrow uppercase tracking-caps-wide text-gold-deep">
          Internal QA, not linked from the storefront
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
            <p className="text-body-lg">Body large: Jost 17px, for lead paragraphs.</p>
            <p className="text-body">Body: Jost 15px, the storefront default.</p>
            <p className="text-body-sm text-muted">Body small: Jost 13px, muted.</p>
            <p className="text-label uppercase tracking-caps">Label: uppercase, tracked</p>
            <p className="text-eyebrow uppercase tracking-caps-wide text-gold-deep">
              Eyebrow: uppercase, wide tracking
            </p>
          </div>
        </div>
      </Panel>

      <Panel
        title="SectionHeading"
        note="The signature two-tone lockup: uppercase roman, then an italic accent word. Two tones: gold on light grounds, maroon on the honey band, where gold on gold goes illegible."
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
        title="Paired calls to action"
        note="Equal width belongs to the pair, not to either button. The container declares two equal columns with a 17rem floor and each button spans its column with fullWidth, so labels of different lengths still render at identical width. One full-width column below sm."
      >
        <div className="grid w-full grid-cols-1 gap-4 sm:w-auto sm:grid-cols-[repeat(2,minmax(17rem,1fr))]">
          <ButtonLink href="/shop" fullWidth>
            Shop Collection
          </ButtonLink>
          <ButtonLink href="/shop" variant="secondary" fullWidth>
            Explore Categories
          </ButtonLink>
        </div>
      </Panel>

      <Panel
        title="ViewAllLink"
        note="The shelf action that sits opposite a left-aligned SectionHeading. Arrow nudges right on hover."
      >
        <ViewAllLink href="/shop?sort=newest" />
      </Panel>

      <Panel
        title="Price treatment"
        note="mrp is display-only. Every charged amount is computed on the server from price."
      >
        <div className="flex flex-col gap-2">
          {priceSamples.map((product) => (
            <div key={product.id} className="flex flex-wrap items-baseline gap-3">
              <span className="w-24 text-body-sm text-muted">{product.id}</span>
              <PriceDisplay mrp={product.pricing.mrp} price={product.pricing.price} />
              <PriceDisplay
                mrp={product.pricing.mrp}
                price={product.pricing.price}
                size="lg"
              />
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title="ProductCard"
        note="Real catalogue products. Cards rest flat on the hairline border with an ivory image area and no inner frame; the lift appears on hover only. The whole card links to /product/[id]; Add to cart sits above the stretched link and is the AddToCartButton island, the only part of the card that reaches the browser."
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
        note="The reusable grid: 2 columns on mobile, 3 from md, 4 from lg. Page-agnostic: it renders whatever products it is handed. Home and the Shop page both compose it."
      >
        <ProductGrid products={featured.slice(0, 4)} />
      </Panel>

      <Panel
        title="CategoryTile"
        note="Portrait tile off /categories/{slug}.webp with a bottom scrim for label legibility and a gentle zoom on hover. The whole tile links to /shop?category={slug}."
      >
        <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
          {SURFACED_CATEGORIES.slice(0, 4).map((category) => (
            <li key={category.slug}>
              <CategoryTile category={category} />
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title="ProductGallery"
        note="Rendered instead of ProductImagePanel when a product carries more than one image or maps a photograph to an option value. A single-image product with no mapping never reaches it, so the common case still ships no client JavaScript for its picture. The strip lists every photograph the product has, its own images first and then each mapped one, de-duplicated by path, so a mapped finish is reachable by clicking its thumbnail rather than only by working the selector. Clicking a mapped thumbnail also records that option value, so the swatch and the picture cannot disagree about which finish is on screen. Past five photographs the strip becomes a window with arrows either side, and the left and right arrow keys step through the whole set with focus following. Left: two images, no mapping, so no arrows. Right: the same component driven by a selector."
      >
        <div className="grid gap-10 lg:grid-cols-2">
          {multiImageProduct ? (
            <div className="flex max-w-sm flex-col gap-3">
              <p className="text-body-sm text-muted">
                Multi-image: {multiImageProduct.name}
              </p>
              <ProductSelectionProvider>
                <ProductGallery
                  images={multiImageProduct.media.images}
                  imageAlts={getImageAlts(multiImageProduct)}
                />
              </ProductSelectionProvider>
            </div>
          ) : null}

          {variantImageProduct ? (
            <div className="flex max-w-sm flex-col gap-3">
              <p className="text-body-sm text-muted">
                Per-variant: {variantImageProduct.name}
              </p>
              <ProductSelectionProvider options={variantImageProduct.options}>
                <ProductGallery
                  images={variantImageProduct.media.images}
                  imageAlts={getImageAlts(variantImageProduct)}
                  variantImages={variantImageProduct.media.variantImages}
                />
                <ProductPurchaseActions
                  item={toCatalogueEntry(variantImageProduct)}
                />
              </ProductSelectionProvider>
            </div>
          ) : null}
        </div>
      </Panel>

      <Panel
        title="QuantityStepper"
        note="Min 1, max 10. Buttons disable at the bounds and every path, whether buttons, typing or paste, goes through clampQuantity, so an invalid value cannot exist. Second row is the sold-out (disabled) state."
      >
        <QuantityStepperPreview />
      </Panel>

      <Panel
        title="Product Option Controls"
        note="All four control types on one screen, which no catalogued product can show: the real catalogue spreads dropdown, swatch and chips across five products and uses pills nowhere. The piece driving this panel is synthetic and lives in this file only. It is not in data/products.json, so it cannot appear in the shop, be found by an id, or reach a cart, and Add to cart and Buy now are inert here. Everything else is the real thing: the same ProductSelectionProvider, the same ProductPurchasePanel, the same four controls, the same spacing as the product page's info column. Dropdown for a long list to find your place in (Letter, as on P001 and P005), swatch for a finish (Colour, as on P010 and P048), pills for a point on a scale (Size, which no real product carries yet), chips for a set to compare (Shape, as on P006). Every group is pre-selected with its stated default; the table below reads each group's control and current value apart, where the panel's own summary reads them together as a shopper sees them. A recorded choice can change which photograph is shown; it never changes a price or stock."
      >
        <ProductSelectionProvider options={optionControlsShowcase.options}>
          <ProductOptionControlsPreview
            item={toCatalogueEntry(optionControlsShowcase)}
            galleryImages={optionControlsShowcase.media.images}
            galleryImageAlts={getImageAlts(optionControlsShowcase)}
          />
        </ProductSelectionProvider>
      </Panel>

      <Panel
        title="Global chrome"
        note="Header, Footer, and WhatsAppButton are rendered by app/layout.tsx, so they wrap this page too, so scroll and check them in place rather than here. The rotating announcement now sits in the middle of the header's logo row rather than in a strip of its own, and is hidden below lg."
      >
        <div className="flex flex-col gap-4">
          <p className="max-w-prose text-body-sm text-muted">
            The nav is two dropdowns over one flat tier each: the categories a shopper
            can browse, and the four collections that cut across them, plus About and
            Contact as top-level links. Every entry resolves to a{" "}
            <code className="text-ink">/shop</code> query param, so the nav, the filter
            sidebar and a pasted URL all express the same state. Both groups come from{" "}
            <code className="text-ink">SURFACED_CATEGORIES</code> and{" "}
            <code className="text-ink">COLLECTIONS</code>; nothing here is written twice. A
            category agreed before its products exist sits in{" "}
            <code className="text-ink">CATEGORIES</code> only, and reaches none of these
            surfaces until its flag is flipped.
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
            has been read. See ADR-010. The badge is hidden at 0.
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
        note="Presentational only, no step is clickable. Steps before the current one read as done; the current one is marked with aria-current."
      >
        <div className="flex flex-col gap-6">
          <CheckoutSteps current={1} />
          <CheckoutSteps current={2} />
          <CheckoutSteps current={3} />
        </div>
      </Panel>

      <Panel
        title="CheckoutGuardNotice"
        note="What a checkout step renders when it is reached with nothing payable behind it. Never a redirect. It explains and offers the way back."
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
        title="TextAreaField"
        note="The multi-line sibling of TextField, composing the same FormField shell so the label, error line and aria wiring are identical. Used by the contact form."
      >
        <TextAreaFieldPreview />
      </Panel>

      <Panel
        title="Order status badges"
        note="Admin-only, and the one part of this page a shopper never sees. Seven fulfilment statuses, each with its own hue from the status-* token group, all sharing one shape so the colour is the only variable. The label is always written out: the hue makes a fifty-row list scannable, it is never what makes a row readable."
      >
        <div className="flex flex-wrap gap-3">
          {ORDER_STATUSES.map((status) => (
            <OrderStatusBadge key={status} status={status} />
          ))}
        </div>
      </Panel>

      <Panel title="Sample product record">
        <dl className="grid grid-cols-[8rem_1fr] gap-x-6 gap-y-2 text-body-sm">
          <dt className="text-muted">id</dt>
          <dd className="text-ink">{sampleProduct.id}</dd>
          <dt className="text-muted">name</dt>
          <dd className="text-ink">{sampleProduct.name}</dd>
          <dt className="text-muted">price (charged)</dt>
          <dd className="text-ink">{formatRupees(sampleProduct.pricing.price)}</dd>
          <dt className="text-muted">mrp (display only)</dt>
          <dd className="text-ink">{formatRupees(sampleProduct.pricing.mrp)}</dd>
          <dt className="text-muted">category</dt>
          <dd className="text-ink">{getCategoryLabel(sampleProduct.category)}</dd>
        </dl>
      </Panel>
    </div>
  );
}
