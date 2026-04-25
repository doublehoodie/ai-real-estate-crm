import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [{ source: "/appointments", destination: "/calendar", permanent: false }];
  },
};

export default nextConfig;
