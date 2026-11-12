/** Human-chat care line (not the Cloud API number). */
export const CARE_DISPLAY_NAME = 'N.I SMILE Customer Care'
export const CARE_PHONE_DISPLAY = '+252 63 4548732'
export const CARE_WA_ME = 'https://wa.me/252634548732'

/**
 * Closing line on every outbound message. The same sentence is written into the body of
 * every Meta template (docs/WhatsApp-Templates-v2.md), so templates and free-form text match.
 */
export const CARE_LINE = `For further instructions or questions, contact us: ${CARE_WA_ME}`

const CARE_FOOTER = `\n\n${CARE_LINE}`

const MAX_WHATSAPP_TEXT = 4096

/** Append the care line once; keep within Meta's limit (4096 text, 1024 media caption). */
export function appendCareFooter(body: string, max: number = MAX_WHATSAPP_TEXT): string {
  const base = body ?? ''
  if (base.includes(CARE_WA_ME)) return base.slice(0, max)
  const room = max - CARE_FOOTER.length
  if (room <= 0) return CARE_FOOTER.slice(0, max)
  return base.slice(0, room) + CARE_FOOTER
}
