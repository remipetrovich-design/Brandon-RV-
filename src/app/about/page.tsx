import type { Metadata } from "next";
import {getPublishedSitePage,contentText} from "@/lib/public-site";

export const metadata: Metadata = {
  title: "About",
  description: "Learn about Brandon RV, a mobile caravan and motorhome interior repair service based in Tamworth, NSW."
};

export const dynamic="force-dynamic";
export default async function AboutPage() {
  const page=await getPublishedSitePage("about");
  const intro=contentText(page?.content,"intro","A mobile service built around practical caravan and motorhome interior repairs, fittings and accessories.");
  const pageTitle=page?.title??"Experience that understands your setup.";
  const words=pageTitle.split(/\s+/);
  return (
    <main>
      <section className="page-hero">
        <div className="shell">
          <p className="eyebrow"><span className="eyebrow-line" /> ABOUT BRANDON RV</p>
          <h1>{words.slice(0,-2).join(" ")} <em>{words.slice(-2).join(" ")}</em></h1>
          <p>{intro}</p>
        </div>
      </section>
      <section className="content-section">
        <div className="shell about-grid">
          <aside className="about-aside">
            <strong>From Factory Experience to Repairs On The Go.</strong>
            <p>Mobile caravan and motorhome interior service · Tamworth NSW</p>
          </aside>
          <div className="about-copy">
            <h2>Keeping the inside working for the journey.</h2>
            <p>Brandon RV is a Tamworth-based mobile caravan and motorhome interior repair and accessory service. The focus is on the practical details that make a difference when you are travelling or spending time away: doors that do not close properly, worn hardware, loose fittings and suitable interior upgrades.</p>
            <p>The business draws on hands-on experience across motorhome manufacturing and caravan parts and service. Every job is considered individually, with clear communication about what can be done, what is required and whether another specialist is needed.</p>
            <p>Brandon RV aims to make the repair process straightforward: understand the issue, confirm the scope, agree on the next step and arrange a visit where the work is suitable.</p>
          </div>
        </div>
      </section>
    </main>
  );
}