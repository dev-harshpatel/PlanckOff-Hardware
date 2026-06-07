import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // Prevent browser-only packages from being bundled into the server build.
  // These packages access browser globals (DOMMatrix, canvas, etc.) at module init time.
  serverExternalPackages: ['jspdf', 'jspdf-autotable', 'xlsx', 'xlsx-js-style', 'file-saver', 'pdfjs-dist', '@napi-rs/canvas'],

  // Prevents pdfjs-dist from trying to spawn its own nested worker inside upload.worker.ts.
  // pdfjs internally uses `new URL('pdf.worker.min.mjs', import.meta.url)` which Turbopack
  // statically analyzes and tries to bundle as a nested worker — that fails in a worker context.
  // Redirecting it to the empty stub makes pdfjs fall back to FakeWorker (workerSrc = '').
  turbopack: {
    resolveAlias: {
      'pdfjs-dist/build/pdf.worker.min.mjs': path.resolve('./utils/pdfjs-worker-stub.js'),
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
              "worker-src 'self' blob:",
              "connect-src *",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },

  experimental: {
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },

  webpack: (config) => {
    // Required for pdfjs-dist — it tries to use canvas in node context
    config.resolve.alias.canvas = false;
    // Webpack equivalent of the turbopack alias above
    config.resolve.alias['pdfjs-dist/build/pdf.worker.min.mjs'] = false;

    return config;
  },
  // jszip ships CJS-only — transpile so webpack resolves it correctly in the browser bundle
  transpilePackages: ['jszip'],
};

export default nextConfig;
