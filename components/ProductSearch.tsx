"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { formatRupees } from "@/lib/format";
import {
  SEARCH_QUERY_PARAM,
  SEARCH_SUGGESTION_LIMIT,
  isSearchableTerm,
  type ProductSearchHit,
  type ProductSearchResults,
} from "@/lib/product-search";
import { SHOP_PATH } from "@/lib/shop-query";
import { fieldBorderClasses, fieldControlClasses } from "@/components/FormField";
import { ProductImagePlaceholder } from "@/components/ProductImagePlaceholder";
import { SearchIcon } from "@/components/icons";

/**
 * How long the box waits after the last keystroke before asking. Short enough to feel like it
 * is keeping up, long enough that typing "bracelet" is one request rather than eight.
 */
const KEYSTROKE_DEBOUNCE_MS = 180;

const NO_RESULTS: ProductSearchResults = { hits: [], total: 0 };

function buildSearchHref(term: string): string {
  return `${SHOP_PATH}?${SEARCH_QUERY_PARAM}=${encodeURIComponent(term)}`;
}

/**
 * The home page's search box: type, and the matching pieces appear under it.
 *
 * **A `GET` form first, an autocomplete second.** The markup is a real form pointed at `/shop`
 * with the input named `q`, so pressing Enter finds things whether or not the JavaScript
 * arrived — the dropdown is an enhancement over a working control, the same shape
 * `OrderTrackingForm` takes and for the same reason.
 *
 * It asks `/api/search` rather than holding the catalogue, because 449 records of suggestion
 * data is about 50KB every visitor would download on the chance they search. The route ranks
 * with `searchProducts`, and `/shop?q=` filters with `matchesSearchTerm` from the same module,
 * so "see all results" lands on the set these suggestions were drawn from.
 *
 * A term matching more pieces than the dropdown can hold ends with a link to that set rather
 * than a longer list: eight rows is what fits above the fold on a phone, and the ninth would
 * push the first out of sight.
 */
export function ProductSearch(): JSX.Element {
  const router = useRouter();
  const listboxId = useId();
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<ProductSearchResults>(NO_RESULTS);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isSearchableTerm(term)) {
      setResults(NO_RESULTS);
      return;
    }

    const abortController = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/search?${SEARCH_QUERY_PARAM}=${encodeURIComponent(term)}`, {
        signal: abortController.signal,
      })
        .then((response) => (response.ok ? response.json() : NO_RESULTS))
        .then((answered: ProductSearchResults) => {
          setResults(answered);
          setActiveIndex(-1);
        })
        /**
         * A search box that cannot reach its route is a search box that suggests nothing. It is
         * never an error a shopper is shown: the form underneath still submits to `/shop`, which
         * is the answer they were reaching for anyway.
         */
        .catch(() => setResults(NO_RESULTS));
    }, KEYSTROKE_DEBOUNCE_MS);

    return () => {
      abortController.abort();
      clearTimeout(timer);
    };
  }, [term]);

  useEffect(() => {
    function dismissOnOutsideClick(event: MouseEvent): void {
      const container = containerRef.current;
      if (container !== null && !container.contains(event.target as Node)) setIsOpen(false);
    }

    document.addEventListener("mousedown", dismissOnOutsideClick);
    return () => document.removeEventListener("mousedown", dismissOnOutsideClick);
  }, []);

  const { hits, total } = results;
  const hasMoreThanShown = total > hits.length;
  const isListVisible = isOpen && isSearchableTerm(term);

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (hits.length === 0) return;
      event.preventDefault();
      setIsOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => (current + step + hits.length) % hits.length);
      return;
    }

    if (event.key === "Enter" && activeIndex >= 0) {
      const chosen = hits[activeIndex];
      if (chosen === undefined) return;
      event.preventDefault();
      router.push(`/product/${chosen.id}`);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <form method="get" action={SHOP_PATH} className="flex items-stretch gap-0">
        <label htmlFor={`${listboxId}-input`} className="sr-only">
          Search the collection
        </label>

        <span className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            id={`${listboxId}-input`}
            name={SEARCH_QUERY_PARAM}
            type="search"
            value={term}
            onChange={(event) => {
              setTerm(event.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search rings, anklets, watches…"
            autoComplete="off"
            role="combobox"
            aria-expanded={isListVisible && hits.length > 0}
            aria-controls={listboxId}
            aria-autocomplete="list"
            className={`${fieldControlClasses} ${fieldBorderClasses(false)} pl-10`}
          />
        </span>
      </form>

      {isListVisible ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Search suggestions"
          className="absolute inset-x-0 top-full z-40 mt-2 max-h-[26rem] overflow-y-auto border border-line bg-white shadow-card-hover"
        >
          {hits.length === 0 ? (
            <p className="px-4 py-5 text-body-sm text-muted">
              Nothing matches that yet. Try a category: rings, anklets, watches.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {hits.map((hit, index) => (
                <li key={hit.id}>
                  <SuggestionRow hit={hit} isActive={index === activeIndex} />
                </li>
              ))}
            </ul>
          )}

          {hasMoreThanShown ? (
            <Link
              href={buildSearchHref(term)}
              className="block border-t border-line bg-ivory px-4 py-3 text-center text-label uppercase tracking-caps text-ink transition-colors duration-250 hover:text-gold-deep"
            >
              {`See all ${total} results`}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SuggestionRow({
  hit,
  isActive,
}: {
  hit: ProductSearchHit;
  isActive: boolean;
}): JSX.Element {
  return (
    <Link
      href={`/product/${hit.id}`}
      role="option"
      aria-selected={isActive}
      className={`flex items-center gap-3 px-3 py-2.5 transition-colors duration-250 hover:bg-ivory ${
        isActive ? "bg-ivory" : ""
      }`}
    >
      <span className="relative h-12 w-12 shrink-0 overflow-hidden border border-line bg-white">
        {hit.image === null ? (
          <ProductImagePlaceholder />
        ) : (
          <Image src={hit.image} alt="" fill sizes="48px" className="object-contain p-1" />
        )}
      </span>

      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body-sm text-ink">{hit.name}</span>
        <span className="text-eyebrow uppercase tracking-caps text-muted">
          {hit.categoryLabel}
        </span>
      </span>

      <span className="shrink-0 font-sans text-body-sm font-medium text-ink">
        {formatRupees(hit.price)}
      </span>
    </Link>
  );
}

export { SEARCH_SUGGESTION_LIMIT };
