import type {Metadata} from "next";
import type {ReactNode} from "react";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import {getPublicBusiness} from "@/lib/public-site";
import "./globals.css";
import "./brv-refresh.css";

export const metadata:Metadata={
 title:{default:"Brandon RV | Mobile Caravan & Motorhome Interior Repairs",template:"%s | Brandon RV"},
 description:"Mobile caravan and motorhome interior repair enquiries around Tamworth, NSW. From Factory Experience to Repairs On The Go.",
 openGraph:{title:"Brandon RV | Repairs On The Go",description:"Mobile caravan and motorhome interior repair enquiries around Tamworth, NSW.",type:"website"}
};

export default async function RootLayout({children}:Readonly<{children:ReactNode}>) {
 const business=await getPublicBusiness();
 const phone=business.phone??"";const brandLine=business.brand_line??"From Factory Experience to Repairs On The Go";
 const location=[business.city,business.region].filter(Boolean).join(", ")||"Tamworth, NSW";
 return <html lang="en-AU"><body>
  <SiteHeader brandLine={brandLine}/>
  {children}
  <SiteFooter phone={phone} phoneLink={`tel:${phone.replace(/[^+\d]/g,"")}`} brandLine={brandLine} location={location}/>
 </body></html>;
}
