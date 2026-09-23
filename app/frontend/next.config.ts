import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // CPX container image (app/frontend/Dockerfile) runs the standalone server on :8080.
  output: "standalone",
  // The dev badge sits on the rail's toggle inside a Teams-sized frame.
  devIndicators: false,
};

export default nextConfig;
