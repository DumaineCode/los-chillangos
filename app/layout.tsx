import type { Metadata } from 'next';
import { Instrument_Serif, DM_Sans, JetBrains_Mono, Anton } from 'next/font/google';
import './globals.css';

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-instrument-serif',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

const anton = Anton({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-anton',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Los Chillangos — CDMX E-Bike & Walking Tours',
  description:
    'Small-group e-bike rides, walking tours and day trips in Mexico City led by guides who actually live here. Three to four hours. No bus crowds.',
  openGraph: {
    title: 'Los Chillangos — CDMX E-Bike & Walking Tours',
    description:
      'Small-group e-bike rides, walking tours and day trips in Mexico City led by guides who actually live here.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${instrumentSerif.variable} ${dmSans.variable} ${jetbrainsMono.variable} ${anton.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
