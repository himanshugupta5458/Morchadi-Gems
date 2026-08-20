import "server-only";
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * The characters an order id is barred from containing: zero, capital O, one, capital I and
 * capital L. Every one of them is a pair that a person cannot tell apart in a sans-serif font,
 * on a courier's label, or over a phone call — and reading an order number aloud over WhatsApp
 * is the normal way this shop is contacted.
 */
export const ORDER_ID_EXCLUDED_CHARACTERS = "0O1IL";

/**
 * Uppercase alphanumerics minus `ORDER_ID_EXCLUDED_CHARACTERS`: the digits 2-9 and the
 * twenty-three unambiguous capitals. Thirty-one characters, and the derivation is written out
 * here rather than typed as a literal so the constant and the exclusion list cannot drift.
 */
export const ORDER_ID_ALPHABET = Array.from("23456789ABCDEFGHIJKLMNOPQRSTUVWXYZ")
  .filter((character) => !ORDER_ID_EXCLUDED_CHARACTERS.includes(character))
  .join("");

/**
 * Ten characters over a 31-character alphabet is 31^10 ≈ 8.2 × 10^14 ids — roughly a
 * one-in-eight-hundred-million chance of a collision at a million orders. Short enough to be
 * read aloud and typed into a tracking box, long enough that the retry below is a backstop
 * rather than a mechanism.
 */
export const ORDER_ID_LENGTH = 10;

/**
 * How many candidates are drawn before capture gives up. At the collision probability above,
 * needing a second one is already implausible and needing an eighth is not physically going to
 * happen — this bound exists so that a *broken* uniqueness check (a database that answers
 * "taken" to everything) fails loudly and finitely rather than spinning forever inside a
 * checkout request.
 */
export const MAX_ORDER_ID_ATTEMPTS = 8;

/** Answers whether an order already carries this id. Injected so the retry can be tested. */
export type OrderIdTakenCheck = (candidate: string) => Promise<boolean>;

/**
 * One candidate, drawn from `node:crypto`.
 *
 * `randomInt` rather than `randomBytes(n)[i] % 31`: 256 is not a multiple of 31, so the naive
 * modulo would make the first eight characters of the alphabet measurably likelier than the
 * rest. `randomInt` rejects and redraws out-of-range values, so every character is uniform.
 * `Math.random` is not used and must not be — these ids are guessable-by-design only in the
 * sense that they are short, and an order id is what `/order-confirmation` is keyed on.
 */
export function generateOrderIdCandidate(): string {
  let candidate = "";
  for (let position = 0; position < ORDER_ID_LENGTH; position += 1) {
    candidate += ORDER_ID_ALPHABET[randomInt(ORDER_ID_ALPHABET.length)];
  }
  return candidate;
}

async function isOrderIdTakenInDatabase(candidate: string): Promise<boolean> {
  const existing = await prisma.order.findUnique({
    where: { id: candidate },
    select: { id: true },
  });

  return existing !== null;
}

/**
 * The customer-facing order id, guaranteed free at the moment it is returned.
 *
 * Called once, at capture time, and never again for an order that already has one: the id is
 * printed on a label, quoted in a WhatsApp message and typed into a tracking box, so
 * regenerating it would invalidate every copy of it that has left the building. There is
 * deliberately no "reissue" function here for that reason.
 *
 * The uniqueness check is a real query rather than a trust in the arithmetic. `Order.id` is the
 * primary key, so a duplicate would be a failed insert in the middle of a paid checkout; asking
 * first turns that into a redraw. Exhausting `MAX_ORDER_ID_ATTEMPTS` throws, and the caller
 * ([`lib/order-capture.ts`](./order-capture.ts)) treats that like every other capture failure —
 * logged, and never allowed to reach the shopper.
 */
export async function generateUniqueOrderId(
  isTaken: OrderIdTakenCheck = isOrderIdTakenInDatabase,
): Promise<string> {
  for (let attempt = 0; attempt < MAX_ORDER_ID_ATTEMPTS; attempt += 1) {
    const candidate = generateOrderIdCandidate();
    if (!(await isTaken(candidate))) return candidate;
  }

  throw new Error(
    `Could not find a free order id in ${MAX_ORDER_ID_ATTEMPTS} attempts`,
  );
}
