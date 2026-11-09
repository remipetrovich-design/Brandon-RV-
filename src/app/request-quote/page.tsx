import type { Metadata } from "next";
import EnquiryForm from "@/components/enquiry-form";

export const metadata: Metadata = { title: "Request a quote", description: "Tell Brandon RV about your caravan or motorhome repair." };

export default function RequestQuotePage() {
  return <main>
    <section className="page-hero"><div className="shell">
      <p className="eyebrow"><span className="eyebrow-line" /> START AN ENQUIRY</p>
      <h1>Tell us what needs <em>fixing.</em></h1>
      <p>Share a few details about your vehicle and the work you need. We will assess the request before discussing a quote or visit.</p>
    </div></section>
    <section className="content-section"><div className="shell enquiry-layout">
      <div className="enquiry-aside"><p className="eyebrow"><span className="eyebrow-line" /> BEFORE YOU START</p>
        <h2>A few details make it easier to help.</h2>
        <p>Include your vehicle make and model, location, a clear description and photos where possible.</p>
        <div className="enquiry-aside-note"><strong>Not sure if we can do the job?</strong><span>Send the details anyway. We will let you know whether it is suitable or needs another specialist.</span></div><div className="enquiry-aside-note"><strong>No account required.</strong><span>You can submit a quote request as a guest. If you register or sign in, your contact details can be reused, saved vehicles can be selected and your quote requests and conversations stay in your customer portal.</span></div>
        <a href="tel:+61407189087">Prefer to call? 0407 189 087</a>
      </div>
      <EnquiryForm />
    </div></section>
  </main>;
}