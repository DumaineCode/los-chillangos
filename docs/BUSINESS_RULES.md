# Business Rules Manual — Los Chillangos Bike Fleet & Bookings

> **Purpose**: Single source of truth for all booking, fleet, rental, and private-group rules.
> Every feature implementation MUST comply with this document.

---

## 1. Fleet Definition

| Property | Value |
|----------|-------|
| Fleet size | Configurable (`BookingSettings.totalBikes`, default 8) |
| Bike model | Single model, no height/size variants |
| Charge type | Electric (e-bikes) |

All bikes are identical and interchangeable. The only variable is **quantity available at a given moment**.

---

## 2. Tour Types (Bike Usage)

| Tour flag | Consumes fleet? | Subject to charging rules? | Subject to ticket cutoff? |
|-----------|:-:|:-:|:-:|
| `usesBikes = true` | ✅ Yes | ✅ Yes | ✅ Yes |
| `usesBikes = false` (walking, food, day trip) | ❌ No | ❌ No | ❌ No |

Walking tours, food tours, and day trips can be scheduled at **any time** without fleet constraints.

---

## 3. Charging Buffer Rule (2-hour gap)

> **Rule**: Between the END of one bike tour and the START of the next bike tour, there MUST be at least `bufferMinutes` (default 120 min / 2 hours) for the bikes to recharge.

### Formal definition

```
Let tour_A end at:    end_A = start_A + durationMinutes_A
Let tour_B start at:  start_B

VALID if:  start_B >= end_A + bufferMinutes
           OR end_B + bufferMinutes <= start_A  (B finishes well before A starts)
```

### Current implementation status: ✅ IMPLEMENTED

- `src/lib/booking/fleet.ts` → `checkRechargeCooldown()`
- Enforced in checkout POST (`evaluateBikeSlot`)
- Advisory in availability GET (grey out blocked slots)
- Symmetric: checks in both directions (A→B and B→A)

### Edge cases

- Back-to-back tours that merely TOUCH at the boundary (end_A === start_B) are **NOT** valid — the buffer must be strictly respected.
- A bike tour without a valid `durationMinutes` is **fail-safe rejected** (never silently allowed).

---

## 4. Fleet Capacity Rule (Overlapping Tours)

> **Rule**: The SUM of slot capacities of all bike tours whose ride windows overlap cannot exceed `totalBikes`.

### Formal definition

```
For any instant T during the day:
  Σ(capacity of every bike tour whose [start, end) window contains T) ≤ totalBikes
```

Capacity is the FULL SLOT CUPO (max persons the slot can hold), NOT the number of persons actually booked. This reserves bikes per departure, not per person.

### Current implementation status: ✅ IMPLEMENTED

- `src/lib/booking/fleet.ts` → `checkFleetCapacity()`
- Uses half-open overlap: `aStart < bEnd && bStart < aEnd`

---

## 5. Ticket Cutoff Rule (Day-Before-Noon Closure)

> **Rule**: Tickets (booking slots) for a bike tour close the **day before** the tour at **12:00 PM (noon) CDMX time**.

### Formal definition

```
Let tour_date = the calendar date of the tour (CDMX)
Let cutoff = (tour_date - 1 day) at 12:00:00 CDMX

IF now >= cutoff:
  → Ticket sales for that tour are CLOSED
  → Remaining unsold bike capacity becomes available for RENTAL
```

### Applies to

- ONLY tours with `usesBikes = true`
- Walking tours / non-bike tours are NOT subject to this rule (they can accept bookings until the existing same-day cutoff of 2 hours before departure)

### Current implementation status: ❌ NOT IMPLEMENTED

**What exists now**: Only a same-day cutoff (`SAME_DAY_CUTOFF_HOURS = 2` — if the tour starts in less than 2 hours from now, the slot closes). This is a **different, narrower rule** that only fires on the day of the tour itself.

**What's missing**: A day-before-noon cutoff for bike tours. After Saturday at noon CDMX, nobody can buy tickets for Sunday's bike tours.

---

## 6. Bike Rental System (Standalone Rental)

> **Rule**: After the ticket cutoff passes (day before at noon), all unsold bikes become available for **standalone rental** (no tour, just the bike).

### Rental durations & pricing

Price is **per bike**, per duration tier. Renting 3 bikes for 2h = 3 × (2h price).

> **Tiers and prices are ADMIN-CONFIGURABLE** — modeled as an editable list in
> `BookingSettings.rentalTiers[]` = `{ durationMinutes, price }`. The client can
> add/remove tiers and change prices without code changes.

Current client-provided values (default seed):

| Duration | Price (per bike) |
|----------|------------------|
| 1 hour | 200 |
| 2 hours | 300 |
| 4 hours | 450 |
| 6 hours | 600 |

> ✅ **CURRENCY DECIDED: MXN everywhere, no selector.** (Client decision.)
> The whole system (tours + rentals) charges in **MXN**. Foreign customers still
> pay — their bank auto-converts at card-network rates. No currency selector, no
> conversion code, no exchange rate to maintain.
>
> **Migration required** (currently tours default to USD):
> - `Bookings.currency` default: `'USD'` → `'MXN'`.
> - Checkout route (`app/api/booking/checkout/route.ts`): `currency = 'USD'` → `'MXN'`.
> - Stripe line items + session: charge in `mxn`.
> - Existing tour `price` values must be **re-entered in MXN** by the client
>   (they were authored as USD numbers).
> - Any USD symbol/format in the UI → MXN format ($ / MXN).

### Operating hours (rental return ceiling)

> **RECOMMENDED**: Add `openTime` / `closeTime` to `BookingSettings` (CDMX wall
> clock). Default suggestion: **09:00 – 19:00**.

The close time is the hard ceiling for every rental:

```
VALID only if:  rental_start + durationMinutes <= closeTime
```

Rationale: e-bikes need daylight for safe riding and staffed hours to receive the
return + plug in to charge. With a 19:00 close, the last 6h rental starts at 13:00.
Configurable so the client adjusts to real operating reality.

### Rental start granularity

> **RECOMMENDED**: Fixed **30-minute** blocks (09:00, 09:30, 10:00…), stored as
> `BookingSettings.rentalGranularityMinutes` (default 30).

Why fixed blocks over any-minute:
- Discrete availability math (the whole-day fleet timeline becomes tractable).
- Clean UI picker instead of a free-form time entry.
- Predictable staff operations (batched handouts, not random times).
- Consistent with how tour `timeSlots` already work.

The flexibility lost is negligible; the operational + technical simplicity gained
is large.

### CRITICAL PREMISE: tour capacity = totalBikes

> Each bike tour is configured with `timeSlots[].capacity = totalBikes`. Every tour
> is offered with the FULL fleet available. Therefore:

```
bikes_available_for_rental = totalBikes - persons_actually_sold_for_the_tour
```

NOT `totalBikes - capacity` (that would always be 0). We count **persons actually
booked** (status = paid, or pending with a live hold), because those are the only
bikes truly committed.

### When does rental open?

- ONLY after the §5 ticket cutoff has passed (day before at noon CDMX).
- Consequence: rentals are effectively **today or tomorrow only** — you cannot
  rent a bike for next week.
- Before the cutoff, bike inventory is still "reserved" for potential tour sales,
  so nothing is rentable yet.

### Rental availability is a whole-day fleet timeline

The hard part: a rented bike is unavailable during **`[start, start + duration + buffer]`**
(ride + recharge). A day may have MULTIPLE tours, and a rented bike unsold for the
10:00 AM tour might still be NEEDED for the 12:00 PM tour. So the rental must not
starve any LATER tour of the bikes it sold.

```
For a rental request of Q bikes, start S, duration Dur:
  rental_busy_window = [S, S + Dur + bufferMinutes]   (ride + recharge)

  VALID only if, for EVERY scheduled bike tour Ti later that day:
    bikes_free_at(start_i) >= persons_sold_i

  where bikes_free_at(t) =
    totalBikes
    - Σ(persons_sold for tours whose busy window contains t)
    - Σ(bikes in other rentals whose busy window contains t)
    - Q   (this new rental, if its busy window contains t)
```

### Worked example (user's scenario)

```
Sunday: tour at 12:00 PM, duration 120 min, 5 persons sold (of 8 bikes).
  → 3 bikes unsold → rentable.
Someone wants to rent Sunday 9:00 AM.
  - 1h rental at 09:00 → busy [09:00, 12:00] (10:00 end + 2h charge). Charge-done
    at 12:00 == tour start 12:00 → boundary touch, REJECTED (align with §3 strict).
    A 1h rental at 08:30 → busy [08:30, 11:30], charged by 11:30 < 12:00 → OK.
  - 6h rental → busy [09:00, 17:00]. Way past the 12:00 tour → REJECTED
    ("no alcanzan a estar disponibles para el siguiente tour").
```

### If there is NO later tour that day

```
IF no scheduled bike tour remains after the rental's busy window:
  → Only §fleet-size limit applies (Q + concurrent rentals ≤ available bikes).
  → Any duration allowed as long as bikes return by end of operating day.
```

### Rental sales channel

- Same website, same Stripe Checkout as tour bookings.

### Current implementation status: ❌ NOT IMPLEMENTED

- No rental collection/model exists
- No rental booking flow exists
- No rental availability calculation exists
- No concept of "unsold bikes become rentable" exists

---

## 7. Private Group Rules

> **Rule**: A group can privatize a departure (exclusive use) if and only if the fleet can accommodate them without conflicting with other obligations.

### Group size limit

> No fixed minimum or maximum. A group can privatize with **whatever the fleet can
> accommodate** — up to `totalBikes` available at that window.

### Conditions for private group availability

A private departure on date D at time T is available if ALL of:

1. **Fleet capacity**: The group's size ≤ available bikes at that time
   ```
   group_size <= totalBikes - bikes_consumed_by_other_tours_at_that_time
   ```

2. **No scheduling conflicts**: The bikes are not:
   - Reserved for another tour whose window overlaps [T, T + duration + buffer)
   - Rented out during that window

3. **Charging buffer respected**: No bike tour ends within `bufferMinutes` before time T, AND the private tour ending does not violate buffer for the next tour.

4. **Not already rented**: Bikes that are out on rental cannot be counted as available for the private group.

### Private booking flow

1. Customer selects "Private group"
2. System shows ONLY dates/times where conditions 1–4 are satisfied
3. Customer selects date + time
4. System reserves the full slot capacity for the private group

### Current implementation status: ⚠️ PARTIALLY IMPLEMENTED

**What exists**: "Tour privado" is implemented as an **Extra** (flat fee add-on). The customer can select it in the booking wizard, but:
- ❌ It does NOT check fleet availability specifically for the private group
- ❌ It does NOT filter available dates based on private-specific fleet constraints
- ❌ It does NOT prevent conflicts with rentals
- ✅ It DOES charge the privatize fee (now as an Extra, previously as a legacy field)

---

## 8. Same-Day Cutoff (Existing Rule — Retained)

> **Rule**: A departure slot closes 2 hours before its start time on the same calendar day.

This is an ADDITIONAL safety rule that applies to ALL tours (bike and non-bike). It prevents someone booking a tour that starts in 30 minutes.

### Current implementation status: ✅ IMPLEMENTED

- `src/lib/booking/availability.ts` → `isSameDayCutoffPassed()`
- `SAME_DAY_CUTOFF_HOURS = 2`

---

## 9. Rules Interaction Matrix

| Scenario | Rules that apply |
|----------|-----------------|
| Booking a bike tour | §3 Charging buffer + §4 Fleet capacity + §5 Day-before cutoff + §8 Same-day cutoff |
| Booking a walking tour | §8 Same-day cutoff only |
| Renting a bike (standalone) | §6 Rental constraints (return + charge before next tour) |
| Private group (bike tour) | §3 + §4 + §5 + §7 Private rules + §8 |
| Private group (walking tour) | §8 Same-day cutoff only (no fleet constraints) |

---

## 10. Implementation Priority

| # | Rule | Status | Priority |
|---|------|--------|----------|
| 1 | Charging buffer (2h) | ✅ Done | — |
| 2 | Fleet capacity (overlapping tours) | ✅ Done | — |
| 3 | Same-day cutoff (2h before) | ✅ Done | — |
| 4 | **Day-before-noon cutoff for bike tours** | ❌ Missing | 🔴 HIGH |
| 5 | **Bike rental system** | ❌ Missing | 🔴 HIGH |
| 6 | **Private group fleet-aware gating** | ⚠️ Partial | 🟡 MEDIUM |

**Build order (dependency-driven):**
1. Day-before-noon cutoff (§5) — pure logic, extends existing `availability.ts`.
2. Rental system (§6) — depends on §5 (rental only opens after cutoff) + fleet timeline.
3. Private group gating (§7) — reuses the fleet timeline built for §6.

---

## 11. Client Answers (Resolved)

1. **Rental pricing**: Price is **per bike**, per duration tier (1h / 2h / 3h / 6h).
   Exact amounts still TBD by client. Renting N bikes = N × tier price.

2. **Rental bikes = unsold tour bikes**: Confirmed. Each tour is configured with
   `capacity = totalBikes`, so rentable bikes = `totalBikes - persons_actually_sold`.
   We count actually-booked persons, NOT full slot capacity.

3. **Multiple tours per day**: The day-before-noon cutoff applies to **ALL** bike
   tours of that day simultaneously.

4. **Rental booking flow**: Same website, same Stripe Checkout as tours.

5. **Private group size**: No fixed min/max — whatever the fleet can accommodate.

6. **Rental window**: Only AFTER the cutoff passes → effectively today/tomorrow only.
   No advance rentals for future weeks.

7. **Rental tiers (configurable)**: 1h=200, 2h=300, 4h=450, 6h=600 (per bike).
   Both tiers and prices must be admin-editable (`rentalTiers[]`).

8. **Operating hours (recommended, pending final OK)**: 09:00–19:00 CDMX,
   configurable. Close time caps rental end.

9. **Start granularity (recommended, pending final OK)**: fixed 30-min blocks,
   configurable (`rentalGranularityMinutes`).

10. **Currency**: MXN everywhere, no selector (RESOLVED). Migration from USD needed.

### Remaining items to confirm before build

- **Final OK** on 19:00 close time and 30-min granularity (my recommendations).
- **Open time**: is 09:00 the real open, or earlier/later?

---

## Appendix: Current Architecture Reference

| Layer | File | Responsibility |
|-------|------|----------------|
| Fleet config | `src/globals/BookingSettings.ts` | `totalBikes`, `bufferMinutes`, `freeCancellationDays` |
| Tour definition | `src/collections/Tours.ts` | `usesBikes`, `durationMinutes`, `timeSlots`, `availableDays` |
| Booking record | `src/collections/Bookings.ts` | Reservation state machine |
| Availability (pure) | `src/lib/booking/availability.ts` | Date/time math, weekday gating, same-day cutoff |
| Capacity (async) | `src/lib/booking/capacity.ts` | Seats taken queries |
| Fleet (pure + async) | `src/lib/booking/fleet.ts` | Bike fleet rules: capacity + cooldown |
| Availability API | `app/api/booking/availability/route.ts` | Public GET endpoint |
| Checkout API | `app/api/booking/checkout/route.ts` | Authoritative booking creation |
| Agenda (admin) | `src/lib/booking/agenda.ts` | Week view for operators |
