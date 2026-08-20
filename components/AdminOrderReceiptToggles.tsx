"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { submitAdminOrderAction } from "@/lib/admin-order-client";

export interface AdminOrderReceiptToggle {
  /** The body key the endpoint reads — `itemReceivedBack` or `codAmountCollected`. */
  field: "itemReceivedBack" | "codAmountCollected";
  label: string;
  description: string;
  isOn: boolean;
  /** The recorded moment, already formatted on the server, or null while the toggle is off. */
  recordedAt: string | null;
}

export interface AdminOrderReceiptTogglesProps {
  actionHref: string;
  toggles: readonly AdminOrderReceiptToggle[];
}

/**
 * The facts that arrive on their own schedule.
 *
 * A courier turns a parcel around on Tuesday and the box reaches the shelf the following
 * Monday; a COD remittance is reconciled whenever the courier settles. Neither is part of the
 * status change that made it relevant, so neither is bundled into one — each is its own
 * request naming only its own field, which is what makes them independently toggleable and
 * what stops one from clearing the other.
 *
 * Each toggle posts as it is switched rather than waiting for a save button. There is one
 * boolean in flight and nothing to review before committing it, and a save button beside a
 * single checkbox is a second click asking the operator to confirm the click they just made.
 */
export function AdminOrderReceiptToggles({
  actionHref,
  toggles,
}: AdminOrderReceiptTogglesProps): JSX.Element {
  const router = useRouter();
  const [savingField, setSavingField] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle(field: string, isOn: boolean): Promise<void> {
    setSavingField(field);
    setError(null);

    const result = await submitAdminOrderAction(actionHref, { [field]: isOn });

    setSavingField(null);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {toggles.map((toggle) => (
        <label key={toggle.field} className="flex items-start gap-3">
          <input
            type="checkbox"
            name={toggle.field}
            checked={toggle.isOn}
            disabled={savingField !== null}
            onChange={(event) => void handleToggle(toggle.field, event.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 accent-charcoal"
          />
          <span className="flex flex-col gap-1">
            <span className="text-body-sm text-ink">{toggle.label}</span>
            <span className="text-body-sm text-muted">
              {toggle.isOn && toggle.recordedAt !== null
                ? `Recorded ${toggle.recordedAt}`
                : toggle.description}
            </span>
          </span>
        </label>
      ))}

      {error === null ? null : <p className="text-body-sm text-sale">{error}</p>}
    </div>
  );
}
