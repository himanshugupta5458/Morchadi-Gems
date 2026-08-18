import { CONTACT_CONFIG } from "@/lib/config";
import { WhatsAppIcon } from "@/components/icons";

const detailHeadingClasses = "text-eyebrow uppercase text-muted";
const detailLinkClasses =
  "text-body text-ink underline decoration-gold underline-offset-4 transition-colors duration-250 hover:text-gold-deep";

/**
 * Every value here comes from `CONTACT_CONFIG` in `lib/config.ts`, so replacing the
 * placeholders with the real business details is a one-file change that updates this page,
 * the policies and the footer at once.
 */
export function ContactDetails(): JSX.Element {
  return (
    <div className="flex flex-col gap-8 border border-line bg-ivory p-6 lg:p-8">
      <div className="flex flex-col gap-2">
        <h2 className={detailHeadingClasses}>Email</h2>
        <a
          href={`mailto:${CONTACT_CONFIG.supportEmail}`}
          className={detailLinkClasses}
        >
          {CONTACT_CONFIG.supportEmail}
        </a>
        <p className="text-body-sm text-muted">
          We reply within {CONTACT_CONFIG.replyWindow}.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className={detailHeadingClasses}>Phone</h2>
        <a href={CONTACT_CONFIG.phoneHref} className={detailLinkClasses}>
          {CONTACT_CONFIG.phoneDisplay}
        </a>
        <p className="text-body-sm text-muted">{CONTACT_CONFIG.hours}</p>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className={detailHeadingClasses}>WhatsApp</h2>
        <p className="flex items-center gap-2 text-body text-ink">
          <WhatsAppIcon className="h-5 w-5 shrink-0 text-whatsapp" />
          Use the chat button in the corner
        </p>
        <p className="text-body-sm text-muted">
          Quickest for a question about sizing or an order in flight.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className={detailHeadingClasses}>Registered address</h2>
        <address className="not-italic text-body text-ink">
          {CONTACT_CONFIG.addressLines.map((addressLine) => (
            <span key={addressLine} className="block">
              {addressLine}
            </span>
          ))}
        </address>
      </div>
    </div>
  );
}
