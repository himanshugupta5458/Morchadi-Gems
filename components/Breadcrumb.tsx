import Link from "next/link";

export interface BreadcrumbStep {
  label: string;
  href?: string;
}

export interface BreadcrumbProps {
  trail: BreadcrumbStep[];
}

export function Breadcrumb({ trail }: BreadcrumbProps): JSX.Element {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm text-muted">
        {trail.map((step, index) => (
          <li key={`${step.label}-${index}`} className="flex items-center gap-2">
            {index > 0 ? (
              <span aria-hidden className="text-line">
                /
              </span>
            ) : null}

            {step.href === undefined ? (
              <span aria-current="page" className="text-ink">
                {step.label}
              </span>
            ) : (
              <Link
                href={step.href}
                className="transition-colors duration-250 hover:text-ink"
              >
                {step.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
