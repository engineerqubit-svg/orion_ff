import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * `next dev` blocks cross-origin requests by default, which breaks playing over
   * the office LAN (phones hitting http://<host-ip>:3000). Allow private ranges.
   * This only affects the dev server; production builds are unaffected.
   */
  allowedDevOrigins: [
    "10.20.10.122",
    "*.local",
    "10.*.*.*",
    "192.168.*.*",
    "172.16.*.*",
    "172.17.*.*",
    "172.18.*.*",
    "172.19.*.*",
    "172.20.*.*",
  ],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  typedRoutes: false,
};

export default nextConfig;
