import { NextResponse } from 'next/server';

import { contactMessageSchema } from '../../../src/lib/contact/contactMessage';
import { sendContactNotification } from '../../../src/lib/email/sendContact';
import { getPayload } from '../../../src/lib/payload';

/**
 * POST /api/contact — public contact form submission.
 *
 * Flow (mirrors the booking checkout route):
 *   1. Parse + Zod-validate the payload.
 *   2. Persist a `contact-messages` row (durable record in the admin).
 *   3. Fire-and-forget an owner notification email (Resend). Email is a
 *      non-essential side effect: a failure there must NOT fail the request,
 *      because the message is already safely stored.
 *
 * Always returns no-store so a stale 200/400 is never cached.
 */
export async function POST(request: Request): Promise<Response> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonNoStore({ error: 'invalid-payload', issues: [] }, 400);
  }

  const parsed = contactMessageSchema.safeParse(json);
  if (!parsed.success) {
    return jsonNoStore({ error: 'invalid-payload', issues: parsed.error.issues }, 400);
  }
  const data = parsed.data;
  const phone = data.phone && data.phone.length > 0 ? data.phone : null;

  const payload = await getPayload();

  let messageId: number;
  try {
    const created = await payload.create({
      collection: 'contact-messages',
      overrideAccess: true,
      data: {
        name: data.name,
        email: data.email,
        phone: phone ?? undefined,
        message: data.message,
        status: 'new',
      },
    });
    messageId = (created as { id: number }).id;
  } catch (err) {
    console.error('[contact] failed to create contact message row', err);
    return jsonNoStore({ error: 'create-failed' }, 500);
  }

  // Non-blocking side effect — never let an email failure fail the request.
  await sendContactNotification({
    messageId,
    name: data.name,
    email: data.email,
    phone,
    message: data.message,
    locale: data.locale,
  });

  return jsonNoStore({ ok: true }, 200);
}

function jsonNoStore(body: unknown, status: number): Response {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}
