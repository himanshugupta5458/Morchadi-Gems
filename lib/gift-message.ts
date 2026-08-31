/**
 * The longest gift note this shop will record.
 *
 * Three hundred characters is about what fits on a card in a parcel, which is the length the
 * field exists to hold. The number is enforced three times over and deliberately so: the
 * textarea stops accepting at it, `parseGiftMessage` truncates at it whatever the browser sent,
 * and `orders.gift_message` is a `VARCHAR(300)` so a row that somehow carried more would fail to
 * insert rather than quietly become the longest column in the table.
 */
export const GIFT_MESSAGE_MAX_LENGTH = 300;

/**
 * Control characters have no place in a note that is printed on a card and read on an admin
 * screen. Newlines survive — a note is written in lines — and everything else in the C0 and C1
 * ranges is dropped rather than escaped.
 */
const CONTROL_CHARACTERS = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/g;

/**
 * A gift note as the order row will hold it, or **null** for a request that sent none.
 *
 * **Nothing here can change what an order costs.** The note is free text from a browser, it is
 * carried alongside the priced order rather than through it, and no function that decides an
 * amount is ever given it — `buildOrderFromCart` and `resolvePaymentPlan` never see it, and
 * `lib/gift-message.test.ts` is the standing proof that a 10,000-character note, a note full of
 * digits, and a note that is an object rather than a string all leave the total exactly where it
 * was.
 *
 * Every malformed value becomes `null` rather than a refusal, for the same reason a failed
 * WhatsApp message is not an error: a gift note is a courtesy layered on a working checkout, and
 * losing one must never become a new way for a paid order to fail. Over-long text is truncated
 * rather than refused on the same principle — the shopper wrote something, and 300 characters of
 * it is closer to their intent than nothing at all.
 */
export function parseGiftMessage(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const cleaned = value.replace(CONTROL_CHARACTERS, "").trim();
  if (cleaned.length === 0) return null;

  return cleaned.slice(0, GIFT_MESSAGE_MAX_LENGTH);
}
