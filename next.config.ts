import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Pozwala zbudować projekt mimo błędów TS
    ignoreBuildErrors: true,
  },
  eslint: {
    // Ignoruje błędy ESLint podczas builda (np. w CI / next build)
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
