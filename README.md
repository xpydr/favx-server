# FavX server

REST API for **marketplace reward redemptions**: it loads the user profile and reward from Supabase, checks credits and stock, debits `credit_balance`, decrements `quantity_available`, and inserts a `reward_redemptions` row with `status: 'pending'`.

## Stack

- Node.js (ES modules), [Fastify](https://fastify.dev/) v5, `@fastify/cors`, `@supabase/supabase-js`
- Uses the Supabase **service role** key in `lib/supabase.js` — server-side only; do not expose to browsers or untrusted clients.

## Environment

| Variable | Required | Notes |
|----------|----------|--------|
| `SUPABASE_URL` | yes | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Service role key (secret) |
| `PORT` | no | Listen port; default `3000` |

## Run

```bash
npm install
npm start        # production-style
npm run dev      # watch mode (node --watch)
```

## API

### `GET /`

Returns a simple JSON object (health / smoke check).

### `POST /redeem`

**Body (JSON):** `user_id`, `reward_id` — both required (non-empty), as stored in the database.

**Success:** `200` — `{ "ok": true, "redemption": { ... } }`

**Errors (non-exhaustive):**

| Status | `code` | When |
|--------|--------|------|
| `400` | `VALIDATION_ERROR` | Missing or empty `user_id` / `reward_id` |
| `404` | `PROFILE_NOT_FOUND` | No profile for `user_id` |
| `404` | `REWARD_NOT_FOUND` | No reward for `reward_id` |
| `409` | `INSUFFICIENT_CREDITS` | Not enough `credit_balance` for `price_credits` |
| `409` | `OUT_OF_STOCK` | `quantity_available` is not positive |
| `500` | `DATABASE_ERROR` | Supabase error; `message` may include details |

## Operations note

Redemption uses separate updates and then an insert; under heavy concurrency we may want database transactions or Row Level Security patterns so balance, stock, and redemption rows stay consistent.
