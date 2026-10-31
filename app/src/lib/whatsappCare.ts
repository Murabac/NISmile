/** Human-chat care line shown on outbound WhatsApp free-form text (not the API number). */
export const CARE_DISPLAY_NAME = 'N.I SMILE Customer Care'
export const CARE_PHONE_DISPLAY = '+252 63 4548732'
export const CARE_WA_ME = 'https://wa.me/252634548732'

const CARE_FOOTER =
  `\n\nNeed help or further instructions? Contact ${CARE_DISPLAY_NAME}:\n${CARE_WA_ME}`

const MAX_WHATSAPP_TEXT = 4096

/** Append care footer once; keep within Meta free-form text limit. */
export function appendCareFooter(body: string): string {
  const base = body ?? ''
  if (base.includes(CARE_WA_ME)) return base.slice(0, MAX_WHATSAPP_TEXT)
  const room = MAX_WHATSAPP_TEXT - CARE_FOOTER.length
  if (room <= 0) return CARE_FOOTER.slice(0, MAX_WHATSAPP_TEXT)
  return base.slice(0, room) + CARE_FOOTER
}
