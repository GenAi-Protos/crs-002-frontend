import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // CPX container image (app/frontend/Dockerfile) runs the standalone server on :8080.
  output: "standalone",
};

export default nextConfig;
