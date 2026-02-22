import Link from "next/link";
import { Facebook, Instagram, MessageCircle, PhoneCall, Star, Youtube } from "lucide-react";
import { businessDetails } from "@/lib/business";

const socialItems = [
  { key: "facebook", label: "Facebook", href: businessDetails.socials.facebook, icon: Facebook },
  { key: "instagram", label: "Instagram", href: businessDetails.socials.instagram, icon: Instagram },
  { key: "youtube", label: "YouTube", href: businessDetails.socials.youtube, icon: Youtube },
];

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[var(--ehs-brand-dark)] px-4 py-8 text-sm text-white">
      <div className="mx-auto grid w-full max-w-6xl gap-6 md:grid-cols-3">
        <div>
          <p className="text-base font-semibold">{businessDetails.name}</p>
          <p className="mt-2 text-slate-200">
            Landline: {businessDetails.primaryPhoneDisplay}
            <br />
            Mobile / WhatsApp: {businessDetails.mobilePhoneDisplay}
          </p>
          <p className="mt-2 text-slate-200">{businessDetails.email}</p>
          <p className="mt-2 text-xs text-slate-300">
            Gas Safe: {businessDetails.gasSafeNumber}
            <br />
            VAT: {businessDetails.vatRegistrationNumber}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Quick Links</p>
          <div className="mt-2 flex flex-col gap-2">
            <Link href="/about-trust" className="hover:text-white">
              About & Trust
            </Link>
            <Link href="/finance" className="hover:text-white">
              Finance
            </Link>
            <Link href="/lp/power-flushing/uxbridge" className="hover:text-white">
              Power Flushing
            </Link>
            <a
              href={businessDetails.googleReviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-white"
            >
              <Star size={14} className="fill-amber-400 text-amber-400" />
              Google Reviews
            </a>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Socials</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {socialItems.map((item) => {
              const Icon = item.icon;

              return (
                <a
                  key={item.key}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/25 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20"
                >
                  <Icon size={14} />
                  {item.label}
                </a>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <a
              href={`tel:${businessDetails.primaryPhoneRaw}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/25 bg-white/10 px-3 py-2 font-semibold text-white hover:bg-white/20"
            >
              <PhoneCall size={14} />
              Call
            </a>
            <a
              href={businessDetails.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-white/25 bg-white/10 px-3 py-2 font-semibold text-white hover:bg-white/20"
            >
              <MessageCircle size={14} />
              WhatsApp
            </a>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-6 w-full max-w-6xl border-t border-white/15 pt-4 text-xs text-slate-300">
        <p>© {year} {businessDetails.name}</p>
      </div>
    </footer>
  );
}
