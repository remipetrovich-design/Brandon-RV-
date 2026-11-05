import type {Metadata} from "next";
import {getPublishedSitePage,contentText} from "@/lib/public-site";

export const metadata:Metadata={
  title:"About",
  description:"Learn about Brandon RV, a mobile caravan and motorhome interior repair enquiry service based in Tamworth, NSW."
};
export const dynamic="force-dynamic";

export default async function AboutPage() {
  const page=await getPublishedSitePage("about");
  const intro=contentText(page?.content,"intro","Brandon RV is being developed as a mobile, appointment-based service for suitable caravan and motorhome interior repair and accessory enquiries around Tamworth, NSW.");
  const pageTitle=page?.title??"Experience that understands your setup.";
  const words=pageTitle.split(/\s+/);
  return (
    <main>
      <section className="page-hero">
        <div className="shell">
          <p className="eyebrow"><span className="eyebrow-line"/> ABOUT BRANDON RV</p>
          <h1>{words.slice(0,-2).join(" ")} <em>{words.slice(-2).join(" ")}</em></h1>
          <p>{intro}</p>
        </div>
      </section>
      <section className="content-section">
        <div className="shell about-grid">
          <aside className="about-aside">
            <strong>From Factory Experience to Repairs On The Go.</strong>
            <p>Mobile caravan and motorhome interior repair enquiries · Tamworth NSW</p>
          </aside>
          <div className="about-copy">
            <h2>A practical approach to mobile RV repairs.</h2>
            <p>Chris's business plan records experience in motorhome manufacturing at Trakka, including a B-Class production team leadership role, and caravan parts, customer service and repair coordination at Tow World. It also records a Certificate II in automotive servicing. These are owner-reported credentials and should be supported by employment and qualification evidence before publication.</p>
            <p>That background informs the intended business approach: understand the issue, check the exact scope, explain the options and agree on the next step before work begins.</p>
            <p>Experience or a qualification does not automatically authorise regulated work. Each request is assessed against the actual task, demonstrated capability, applicable permissions, insurance, tools and customer-site conditions. Work outside the confirmed scope is declined or referred to an appropriately qualified specialist.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
