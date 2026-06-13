import type { PayloadRequest } from 'payload';

import { draftMode } from 'next/headers';
import { redirect } from 'next/navigation';

import { getPayload } from '../../../../src/lib/payload';

/**
 * GET /next/preview?path=/en/tours/<slug>&locale=en&previewSecret=<secret>
 *
 * Live Preview entry point. The Tours collection `admin.livePreview.url`
 * loads this endpoint inside the admin's preview iframe. It:
 *   1. Verifies the shared `previewSecret` (rejects external callers).
 *   2. Authenticates the request against Payload (must be a logged-in admin).
 *   3. Enables Next.js draft mode so the tour page can fetch unpublished
 *      drafts (see `fetchTourForRender` in the tour detail page).
 *   4. Redirects to the localized tour route, which then renders the draft.
 *
 * Only relative `path` values are accepted so this can never be used as an
 * open redirect.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path');
  const previewSecret = searchParams.get('previewSecret');

  if (!previewSecret || previewSecret !== process.env.PAYLOAD_SECRET) {
    return new Response('You are not allowed to preview this page.', {
      status: 403,
    });
  }

  if (!path) {
    return new Response('Missing "path" search param.', { status: 400 });
  }

  if (!path.startsWith('/')) {
    return new Response('This endpoint only accepts relative preview paths.', {
      status: 400,
    });
  }

  const payload = await getPayload();

  let user;
  try {
    user = await payload.auth({
      req: request as unknown as PayloadRequest,
      headers: request.headers,
    });
  } catch (error) {
    payload.logger.error({ err: error }, 'Live preview auth check failed.');
    return new Response('You are not allowed to preview this page.', {
      status: 403,
    });
  }

  const draft = await draftMode();

  if (!user?.user) {
    draft.disable();
    return new Response('You are not allowed to preview this page.', {
      status: 403,
    });
  }

  draft.enable();
  redirect(path);
}
