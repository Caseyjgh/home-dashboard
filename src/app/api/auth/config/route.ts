import { authDiagnostics } from "@/lib/auth-config";

export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return Response.json(authDiagnostics(process.env, new URL(request.url).origin), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
