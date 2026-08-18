import { buildWhatsAppLink } from "@/lib/config";
import { WhatsAppIcon } from "@/components/icons";

export function WhatsAppButton(): JSX.Element {
  return (
    <a
      href={buildWhatsAppLink()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="fixed bottom-4 right-4 z-30 inline-flex items-center gap-2.5 rounded-full bg-whatsapp py-3 pl-3 pr-3 text-white shadow-card-hover transition-transform duration-250 hover:-translate-y-0.5 sm:bottom-6 sm:right-6 sm:pr-5"
    >
      <WhatsAppIcon className="h-6 w-6 shrink-0" />
      <span className="hidden text-label uppercase tracking-caps sm:inline">
        Chat with us
      </span>
    </a>
  );
}
