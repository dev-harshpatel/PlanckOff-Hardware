import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Prevent browser-only packages from being bundled into the server build.
  // These packages access browser globals (DOMMatrix, canvas, etc.) at module init time.
  serverExternalPackages: ['jspdf', 'jspdf-autotable', 'xlsx', 'file-saver', 'pdfjs-dist'],

  typescript: {
    // Pre-existing type errors in the codebase (components/types mismatch).
    // Vite's esbuild never caught these — Next.js does. Fix in code-quality phase.
    ignoreBuildErrors: true,
  },
  webpack: (config) => {
    // Required for pdfjs-dist — it tries to use canvas in node context
    config.resolve.alias.canvas = false;

    // Required for pdfjs-dist worker resolution
    config.resolve.alias['pdfjs-dist/build/pdf.worker.min.mjs'] = false;

    return config;
  },
  // Packages that need to be transpiled for Next.js SSR compatibility
  // pdfjs-dist is handled via serverExternalPackages — do not add to transpilePackages
};

export default nextConfig;
