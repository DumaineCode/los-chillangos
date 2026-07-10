import { getTranslations } from 'next-intl/server';
import { Mail, MapPin, Phone } from 'lucide-react';
import {
  SiFacebook,
  SiInstagram,
  SiTiktok,
  SiWhatsapp,
  SiYoutube,
} from '@icons-pack/react-simple-icons';
import type { ComponentType } from 'react';

import type { Locale } from '../../../i18n/routing';
import { buildWhatsAppLink, formatWhatsAppDisplay } from '../../lib/contact/whatsapp';
import type { ContactInfo, SocialLink } from '../../payload-types';
import { ContactForm, type ContactFormStrings } from './ContactForm';

type Props = {
  locale: Locale;
  contact: ContactInfo | null;
  social: SocialLink | null;
};

/**
 * "Contáctanos" landing section (Server Component).
 *
 * Two columns:
 *   - left: the minimal contact form (name/email/phone/message) → /api/contact
 *   - right: the channels we ALREADY store in the admin — WhatsApp/phone,
 *     email, address, and social links — read from the `contact-info` and
 *     `social-links` globals (passed in by the page so we don't re-fetch).
 *
 * Every channel renders conditionally: a global the client hasn't filled in
 * simply doesn't show, so the section never looks broken.
 */
export async function Contact({ locale, contact, social }: Props) {
  const t = await getTranslations({ locale, namespace: 'contact' });
  const tForm = await getTranslations({ locale, namespace: 'contact.form' });

  const formStrings: ContactFormStrings = {
    nameLabel: tForm('nameLabel'),
    namePlaceholder: tForm('namePlaceholder'),
    emailLabel: tForm('emailLabel'),
    emailPlaceholder: tForm('emailPlaceholder'),
    phoneLabel: tForm('phoneLabel'),
    phonePlaceholder: tForm('phonePlaceholder'),
    messageLabel: tForm('messageLabel'),
    messagePlaceholder: tForm('messagePlaceholder'),
    submit: tForm('submit'),
    sending: tForm('sending'),
    successTitle: tForm('successTitle'),
    successBody: tForm('successBody'),
    sendAnother: tForm('sendAnother'),
    errors: {
      name: tForm('errors.name'),
      email: tForm('errors.email'),
      message: tForm('errors.message'),
      unexpected: tForm('errors.unexpected'),
    },
  };

  const whatsappLink = buildWhatsAppLink(contact?.whatsapp);
  const whatsappDisplay = formatWhatsAppDisplay(contact?.whatsapp);
  const phone = contact?.phone?.trim() || null;
  const email = contact?.email?.trim() || null;
  const address = contact?.address?.trim() || null;
  const address2 = contact?.address2?.trim() || null;
  const addressLabel = contact?.addressLabel?.trim() || null;

  type SocialIcon = ComponentType<{ size?: number; title?: string }>;
  const socials = [
    { url: social?.instagram, label: 'Instagram', Icon: SiInstagram as SocialIcon },
    { url: social?.tiktok, label: 'TikTok', Icon: SiTiktok as SocialIcon },
    { url: social?.youtube, label: 'YouTube', Icon: SiYoutube as SocialIcon },
    { url: social?.facebook, label: 'Facebook', Icon: SiFacebook as SocialIcon },
  ].filter((s): s is { url: string; label: string; Icon: SocialIcon } =>
    Boolean(s.url && s.url.trim())
  );

  return (
    <section className="section contact-section" id="contact" style={{ paddingTop: 0 }}>
      <div className="container">
        <div className="section-head">
          <div>
            <div className="eyebrow" style={{ marginBottom: 16 }}>
              {t('eyebrow')}
            </div>
            <h2 className="section-title">{t('title')}</h2>
          </div>
          {t('sub') ? <p className="section-sub">{t('sub')}</p> : null}
        </div>

        <div className="contact-grid">
          {/* Form */}
          <div className="contact-form-col">
            <ContactForm locale={locale} strings={formStrings} />
          </div>

          {/* Channels we already have in the admin */}
          <div className="contact-info-col">
            <h3 className="contact-info-title">{t('directTitle')}</h3>

            <ul className="contact-channels">
              {whatsappLink ? (
                <li className="contact-channel">
                  <span className="contact-channel-icon" aria-hidden="true">
                    <SiWhatsapp size={18} />
                  </span>
                  <span className="contact-channel-body">
                    <span className="contact-channel-label">WhatsApp</span>
                    <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                      {whatsappDisplay}
                    </a>
                  </span>
                </li>
              ) : null}

              {phone ? (
                <li className="contact-channel">
                  <span className="contact-channel-icon" aria-hidden="true">
                    <Phone size={18} />
                  </span>
                  <span className="contact-channel-body">
                    <span className="contact-channel-label">{t('phoneLabel')}</span>
                    <a href={`tel:${phone.replace(/\s+/g, '')}`}>{phone}</a>
                  </span>
                </li>
              ) : null}

              {email ? (
                <li className="contact-channel">
                  <span className="contact-channel-icon" aria-hidden="true">
                    <Mail size={18} />
                  </span>
                  <span className="contact-channel-body">
                    <span className="contact-channel-label">{t('emailLabel')}</span>
                    <a href={`mailto:${email}`}>{email}</a>
                  </span>
                </li>
              ) : null}

              {address ? (
                <li className="contact-channel">
                  <span className="contact-channel-icon" aria-hidden="true">
                    <MapPin size={18} />
                  </span>
                  <span className="contact-channel-body">
                    <span className="contact-channel-label">
                      {addressLabel ?? t('addressLabel')}
                    </span>
                    <span className="contact-channel-value">
                      {address}
                      {address2 ? (
                        <>
                          <br />
                          {address2}
                        </>
                      ) : null}
                    </span>
                  </span>
                </li>
              ) : null}
            </ul>

            {socials.length > 0 ? (
              <div className="contact-socials">
                <span className="contact-channel-label">{t('followLabel')}</span>
                <div className="contact-socials-row">
                  {socials.map(({ url, label, Icon }) => (
                    <a
                      key={label}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="contact-social-link"
                      aria-label={label}
                      title={label}
                    >
                      <Icon size={20} title={label} />
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
