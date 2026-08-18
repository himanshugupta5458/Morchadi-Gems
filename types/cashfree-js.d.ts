declare module "@cashfreepayments/cashfree-js" {
  import type { CashfreeMode } from "@/types/order";

  export interface CashfreeCheckoutOptions {
    paymentSessionId: string;
    redirectTarget?: "_self" | "_blank" | "_top" | "_modal";
  }

  export interface CashfreeCheckoutResult {
    error?: { message?: string };
    redirect?: boolean;
  }

  export interface CashfreeInstance {
    checkout(
      options: CashfreeCheckoutOptions,
    ): Promise<CashfreeCheckoutResult | undefined>;
  }

  /**
   * Resolves to null when called during a server render — the loader is isomorphic by
   * design and refuses to inject a script without a document. `strict: true` plus no
   * declaration file in the published package would otherwise force an `any` at the call
   * site, which `CLAUDE.md` forbids; this file is the alternative.
   */
  export function load(options: {
    mode: CashfreeMode;
  }): Promise<CashfreeInstance | null>;
}
