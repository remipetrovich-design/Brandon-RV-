export const BRANDON_RV_EMAIL_TEMPLATE_IDS: readonly string[];
export function renderBrandonRvEmail(
  templateId: string,
  variables?: Record<string, unknown>
): {
  templateId: string;
  subject: string;
  html: string;
  text: string;
  category: string;
};
