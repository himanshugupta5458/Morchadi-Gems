"use client";

import Image from "next/image";
import type { PhotographChoice, VariantImageDraft } from "@/lib/admin-product-form";
import { parseVariantImageKey } from "@/lib/variant-images";

export interface AdminVariantImagePickerProps {
  rows: readonly VariantImageDraft[];
  choices: readonly PhotographChoice[];
  onAssign: (key: string, image: string) => void;
}

/** The first choice in every group: this value gets no photograph of its own. */
const DEFAULT_PHOTOGRAPH_CHOICE_LABEL = "Default photo";

/** `Colour:Rose-gold` read back as the sentence an operator would say. */
export function variantRowTitle(key: string): string {
  const owner = parseVariantImageKey(key);
  return owner === null ? key : `${owner.optionName}: ${owner.value}`;
}

function ChoiceTile({
  isSelected,
  children,
}: {
  isSelected: boolean;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <span
      className={
        isSelected
          ? "flex w-24 flex-col items-center gap-1.5 border-2 border-gold bg-white p-1.5 text-center"
          : "flex w-24 flex-col items-center gap-1.5 border-2 border-transparent bg-white p-1.5 text-center transition-colors duration-250 hover:border-line"
      }
    >
      {children}
    </span>
  );
}

/**
 * Pairing an option value with one of the photographs the product already has, by looking at them.
 *
 * **What this replaces.** Until now each option value had a bare text input holding a path, with
 * the product's photographs listed as unclickable `<code>` further down the same tab. Assigning a
 * photograph meant reading a path off one part of the screen and retyping it into another, and a
 * typo produced a record that pointed at a file that was not there — a class of mistake the
 * operator had no way to see and the form had no way to prevent.
 *
 * Each value is a radio group over the photographs on the record, with "uses the default
 * photograph" as the first choice rather than as the absence of one. That is the state the old
 * blank input could not distinguish from an unfinished edit, and it is the common case: most
 * products are photographed once.
 *
 * **The choices are the product's whole gallery, not `media.images`.** In this catalogue no
 * variant photograph is listed in `media.images` — every existing mapping points at a file beside
 * them — so a picker offering `media.images` alone would show every real mapping as unassigned.
 * `photographChoicesFor` is what settles that; the reasoning is there and in
 * [ADR-065](/docs/decisions/ADR-065-admin-sidebar-export-and-variant-picker.md).
 *
 * Nothing here uploads, replaces or deletes a file. It writes the same `media.variantImages` map
 * the text inputs wrote, one path per key, and the save it produces is byte-identical.
 */
export function AdminVariantImagePicker({
  rows,
  choices,
  onAssign,
}: AdminVariantImagePickerProps): JSX.Element {
  return (
    <div className="flex flex-col gap-5">
      {rows.map((row) => {
        const groupName = `variant-image-${row.key}`;
        const isMapped = row.image !== "";
        const isKnownPhotograph = choices.some((choice) => choice.src === row.image);

        return (
          <fieldset key={row.key} className="flex flex-col gap-3 border border-line bg-ivory px-4 py-4">
            <legend className="px-1 font-sans text-label uppercase tracking-caps text-ink">
              {variantRowTitle(row.key)}
            </legend>

            <p className="text-body-sm text-muted">
              {isMapped
                ? "Shown when a shopper picks this value."
                : "No photograph of its own, so the product's primary photograph is shown."}
            </p>

            <div className="flex flex-wrap items-start gap-2">
              <label className="cursor-pointer">
                <input
                  type="radio"
                  name={groupName}
                  value=""
                  checked={!isMapped}
                  onChange={() => onAssign(row.key, "")}
                  className="sr-only"
                />
                <ChoiceTile isSelected={!isMapped}>
                  <span
                    aria-hidden="true"
                    className="flex h-16 w-16 items-center justify-center border border-dashed border-line text-eyebrow uppercase tracking-caps-wide text-muted"
                  >
                    None
                  </span>
                  <span className="text-body-sm leading-tight text-muted">
                    {DEFAULT_PHOTOGRAPH_CHOICE_LABEL}
                  </span>
                </ChoiceTile>
              </label>

              {choices.map((choice) => (
                <label key={choice.src} className="cursor-pointer">
                  <input
                    type="radio"
                    name={groupName}
                    value={choice.src}
                    checked={row.image === choice.src}
                    onChange={() => onAssign(row.key, choice.src)}
                    className="sr-only"
                  />
                  <ChoiceTile isSelected={row.image === choice.src}>
                    <Image
                      src={choice.src}
                      alt=""
                      width={64}
                      height={64}
                      className="h-16 w-16 object-cover"
                    />
                    <span className="text-body-sm leading-tight text-muted">{choice.label}</span>
                  </ChoiceTile>
                </label>
              ))}

              {isMapped && !isKnownPhotograph ? (
                <label className="cursor-pointer">
                  <input
                    type="radio"
                    name={groupName}
                    value={row.image}
                    checked
                    onChange={() => onAssign(row.key, row.image)}
                    className="sr-only"
                  />
                  <ChoiceTile isSelected>
                    <Image
                      src={row.image}
                      alt=""
                      width={64}
                      height={64}
                      className="h-16 w-16 object-cover"
                    />
                    <span className="text-body-sm leading-tight text-muted">Current photo</span>
                  </ChoiceTile>
                </label>
              ) : null}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
