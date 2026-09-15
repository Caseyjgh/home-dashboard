import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { Redis } from "@upstash/redis";
import { applyFamilyCommand, emptyFamily, FamilyError, type FamilyData } from "./family-model";

function redis() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) throw new FamilyError("Shared storage is not configured. Check Settings.", 503);
  return new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN, retry: false });
}
export function familyScope(email: string) {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}
function key(email: string) { return `home-dashboard:family:v1:${familyScope(email)}`; }
export async function readFamily(email: string): Promise<FamilyData> {
  const data = await redis().get<FamilyData>(key(email));
  if (data === null) return emptyFamily();
  if (data.version !== 1 || !Number.isSafeInteger(data.revision) || !Array.isArray(data.dinners) || !Array.isArray(data.todos) || !Array.isArray(data.legacyImports)) throw new FamilyError("Saved household data could not be read. It has not been changed.", 503);
  return data;
}
// Compare-and-set prevents lost updates when two devices save at once.
const SAVE = `
local previous = redis.call('GET', KEYS[1])
local revision = 0
if previous then revision = cjson.decode(previous).revision end
if revision ~= tonumber(ARGV[1]) then return 0 end
redis.call('SET', KEYS[1], ARGV[2])
return 1
`;
export async function changeFamily(email: string, revision: unknown, command: unknown) {
  if (!Number.isSafeInteger(revision) || (revision as number) < 0) throw new FamilyError("Invalid data revision.");
  const previous = await readFamily(email);
  if (previous.revision !== revision) throw new FamilyError("Another device changed this data. The latest version is loaded; review your edits and save again.", 409);
  const next = applyFamilyCommand(previous, command, { id: randomUUID, now: new Date().toISOString(), hash: (value) => createHash("sha256").update(value).digest("hex") });
  const saved = await redis().eval(SAVE, [key(email)], [revision as number, JSON.stringify(next)]);
  if (saved !== 1) throw new FamilyError("Another device saved first. The latest version is loaded; review your edits and save again.", 409);
  return next;
}
