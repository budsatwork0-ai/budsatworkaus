import type { NextConfig } from "next";
import path from "path";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  transpilePackages: ['framer-motion'],
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  outputFileTracingRoot: path.join(__dirname),
  outputFileTracingIncludes: {
    '/api/bud/obsidian':      ['./Buds At Work/architecture/**/*'],
    '/api/bud/improvements':  ['./Buds At Work/architecture/Refactor Plans/**/*', './graphify-out/GRAPH_REPORT.md'],
    '/api/bud/graphify':      ['./graphify-out/GRAPH_REPORT.md'],
  },
  turbopack: {
    root: path.join(__dirname),
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  widenClientFileUpload: true,
  webpack: {
    treeshake: { removeDebugLogging: true },
    automaticVercelMonitors: true,
  },
});
