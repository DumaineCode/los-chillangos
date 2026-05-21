'use client';

import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import type { ReactNode } from 'react';

type Props = {
  messages: AbstractIntlMessages;
  locale: string;
  children: ReactNode;
};

/**
 * Client-side wrapper around `NextIntlClientProvider` so we can pass an
 * `onError` callback (a function can't cross the Server → Client Component
 * boundary as a prop). Throwing in dev/test catches latent ICU placeholder
 * bugs early; production logs and lets next-intl fall back to the raw
 * string so the page still renders.
 *
 * See: next-intl/icu-placeholder-silent-warnings
 */
export function IntlProvider({ messages, locale, children }: Props) {
  return (
    <NextIntlClientProvider
      messages={messages}
      locale={locale}
      onError={(error) => {
        if (process.env.NODE_ENV !== 'production') {
          throw error;
        }
        console.error('[next-intl]', error);
      }}
    >
      {children}
    </NextIntlClientProvider>
  );
}
