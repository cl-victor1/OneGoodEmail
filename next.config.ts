import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // unpdf / mammoth run only in server actions & route handlers (Node runtime).
  serverExternalPackages: ["unpdf", "mammoth"],
};

export default nextConfig;
