import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";

export interface ViewAllLinkProps {
  href: string;
  label?: string;
}

export function ViewAllLink({
  href,
  label = "View all",
}: ViewAllLinkProps): JSX.Element {
  return (
    <Link
      href={href}
      className="group inline-flex shrink-0 items-center gap-2 text-label uppercase tracking-caps text-ink transition-colors duration-250 hover:text-gold-deep"
    >
      {label}
      <ArrowRightIcon className="h-4 w-4 transition-transform duration-250 group-hover:translate-x-1" />
    </Link>
  );
}
