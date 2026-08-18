import Link from "next/link";

export interface PaymentErrorAction {
  href: string;
  label: string;
}

export interface PaymentErrorNoticeProps {
  title: string;
  message: string;
  details: string[];
  action?: PaymentErrorAction;
}

/**
 * Why a payment could not be started, stated in the shopper's terms. It never shows a status
 * code or an upstream message — the route does not send either — and it always leaves a way
 * forward, whether that is retrying the button below it or fixing something on another page.
 */
export function PaymentErrorNotice({
  title,
  message,
  details,
  action,
}: PaymentErrorNoticeProps): JSX.Element {
  return (
    <div
      role="alert"
      className="border border-gold bg-ivory p-6 text-body-sm text-muted"
    >
      <p className="font-display text-heading-sm text-ink">{title}</p>
      <p className="mt-2">{message}</p>

      {details.length > 0 ? (
        <ul className="mt-4 flex list-disc flex-col gap-1 pl-5">
          {details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      ) : null}

      {action === undefined ? null : (
        <Link
          href={action.href}
          className="mt-4 inline-block text-ink underline underline-offset-4 transition-colors duration-250 hover:text-gold"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
