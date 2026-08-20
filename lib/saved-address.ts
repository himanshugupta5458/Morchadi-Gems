import { isIndianState, type Address } from "@/types/cart";
import {
  ADDRESS_FIELDS,
  EMPTY_ADDRESS_FORM,
  toAddressFormValues,
  type AddressFormValues,
} from "@/lib/address";

/**
 * Where a returning shopper's delivery details are kept, and the one place in this project
 * that writes to `localStorage` rather than `sessionStorage`.
 *
 * The distinction is the whole point. The checkout bundle
 * ([`CHECKOUT_STORAGE_KEY`](./checkout.ts)) is `sessionStorage` because it exists to survive
 * one redirect to Cashfree and must not outlive the tab; this exists to survive a fortnight and
 * a closed browser, because a second order is the thing it is for.
 *
 * It is convenience data and nothing else. It is never read by the server, never sent anywhere,
 * and carries no order, no amount and no identifier — a saved address becomes a request only
 * when the shopper submits the form it filled in, along the same path a typed address takes.
 * There are still no accounts ([ADR-001](/docs/decisions/ADR-001-tech-stack.md)): this is the
 * browser remembering what its owner typed, not the shop remembering who they are.
 */
export const SAVED_ADDRESS_STORAGE_KEY = "morchadi-address-v1";

/**
 * A ceiling on any one stored field, well above the longest real value the form accepts
 * (`lib/address.ts` caps an address line at 120) and far below anything worth carrying.
 *
 * This guards the read rather than the write: what comes back is whatever is under a key any
 * script on this origin can set, so a value arriving here has not necessarily been through the
 * form's validation even though everything this module writes has.
 */
const MAX_STORED_FIELD_LENGTH = 200;

function readStoredField(candidate: Record<string, unknown>, field: string): string | null {
  const value = candidate[field];
  if (typeof value !== "string") return null;
  return value.length > MAX_STORED_FIELD_LENGTH ? null : value;
}

/**
 * A stored address, or null if what came back is not one.
 *
 * Every field must be a string of a sane length or the whole record is discarded — a partially
 * salvaged address would pre-fill some boxes and silently drop others, which reads to a shopper
 * as the form having lost their details rather than as never having had them.
 *
 * A state that is not one of the twenty-eight is the single exception, and it is blanked rather
 * than fatal: the field is a `<select>`, an unrecognised value cannot be an option in it, and
 * every other line of a real address is still worth restoring. The form asks for the state
 * again, and `validateAddressForm` refuses the submission until it is answered.
 */
export function parseSavedAddress(rawValue: string | null): AddressFormValues | null {
  if (rawValue === null) return null;

  let parsedValue: unknown;
  try {
    parsedValue = JSON.parse(rawValue);
  } catch {
    return null;
  }

  if (typeof parsedValue !== "object" || parsedValue === null) return null;
  const candidate = parsedValue as Record<string, unknown>;

  const restored: AddressFormValues = { ...EMPTY_ADDRESS_FORM };

  for (const field of ADDRESS_FIELDS) {
    const value = readStoredField(candidate, field);
    if (value === null) return null;
    restored[field] = value;
  }

  return isIndianState(restored.state) ? restored : { ...restored, state: "" };
}

/**
 * Remembers one address for next time, and reports whether it landed.
 *
 * `localStorage` throws in some private-browsing modes and when the quota is full, and a
 * shopper who has just paid must not see an error because a convenience could not be cached —
 * the same reasoning, and the same shape, as `writeCheckoutData`.
 */
export function saveAddressForNextTime(address: Address): boolean {
  if (typeof window === "undefined") return false;

  try {
    window.localStorage.setItem(
      SAVED_ADDRESS_STORAGE_KEY,
      JSON.stringify(toAddressFormValues(address)),
    );
    return true;
  } catch {
    return false;
  }
}

export function readSavedAddress(): AddressFormValues | null {
  if (typeof window === "undefined") return null;

  try {
    return parseSavedAddress(window.localStorage.getItem(SAVED_ADDRESS_STORAGE_KEY));
  } catch {
    return null;
  }
}

/**
 * Forgets the saved address. The shopper's own decision, taken from the link beside the
 * pre-filled form — someone sending this order to a different person should not have to clear
 * eight boxes by hand, and should not have to wonder whether the details are still on the
 * machine afterwards.
 */
export function clearSavedAddress(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(SAVED_ADDRESS_STORAGE_KEY);
  } catch {
    return;
  }
}
