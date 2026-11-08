export const BRANDON_RV_EMAIL_TEMPLATE_IDS: readonly string[];
export function renderBrandonRvEmail(
  templateId: string,
  variables?: Record<string, unknown>,
  overrides?: Partial<Record<"subject" | "title" | "intro" | "body" | "cta", string>>
): {
  templateId: string;
  subject: string;
  html: string;
  text: string;
  category: string;
};
