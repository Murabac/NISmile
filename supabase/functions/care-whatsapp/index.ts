/**
 * Public landing for the WhatsApp template “Contact care” URL button.
 * Meta rejects wa.me on buttons; this page links to care WhatsApp +252 63 4548732.
 */
const CARE_WA = 'https://wa.me/252634548732'
const CARE_PHONE = '+252 63 4548732'

const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>N.I SMILE Customer Care</title>
    <style>
      :root {
        --ink: #1a2b33;
        --muted: #5a6b73;
        --bg: #f3f7f8;
        --card: #ffffff;
        --accent: #0d7a8c;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        font-family: "Segoe UI", system-ui, sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at top left, #d9eef2 0%, transparent 45%),
          radial-gradient(circle at bottom right, #e8f4f6 0%, transparent 40%),
          var(--bg);
      }
      main {
        width: min(100%, 420px);
        padding: 32px 28px;
        background: var(--card);
        border-radius: 16px;
        box-shadow: 0 12px 40px rgba(26, 43, 51, 0.08);
        text-align: center;
      }
      h1 { margin: 0 0 8px; font-size: 1.35rem; font-weight: 700; }
      p { margin: 0 0 24px; color: var(--muted); line-height: 1.45; }
      a.cta {
        display: inline-block;
        padding: 14px 22px;
        border-radius: 10px;
        background: var(--accent);
        color: #fff;
        font-weight: 600;
        text-decoration: none;
      }
      .phone { margin-top: 18px; font-size: 0.9rem; color: var(--muted); }
    </style>
  </head>
  <body>
    <main>
      <h1>N.I SMILE Customer Care</h1>
      <p>Chat with our care team on WhatsApp.</p>
      <a class="cta" href="${CARE_WA}">Open WhatsApp care</a>
      <p class="phone">${CARE_PHONE}</p>
    </main>
  </body>
</html>`

Deno.serve((req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
    })
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405 })
  }
  return new Response(req.method === 'HEAD' ? null : html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  })
})
