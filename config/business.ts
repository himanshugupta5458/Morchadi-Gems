/**
 * The business identity of Morchadi Gems, in one editable file.
 *
 * This is the file the owner edits when a business detail changes — a new support inbox, a
 * new phone number, a move to a different address. Nothing else in the repository writes any
 * of these values down: `lib/config.ts` reads them from here and every page, policy and
 * component reads them from `lib/config.ts`. Change a field below and the header, footer,
 * contact page, all four policies and the WhatsApp button follow.
 *
 * Plain data only. No logic, no formatting, no derived values — anything computed from these
 * fields (a `tel:` href, a wa.me link) is derived in `lib/config.ts` so this file stays safe
 * to edit without reading any code.
 */
export const BUSINESS = {
  /** Registered entity that operates the store. Appears in the terms and privacy policies. */
  legalEntityName: "Morchadi Enterprise",

  /** Customer-facing store name. Appears in the wordmark, page titles and share cards. */
  brandName: "Morchadi Gems",

  /** Courts of this city and state govern the terms. */
  jurisdictionCity: "Jaipur",
  jurisdictionState: "Rajasthan",

  /** The single inbox for support, order, returns and privacy enquiries. */
  supportEmail: "admin@morchadigems.com",

  /** Phone number as a shopper should read it. The `tel:` link is derived from these digits. */
  phoneDisplay: "+91 9358358834",

  /**
   * WhatsApp number in wa.me form: country code first, digits only, no `+`, no spaces.
   * Kept separate from `phoneDisplay` so the chat number can differ from the phone number.
   */
  whatsappNumber: "919358358834",

  /** Registered postal address, one line per line as it should be displayed. */
  addressLines: [
    "203, Sunpro Kedarnath, Mangyawas Road",
    "Geetanjali Colony, Mansarovar",
    "Jaipur, Rajasthan 302020",
  ],
} as const;
