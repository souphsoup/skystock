// Which deploy is live. Open pages poll this to show "มีอัปเดตใหม่" (update-banner.tsx).
export function GET() {
  return Response.json({ version: process.env.APP_VERSION }, { headers: { "Cache-Control": "no-store" } });
}
