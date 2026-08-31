export interface IconProps {
  className?: string;
}

const strokeProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function GemOutlineIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...strokeProps}>
      <path d="M8 3h8l4 6-8 12L4 9l4-6z" />
      <path d="M4 9h16" />
      <path d="M8 3l4 18 4-18" />
    </svg>
  );
}

export function ShieldCheckIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...strokeProps}>
      <path d="M12 3l7 3v5.5c0 4.3-2.9 8.3-7 9.5-4.1-1.2-7-5.2-7-9.5V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export function TruckIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...strokeProps}>
      <path d="M3 7h11v9H3z" />
      <path d="M14 10h4l3 3v3h-7z" />
      <circle cx="7" cy="18" r="1.8" />
      <circle cx="17.5" cy="18" r="1.8" />
    </svg>
  );
}

export function ReturnArrowIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...strokeProps}>
      <path d="M4 9h11a5 5 0 0 1 0 10H8" />
      <path d="M8 5L4 9l4 4" />
    </svg>
  );
}

export function CertificateIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...strokeProps}>
      <circle cx="12" cy="9" r="5.5" />
      <path d="M9 14l-1 7 4-2 4 2-1-7" />
    </svg>
  );
}

export function CartIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...strokeProps}>
      <path d="M5.5 8h13l1 12.5h-15L5.5 8z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

export function ArrowRightIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...strokeProps}>
      <path d="M4 12h15" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}

export function CaretDownIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...strokeProps}>
      <path d="M6 9.5l6 6 6-6" />
    </svg>
  );
}

export function MinusIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...strokeProps}>
      <path d="M5 12h14" />
    </svg>
  );
}

export function PlusIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...strokeProps}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...strokeProps}>
      <path d="M5 12.5l5 5 9-11" />
    </svg>
  );
}

export function FilterIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...strokeProps}>
      <path d="M4 6h16" />
      <path d="M7 12h10" />
      <path d="M10 18h4" />
    </svg>
  );
}

export function MenuIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...strokeProps}>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...strokeProps}>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </svg>
  );
}

export function SearchIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...strokeProps}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </svg>
  );
}

export function ZoomIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...strokeProps}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
      <path d="M8.5 11h5" />
      <path d="M11 8.5v5" />
    </svg>
  );
}

export function ShareIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...strokeProps}>
      <circle cx="18" cy="5.5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="18.5" r="2.5" />
      <path d="M8.2 10.8l7.6-4.1" />
      <path d="M8.2 13.2l7.6 4.1" />
    </svg>
  );
}

export function LinkIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...strokeProps}>
      <path d="M10 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.2 1.2" />
      <path d="M14 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1.2-1.2" />
    </svg>
  );
}

export function CopyIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...strokeProps}>
      <rect x="9" y="9" width="11" height="11" rx="1.5" />
      <path d="M15 5.5V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h.5" />
    </svg>
  );
}

export function WhatsAppIcon({ className }: IconProps): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347M12.05 21.785h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.82 9.82 0 0 1 6.988 2.896 9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.359.101 11.945c0 2.096.549 4.14 1.595 5.945L0 24l6.335-1.652a11.94 11.94 0 0 0 5.71 1.454h.006c6.585 0 11.946-5.359 11.949-11.945a11.87 11.87 0 0 0-3.48-8.408" />
    </svg>
  );
}
