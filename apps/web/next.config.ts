import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // @binge-log/db ships TypeScript source, not a build artefact.
  transpilePackages: ['@binge-log/db'],
  typedRoutes: true,
  images: {
    // TheTVDB artwork (ADR-002). Procedural cards are served from our own
    // origin as SVG (ADR-012), so they need no entry here.
    remotePatterns: [{ protocol: 'https', hostname: 'artworks.thetvdb.com' }],
  },
};

export default config;
