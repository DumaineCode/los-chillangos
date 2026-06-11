import { hasLocale } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { Anton, DM_Sans, Instrument_Serif, JetBrains_Mono } from 'next/font/google';
import { notFound } from 'next/navigation';

import { routing, type Locale } from '../../i18n/routing';
import { Footer } from '../../src/components/Footer';
import { IntlProvider } from '../../src/components/IntlProvider';
import { Nav } from '../../src/components/Nav';
import { PageLoader } from '../../src/components/PageLoader';
import { ThemeProvider } from '../../src/components/ThemeProvider';
import { themeInitScript } from '../../src/lib/theme';
import { getPayload } from '../../src/lib/payload';
import type { Media } from '../../src/payload-types';
import '../globals.css';

/**
 * Resolve a Payload upload field to a public URL.
 *
 * A global upload field types as `number | Media | null`: at `depth: 0` it's a
 * numeric id (unpopulated), otherwise the populated `Media` object. We only
 * have a URL in the populated case.
 */
function resolveMediaUrl(value: number | Media | null | undefined): string | null {
  if (!value || typeof value === 'number') return null;
  return value.url ?? null;
}

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

  // Fetch Navigation + Branding globals server-side and pass to the (client) Nav.
  const payload = await getPayload();
  const [navigation, branding] = await Promise.all([
    payload.findGlobal({
      slug: 'navigation',
      locale: locale as Locale,
      fallbackLocale: 'en',
    }),
    payload
      .findGlobal({ slug: 'branding', locale: locale as Locale, fallbackLocale: 'en' })
      .catch(() => null),
  ]);

  const navLinks = (navigation?.links ?? []).map((l) => ({
    label: l.label,
    href: l.href,
  }));

  const logoSrc = resolveMediaUrl(branding?.logoLight);
  const logoAlt = branding?.logoAltText ?? 'Los Chillangos';
  const logoHeight =
    typeof branding?.logoHeight === 'number' && branding.logoHeight > 0
      ? branding.logoHeight
      : 40;

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${instrumentSerif.variable} ${dmSans.variable} ${jetbrainsMono.variable} ${anton.variable}`}
    >
      <head>
        {/* Sets data-theme before first paint to avoid a flash of the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <PageLoader />
        <ThemeProvider>
          <IntlProvider messages={messages} locale={locale}>
            <Nav
              links={navLinks}
              logoSrc={logoSrc}
              logoAlt={logoAlt}
              logoHeight={logoHeight}
              overHero
            />
            <main id="main">{children}</main>
            <Footer locale={locale as Locale} />
          </IntlProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
