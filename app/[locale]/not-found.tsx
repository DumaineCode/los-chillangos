import { getTranslations } from 'next-intl/server';

import { Link } from '../../i18n/navigation';

/**
 * Locale-scoped 404 page. next-intl's middleware ensures any unmatched route
 * under `/en/...` or `/es/...` renders this with the active locale.
 */
export default async function NotFound() {
  const t = await getTranslations('notFound');
  return (
    <section className="section">
      <div className="container-tight" style={{ textAlign: 'center', paddingTop: 120 }}>
        <h1 className="section-title">{t('title')}</h1>
        <p className="section-sub" style={{ marginTop: 24, marginBottom: 32 }}>
          {t('lede')}
        </p>
        <div style={{ display: 'inline-flex', gap: 16, justifyContent: 'center' }}>
          <Link href="/" className="btn btn-primary">
            {t('homeCta')}
          </Link>
          <Link href="/#tours" className="btn btn-ghost">
            {t('toursCta')}
          </Link>
        </div>
      </div>
    </section>
  );
}
