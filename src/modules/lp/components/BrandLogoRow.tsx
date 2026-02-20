import Image from "next/image";
import type { BrandLogo } from "@/modules/lp/types";

type BrandLogoRowProps = {
  logos: BrandLogo[];
};

export function BrandLogoRow({ logos }: BrandLogoRowProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:max-w-md">
      {logos.map((logo) => (
        <div
          key={logo.name}
          className="flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"
        >
          <Image
            src={logo.src}
            alt={`${logo.name} logo`}
            width={100}
            height={26}
            loading="lazy"
            className="h-6 w-auto object-contain"
          />
        </div>
      ))}
    </div>
  );
}
