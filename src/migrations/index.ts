import * as migration_20260713_000000_backfill_tour_hero_into_gallery from './20260713_000000_backfill_tour_hero_into_gallery';

export const migrations = [
  {
    up: migration_20260713_000000_backfill_tour_hero_into_gallery.up,
    down: migration_20260713_000000_backfill_tour_hero_into_gallery.down,
    name: '20260713_000000_backfill_tour_hero_into_gallery',
  },
];
