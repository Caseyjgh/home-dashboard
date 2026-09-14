import type { NextConfig } from "next";
import { authDiagnostics } from "./src/lib/auth-config";

// Next loads .env files before this config. Fail before building a broken login.
console.info("[OAuth configuration]", authDiagnostics(process.env));

const nextConfig: NextConfig = {
  experimental: {
    useTypeScriptCli: false,
  },
};

export default nextConfig;
