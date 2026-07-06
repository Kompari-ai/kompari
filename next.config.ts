import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/races", destination: "/events", permanent: true },
      { source: "/race/:slug", destination: "/events/:slug", permanent: true },
    ];
  },
};

export default nextConfig;
