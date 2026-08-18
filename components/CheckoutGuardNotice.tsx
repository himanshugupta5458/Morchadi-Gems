import { CART_PATH } from "@/lib/navigation";
import { SHOP_PATH } from "@/lib/shop-query";
import { ButtonLink } from "@/components/ButtonLink";
import { CenteredNotice } from "@/components/CenteredNotice";
import { GemOutlineIcon } from "@/components/icons";

export interface CheckoutGuardAction {
  href: string;
  label: string;
}

export interface CheckoutGuardNoticeProps {
  title: string;
  message: string;
  /**
   * Replaces the default primary button when the way out of this particular guard is not the
   * cart — a payment step reached without an address wants `/address`, not `/cart`. The cart
   * link stays as the secondary route.
   */
  action?: CheckoutGuardAction;
}

/**
 * Shown when a checkout step is reached with nothing payable behind it. It explains and
 * offers the way back rather than redirecting: a redirect fired from an effect races the
 * cart's own hydration, and a checkout that bounces the shopper somewhere unannounced reads
 * as a fault. See ADR-011.
 */
export function CheckoutGuardNotice({
  title,
  message,
  action,
}: CheckoutGuardNoticeProps): JSX.Element {
  return (
    <CenteredNotice
      icon={<GemOutlineIcon className="h-12 w-12 text-gold" />}
      title={title}
      message={message}
      actions={
        action === undefined ? (
          <>
            <ButtonLink href={CART_PATH}>Back to cart</ButtonLink>
            <ButtonLink href={SHOP_PATH} variant="secondary">
              Continue shopping
            </ButtonLink>
          </>
        ) : (
          <>
            <ButtonLink href={action.href}>{action.label}</ButtonLink>
            <ButtonLink href={CART_PATH} variant="secondary">
              Back to cart
            </ButtonLink>
          </>
        )
      }
    />
  );
}
