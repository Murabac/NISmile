/**
 * Fallback page for older templates that still use a URL “Contact care” button.
 * New templates use a native PHONE_NUMBER button instead (no browser).
 */
const CARE_DISPLAY = '+252 63 4548732'
const CARE_TEL = 'tel:+252634548732'
const CARE_CHAT = 'whatsapp://send?phone=252634548732'

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>N.I SMILE Customer Care</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;
font-family:system-ui,sans-serif;background:#f3f7f8;color:#1a2b33}
main{width:min(100%,420px);padding:28px;background:#fff;border-radius:16px;
box-shadow:0 12px 40px rgba(26,43,51,.08);text-align:center}
h1{margin:0 0 8px;font-size:1.25rem}
p{margin:0 0 16px;color:#5a6b73;line-height:1.4}
a{display:block;width:100%;padding:14px 18px;margin:10px 0;border-radius:10px;
font-weight:700;text-decoration:none}
a.call{background:#0d7a8c;color:#fff}
a.chat{background:#25d366;color:#fff}
</style>
</head>
<body>
<main>
<h1>N.I SMILE Customer Care</h1>
<p>Choose Chat or Call — same as tapping ${CARE_DISPLAY} on the message.</p>
<a class="chat" href="${CARE_CHAT}">Chat on WhatsApp</a>
<a class="call" href="${CARE_TEL}">Call ${CARE_DISPLAY}</a>
</main>
</body>
</html>`

Deno.serve((req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      },
    })
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405 })
  }
  return new Response(req.method === 'HEAD' ? null : html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  })
})
