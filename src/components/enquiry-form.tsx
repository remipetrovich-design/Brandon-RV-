"use client";

import { FormEvent, useState } from "react";

export default function EnquiryForm() {
  const [sent, setSent] = useState(false);
  const [files, setFiles] = useState<string[]>([]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSent(true);
  }

  if (sent) {
    return <div className="form-success" role="status">
      <span className="success-mark">✓</span>
      <h2>Enquiry details ready</h2>
      <p>This is a frontend preview. Your details have not been sent or stored. The secure enquiry service will be connected during the backend build.</p>
      <button className="button button-secondary" type="button" onClick={() => setSent(false)}>Edit enquiry</button>
    </div>;
  }

  return <form className="enquiry-form" onSubmit={submit}>
    <div className="form-section-title"><span>01</span><div><strong>Your details</strong><small>How can we contact you?</small></div></div>
    <div className="form-grid">
      <label>First name<input name="firstName" autoComplete="given-name" required placeholder="First name" /></label>
      <label>Last name<input name="lastName" autoComplete="family-name" required placeholder="Last name" /></label>
      <label>Email address<input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label>
      <label>Phone number<input name="phone" type="tel" autoComplete="tel" required placeholder="04xx xxx xxx" /></label>
    </div>
    <div className="form-section-title"><span>02</span><div><strong>Your caravan or motorhome</strong><small>A few details help us assess the job</small></div></div>
    <div className="form-grid">
      <label>Vehicle type<select name="vehicleType" required defaultValue=""><option value="" disabled>Select vehicle type</option><option>Caravan</option><option>Motorhome</option><option>Camper trailer</option><option>Other</option></select></label>
      <label>Make and model<input name="vehicle" placeholder="e.g. Jayco, Trakka..." /></label>
      <label>Year<input name="year" inputMode="numeric" placeholder="Year (if known)" /></label>
      <label>Suburb or location<input name="location" required placeholder="Where is the vehicle located?" /></label>
    </div>
    <div className="form-section-title"><span>03</span><div><strong>What do you need help with?</strong><small>Describe the issue and attach photos if useful</small></div></div>
    <label className="full-label">Type of work<select name="workType" required defaultValue=""><option value="" disabled>Select a category</option><option>Cabinetry or interior repair</option><option>Hardware or fittings</option><option>Interior accessory</option><option>Fault assessment</option><option>Not sure</option></select></label>
    <label className="full-label">Tell us about the job<textarea name="description" rows={5} required placeholder="What is happening? When did it start? Include any details that may help..." /></label>
    <label className="upload-field">Photos (optional)<input type="file" accept="image/*,.pdf" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []).map((file) => file.name))} /><small>{files.length ? files.join(", ") : "Choose photos or a document. Uploads are preview-only until the backend is connected."}</small></label>
    <label className="consent-check"><input type="checkbox" required /> <span>I agree that Brandon RV may contact me about this enquiry.</span></label>
    <button className="button button-primary form-submit" type="submit">Review enquiry <span aria-hidden="true">→</span></button>
    <p className="form-disclaimer">Sending an enquiry does not confirm a booking. The job scope, availability and requirements must be checked first.</p>
  </form>;
}