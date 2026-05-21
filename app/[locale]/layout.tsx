import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { Anton, DM_Sans, Instrument_Serif, JetBrains_Mono } from 'next/font/google';
import { notFound } from 'next/navigation';

import { routing, type Locale } from '../../i18n/routing';
import { Footer } from '../../src/components/Footer';
import { Nav } from '../../src/components/Nav';
import { getPayload } from '../../src/lib/payload';
import '../globals.css';

/**
 * Locale-scoped root layout (owns html, body, fonts, globals.css).
 *
 * Per the next-intl App Router pattern, the *real* HTML shell lives here
 * (not in `app/layout.tsx`) so the `lang` attribute can reflect the active
 * locale. The Payload admin under `(payload)` keeps its own root layout via
 * `@payloadcms/next/layouts`.
 */
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

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Enable static rendering for pages inside this layout.
  setRequestLocale(locale);

  const messages = await getMessages();

  // Fetch Navigation global server-side and pass to the (client) Nav.
  const payload = await getPayload();
  const navigation = await payload.findGlobal({
    slug: 'navigation',
    locale: locale as Locale,
    fallbackLocale: 'en',
  });

  const navLinks = (navigation?.links ?? []).map((l) => ({
    label: l.label,
    href: l.href,
  }));
  const bookCtaLabel = navigation?.bookCtaLabel ?? messages.nav?.book ?? 'Book a tour';

  return (
    <html
      lang={locale}
      className={`${instrumentSerif.variable} ${dmSans.variable} ${jetbrainsMono.variable} ${anton.variable}`}
    >
      <body>
        <NextIntlClientProvider messages={messages}>
          <Nav links={navLinks} bookCtaLabel={bookCtaLabel} overHero />
          <main id="main">{children}</main>
          <Footer locale={locale as Locale} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
