import Image from "next/image";
import { ProductImagePlaceholder } from "@/components/ProductImagePlaceholder";

export interface ProductImagePanelProps {
  src: string | null;
  alt: string;
  priority?: boolean;
}

export function ProductImagePanel({
  src,
  alt,
  priority = false,
}: ProductImagePanelProps): JSX.Element {
  return (
    <div className="relative aspect-square w-full overflow-hidden border border-line bg-ivory">
      {src === null ? (
        <ProductImagePlaceholder size="lg" />
      ) : (
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-contain p-6 lg:p-10"
        />
      )}
    </div>
  );
}
