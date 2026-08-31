"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ProductImagePanel } from "@/components/ProductImagePanel";
import { CloseIcon, ZoomIcon } from "@/components/icons";

export interface ProductImageZoomProps {
  src: string | null;
  alt: string;
  priority?: boolean;
}

/**
 * The product photograph, and the tap that makes it fill the screen.
 *
 * No lightbox library. A `<dialog>` element is what the platform already provides for exactly
 * this — it takes Escape, it traps focus, it renders in the top layer above everything on the
 * page including the floating contact button, and it restores focus to whatever opened it. The
 * only thing added here is the backdrop click, which `showModal` does not close on by itself.
 *
 * A product with no photograph gets the placeholder and no zoom control: there is nothing to
 * enlarge, and a button that opens an empty overlay is worse than no button.
 *
 * The enlarged copy is a second `next/image` at full-viewport `sizes` rather than the same
 * element scaled up, so what the shopper sees at 90% of the screen is a source rendered for
 * that width instead of a card-sized file stretched to it — the whole point of tapping is to
 * look at the metalwork.
 */
export function ProductImageZoom({
  src,
  alt,
  priority = false,
}: ProductImageZoomProps): JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;

    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  if (src === null) return <ProductImagePanel src={null} alt={alt} priority={priority} />;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={`Enlarge the photograph: ${alt}`}
        className="group relative block w-full cursor-zoom-in"
      >
        <ProductImagePanel src={src} alt={alt} priority={priority} />
        <span
          aria-hidden
          className="absolute bottom-3 right-3 inline-flex h-9 w-9 items-center justify-center border border-line bg-white/90 text-muted transition-colors duration-250 group-hover:border-charcoal group-hover:text-ink"
        >
          <ZoomIcon className="h-4 w-4" />
        </span>
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setIsOpen(false)}
        onClick={(event) => {
          if (event.target === dialogRef.current) setIsOpen(false);
        }}
        className="max-h-none max-w-none bg-transparent p-0 backdrop:bg-charcoal/85"
      >
        <div className="relative flex h-screen w-screen items-center justify-center p-4 sm:p-10">
          <span className="relative block h-full w-full max-w-4xl">
            <Image
              src={src}
              alt={alt}
              fill
              sizes="100vw"
              className="object-contain"
            />
          </span>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close the enlarged photograph"
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center border border-ivory/40 bg-charcoal/70 text-ivory transition-colors duration-250 hover:border-ivory sm:right-8 sm:top-8"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
      </dialog>
    </>
  );
}
