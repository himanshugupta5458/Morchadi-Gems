"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Address } from "@/types/cart";
import { submitAdminOrderAction } from "@/lib/admin-order-client";
import type { AddressFormValues } from "@/lib/address";
import { AddressForm } from "@/components/AddressForm";
import { Button } from "@/components/Button";

export interface AdminOrderAddressPanelProps {
  actionHref: string;
  address: AddressFormValues;
  /** True only while the order is `placed` or `packed` — see `isShippingAddressEditable`. */
  isEditable: boolean;
  /** Why editing is closed, shown in place of the edit control once the parcel has left. */
  lockedNote: string;
}

function AddressLines({ address }: { address: AddressFormValues }): JSX.Element {
  const lines = [
    address.name,
    address.line1,
    address.line2,
    `${address.city}, ${address.state} ${address.pincode}`.trim(),
    address.phone,
    address.email,
  ].filter((line) => line.trim().length > 0);

  return (
    <address className="flex flex-col gap-1 not-italic text-body-sm text-ink">
      {lines.map((line) => (
        <span key={line}>{line}</span>
      ))}
    </address>
  );
}

/**
 * Where the order is going, and — while that is still a thing anyone can act on — a way to fix
 * it.
 *
 * The owner's rule is that an address may be corrected before the parcel leaves and not after,
 * so this renders as plain text the moment the order is `shipped` or has finished. The edit
 * control is not merely disabled: a greyed-out button invites an operator to look for the
 * reason it is greyed out, and the sentence beside it is that reason.
 *
 * The form is the storefront's own `AddressForm`, not a copy of it. An address corrected here
 * is held to exactly the rules a shopper's was — the same ten-digit mobile check, the same
 * list of states, the same PIN code pattern — which is only true because it is literally the
 * same component and the same validator, run again on the server before the write.
 *
 * Saving reloads the page's server data rather than patching what is on screen, because the
 * edit also writes an audit row that the timeline below is showing.
 */
export function AdminOrderAddressPanel({
  actionHref,
  address,
  isEditable,
  lockedNote,
}: AdminOrderAddressPanelProps): JSX.Element {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(corrected: Address): Promise<void> {
    setIsSaving(true);
    setError(null);

    const result = await submitAdminOrderAction(actionHref, {
      ...corrected,
      line2: corrected.line2 ?? "",
    });

    setIsSaving(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setIsEditing(false);
    router.refresh();
  }

  if (!isEditable) {
    return (
      <div className="flex flex-col gap-4">
        <AddressLines address={address} />
        <p className="text-body-sm text-muted">{lockedNote}</p>
      </div>
    );
  }

  if (!isEditing) {
    return (
      <div className="flex flex-col gap-4">
        <AddressLines address={address} />
        <div>
          <Button variant="secondary" size="sm" onClick={() => setIsEditing(true)}>
            Edit address
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <AddressForm
        initialValues={address}
        submitLabel={isSaving ? "Saving…" : "Save corrected address"}
        isSubmitting={isSaving}
        onSubmit={(corrected) => void handleSubmit(corrected)}
      />

      {error === null ? null : <p className="text-body-sm text-sale">{error}</p>}

      <div>
        <Button
          variant="secondary"
          size="sm"
          disabled={isSaving}
          onClick={() => {
            setIsEditing(false);
            setError(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
