import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres';

import { prependHeroToGallery } from '../lib/tours/prependHeroToGallery';

/**
 * Normalize a Local-API gallery (rows whose `image` may be a populated Media
 * object or a raw FK id) into the `{ image: number }[]` shape the pure
 * `prependHeroToGallery` transform expects. Shared by both directions.
 */
function toImageRows(gallery: { image: number | { id: number } | null }[] | null | undefined): {
  image: number;
}[] {
  return (gallery ?? []).map((g) => ({
    image: typeof g.image === 'object' && g.image !== null ? g.image.id : (g.image as number),
  }));
}

/**
 * Step 1 (non-destructive) — backfill each standard tour's former `heroImage`
 * into its `gallery` as `gallery[0]` (the cover), preserving existing order.
 *
 * TOURS-ONLY. The Landing global also defines a `heroImage` (`landing` table),
 * but it is a different concept and is NEVER referenced here — table scoping to
 * `tours` / `tours_gallery` is what guarantees Landing stays untouched.
 *
 * Design decisions (design.md §4.3, D3/D4/D5):
 *   - READ the soon-to-be-dropped `hero_image_id` column with raw SQL: the
 *     `heroImage` field is removed from the Payload schema in this change, so the
 *     Local API can no longer expose it, but the DB column still exists (PR #1
 *     does NOT drop it — the drop is deferred to PR #2).
 *   - WRITE via the Local API (`payload.update`) so Payload owns the internal
 *     `tours_gallery` array-table shape (`_order`, generated row `id`,
 *     `_parent_id`, `image_id`) instead of hand-guessing it in raw SQL.
 *   - The order-preserving + idempotent transform lives in the pure, unit-tested
 *     `prependHeroToGallery` helper so a partial run is safe to resume.
 *
 * `req` threads the migration transaction into every Local API call, so the
 * whole backfill is atomic. Per-tour failures are collected (not thrown on the
 * first bad row) so one migration run reports EVERY failing tour id + message;
 * after the loop, if any failures were collected we throw a single aggregated
 * error. That throw still rolls back the Payload-managed transaction, so the
 * release fails loudly and no partial backfill is committed — we just get
 * complete diagnostics instead of dying on the first bad tour.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  const { rows } = await db.execute<{ id: number; hero_image_id: number }>(
    sql`SELECT id, hero_image_id FROM tours WHERE hero_image_id IS NOT NULL`
  );

  payload.logger.info(`[backfill_tour_hero_into_gallery] ${rows.length} tour(s) with a hero to backfill`);

  const failures: { id: number; message: string }[] = [];

  for (const { id, hero_image_id } of rows) {
    try {
      // Read the current gallery through the Local API (field still in schema).
      const tour = await payload.findByID({ collection: 'tours', id, depth: 0, req });
      const current = toImageRows(tour.gallery);

      const next = prependHeroToGallery(hero_image_id, current);
      if (next === current) {
        payload.logger.info(`[backfill_tour_hero_into_gallery] tour ${id}: already prepended — skip`);
        continue; // idempotent no-op
      }

      await payload.update({
        collection: 'tours',
        id,
        data: { gallery: next },
        depth: 0,
        req, // run inside the migration transaction
      });
      payload.logger.info(
        `[backfill_tour_hero_into_gallery] tour ${id}: prepended former hero ${hero_image_id} as gallery[0]`
      );
    } catch (err) {
      // Collect and continue so one run surfaces EVERY failing tour, not just the first.
      const message = err instanceof Error ? err.message : String(err);
      payload.logger.error(`[backfill_tour_hero_into_gallery] tour ${id}: FAILED — ${message}`);
      failures.push({ id, message });
    }
  }

  if (failures.length > 0) {
    // Single aggregated throw → rolls back the transaction (nothing partial commits)
    // while reporting all failed tours at once for complete diagnostics.
    const detail = failures.map((f) => `tour ${f.id}: ${f.message}`).join('; ');
    throw new Error(
      `[backfill_tour_hero_into_gallery] ${failures.length} tour(s) failed to backfill — ${detail}`
    );
  }
}

/**
 * Intentionally a NON-DESTRUCTIVE no-op.
 *
 * The backfill is not cleanly reversible without per-row tracking: `up` is
 * idempotent (it skips tours whose `gallery[0].image` already equals the hero),
 * so at rollback time we cannot distinguish a former-hero row that `up` inserted
 * from an editor-authored `gallery[0]` that legitimately points at the same
 * image. A naive reverse would silently delete legitimate, editor-authored
 * gallery data.
 *
 * This is safe to leave as a no-op because PR #1 intentionally RETAINS
 * `hero_image_id`: a code rollback recovers each tour's cover via the old field.
 * The only residual effect of having run the forward migration is that the
 * former hero appears first in `gallery` — which is benign.
 *
 * `down` is kept present because Payload requires both directions; it logs a
 * clear warning and returns without mutating any data.
 */
export async function down({ payload }: MigrateDownArgs): Promise<void> {
  payload.logger.warn(
    '[backfill_tour_hero_into_gallery] down() is intentionally a no-op: backfill is not safely reversible; hero_image_id is retained for code rollback'
  );
}
