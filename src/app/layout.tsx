import type { Metadata } from "next";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Brandon RV | Mobile Caravan & Motorhome Interior Repairs",
    template: "%s | Brandon RV"
  },
  description:
    "Mobile caravan and motorhome interior repairs and accessories in Tamworth, NSW. From Factory Experience to Repairs On The Go."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-AU">
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}