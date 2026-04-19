import type { Metadata } from 'next';
import { Providers } from './providers';
import { AppShell } from '@/components/AppShell';
import './globals.css';

export const metadata: Metadata = {
  title: 'PlanckOff — Hardware Estimating',
  description: 'Professional hardware estimating platform for door hardware and construction projects.',
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="h-screen overflow-hidden bg-[var(--bg-muted)]">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
