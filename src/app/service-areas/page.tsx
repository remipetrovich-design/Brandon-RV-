import type { Metadata } from "next";
import Link from "next/link";
import {getPublishedSitePage,getPublishedServiceAreas,contentText} from "@/lib/public-site";

export const metadata: Metadata = { title: "Service areas", description: "Brandon RV mobile caravan and motorhome interior service around Tamworth, NSW." };

export default function ServiceAreasPage() {
  return <main>
    <section className="page-hero"><div className="shell"><p className="eyebrow"><span className="eyebrow-line" /> WHERE WE WORK</p><h1>Mobile service around <em>Tamworth.</em></h1><p>{page?.content.intro&&typeof page.content.intro==="string"?page.content.intro:"Brandon RV is based in the Tamworth region and considers suitable mobile jobs across the local area."}</p></div></section>
    <section className="content-section"><div className="shell service-area-grid">
      <div><p className="eyebrow"><span className="eyebrow-line" /> LOCAL SERVICE</p><h2>Start with your <em>location.</em></h2><p>Tell us where your caravan or motorhome is located and what work you need. We will confirm whether the job and travel are suitable before arranging a visit.{radius?` The currently published local service radius is ${radius} km.`:""}</p><p>Travel outside the usual local area may be possible by arrangement and can involve additional travel charges.</p><Link className="button button-primary" href="/request-quote">Check your location <span>→</span></Link></div>
      <div className="service-area-card"><span>BRANDON RV</span><strong>{base}</strong><small>{areas.length?areas.map(a=>a.name).join(" · "):"LOCAL MOBILE SERVICE"}</small><div className="service-area-ring" /></div>
    </div></section>
  </main>;
}