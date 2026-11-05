import type { Metadata } from "next";
import type { ReactNode } from "react";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import {getPublicBusiness,phoneHref} from "@/lib/public-site";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Brandon RV | Mobile Caravan & Motorhome Interior Repairs",
    template: "%s | Brandon RV"
  },
  description:
    "Mobile caravan and motorhome interior repairs and accessories in Tamworth, NSW. From Factory Experience to Repairs On The Go."
};

export default async function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en-AU">
      <body>
        <SiteHeader phone={phone} phoneLink={phoneHref(phone)} brandLine={brandLine} />
        {children}
        <SiteFooter phone={phone} phoneLink={phoneHref(phone)} brandLine={brandLine} location={location} />
      </body>
    </html>
  );
}