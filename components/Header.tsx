import { CartLink } from "@/components/CartLink";
import { MobileNav } from "@/components/MobileNav";
import { PrimaryNav } from "@/components/PrimaryNav";
import { Wordmark } from "@/components/Wordmark";

export function Header(): JSX.Element {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white">
      <div className="container flex h-16 items-center justify-between gap-4 lg:h-20">
        <div className="flex items-center gap-2">
          <MobileNav />
          <Wordmark />
        </div>
        <CartLink />
      </div>
      <PrimaryNav />
    </header>
  );
}
