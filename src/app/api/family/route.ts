import { auth } from "@/auth";
import { FamilyError } from "@/lib/family-model";
import { changeFamily, familyScope, readFamily } from "@/lib/family-storage";

const privateHeaders = { "Cache-Control": "private, no-store" };
function failure(error: unknown) {
  return Response.json({ error: error instanceof FamilyError ? error.message : "Shared data is temporarily unavailable. Your saved entries have not been cleared." }, { status: error instanceof FamilyError ? error.status : 503, headers: privateHeaders });
}
export async function GET(request: Request) {
  try {
    const email = (await auth())?.user?.email;
    if (!email) return Response.json({ error: "Sign in with Google to use shared dinner and to-dos." }, { status: 401, headers: privateHeaders });
    const data = await readFamily(email);
    const etag = `"${familyScope(email)}:${data.revision}"`;
    if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers: { ...privateHeaders, ETag: etag } });
    return Response.json({ data }, { headers: { ...privateHeaders, ETag: etag } });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  // Cookie-authenticated writes must originate from this app, not another site.
  let sameOrigin = false;
  try {
    const origin = new URL(request.headers.get("origin") || "");
    const protocol = request.headers.get("x-forwarded-proto") || new URL(request.url).protocol.slice(0, -1);
    // Next's internal request URL may use localhost behind its production server.
    sameOrigin = origin.host === request.headers.get("host") && origin.protocol === `${protocol}:`;
  } catch { /* Missing or malformed origins cannot write. */ }
  if (!sameOrigin) return Response.json({ error: "Invalid request origin." }, { status: 403, headers: privateHeaders });
  if (!request.headers.get("content-type")?.startsWith("application/json")) return Response.json({ error: "Use JSON for changes." }, { status: 415, headers: privateHeaders });
  let email: string | undefined | null;
  try {
    email = (await auth())?.user?.email;
    if (!email) return Response.json({ error: "Sign in before saving changes." }, { status: 401, headers: privateHeaders });
    if (Number(request.headers.get("content-length")) > 128_000) throw new FamilyError("Changes are too large.", 413);
    const raw = await request.text();
    if (raw.length > 128_000) throw new FamilyError("Changes are too large.", 413);
    let body;
    try { body = JSON.parse(raw); } catch { throw new FamilyError("Invalid JSON."); }
    const data = await changeFamily(email, body?.revision, body?.command);
    return Response.json({ data }, { headers: privateHeaders });
  } catch (error) {
    if (email && error instanceof FamilyError && error.status === 409) {
      try { return Response.json({ error: error.message, data: await readFamily(email) }, { status: 409, headers: privateHeaders }); }
      catch { return failure(error); }
    }
    return failure(error);
  }
}
