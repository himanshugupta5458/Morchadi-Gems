import Link from "next/link";
import type { ReactNode } from "react";
import { LEGAL_CONFIG } from "@/lib/config";
import { formatPolicyDate } from "@/lib/format";
import { POLICY_LINKS } from "@/lib/navigation";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Prose } from "@/components/Prose";
import { SectionHeading } from "@/components/SectionHeading";

export interface PolicyPageProps {
  roman: string;
  accent: string;
  summary: string;
  currentHref: string;
  children: ReactNode;
}

function PolicyCrossLinks({ currentHref }: { currentHref: string }): JSX.Element {
  const otherPolicies = POLICY_LINKS.filter((link) => link.href !== currentHref);

  return (
    <nav
      aria-label="Other policies"
      className="mt-16 max-w-prose border-t border-line pt-8 lg:mt-20"
    >
      <h2 className="text-eyebrow uppercase text-muted">Related policies</h2>
      <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        {otherPolicies.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-body-sm text-ink underline decoration-gold underline-offset-4 transition-colors duration-250 hover:text-gold-deep"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * The shared shell for all four policy pages: breadcrumb, two-tone heading, the last-updated
 * line, the prose body, and links to the sibling policies. A policy page therefore contains
 * only its own words.
 */
export function PolicyPage({
  roman,
  accent,
  summary,
  currentHref,
  children,
}: PolicyPageProps): JSX.Element {
  return (
    <div className="container py-8 lg:py-12">
      <Breadcrumb
        trail={[{ label: "Home", href: "/" }, { label: `${roman} ${accent}` }]}
      />

      <div className="mt-8 flex flex-col gap-6 lg:mt-10">
        <SectionHeading
          as="h1"
          roman={roman}
          accent={accent}
          align="left"
          subtitle={summary}
        />

        <p className="text-body-sm text-muted">
          Last updated:{" "}
          <time dateTime={LEGAL_CONFIG.policyLastUpdatedIso} className="text-ink">
            {formatPolicyDate(LEGAL_CONFIG.policyLastUpdatedIso)}
          </time>
        </p>
      </div>

      <div className="mt-10 lg:mt-12">
        <Prose>{children}</Prose>
      </div>

      <PolicyCrossLinks currentHref={currentHref} />
    </div>
  );
}
