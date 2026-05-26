import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Prevent browser-only packages from being bundled into the server build.
  // These packages access browser globals (DOMMatrix, canvas, etc.) at module init time.
  serverExternalPackages: ['jspdf', 'jspdf-autotable', 'xlsx', 'file-saver', 'pdfjs-dist'],

  // Turbopack equivalent of the webpack pdfjs alias below — prevents pdfjs from
  // trying to load its own nested worker (we use FakeWorker mode in web workers instead).
  turbopack: {
    resolveAlias: {
      'pdfjs-dist/build/pdf.worker.min.mjs': './utils/pdfjs-worker-stub.js',
    },
  },

  // D-10, D-11: HTTP security headers applied to ALL routes (Phase 15).
  // Permissive CSP baseline — keeps Next.js + Supabase Realtime working; tighten in a future phase.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',        value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy',        value: 'strict-origin-when-cross-origin' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src * data: blob:",
              "font-src 'self' data:",
              "connect-src *",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },

  webpack: (config) => {
    // Required for pdfjs-dist — it tries to use canvas in node context
    config.resolve.alias.canvas = false;

    // Required for pdfjs-dist worker resolution
    config.resolve.alias['pdfjs-dist/build/pdf.worker.min.mjs'] = false;

    return config;
  },
  // jszip ships CJS-only — transpile so webpack resolves it correctly in the browser bundle
  transpilePackages: ['jszip'],
};

export default nextConfig;
