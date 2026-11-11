# Averages for Teachers

The pages for teach.averages.io: a faster way for teachers to work in Schoology. The API is in the sibling repo, `averages.teachers.api`.

Nothing from a student's use of Averages.io is ever shown to a teacher. Teachers see only what Schoology already shows them.

## How it fits together

- This repo is one Cloudflare Worker, `averages-teachers`, on teach.averages.io.
- Pages come straight from `public/`. The Worker in `worker/index.js` only runs for `/api` and `/api/*`, and hands those to the `averages-teachers-api` Worker through a service binding.
- So pages and API share one origin: no CORS, and the session cookie stays on teach.averages.io only.

## Run it locally

Keep both repos side by side in one folder:

```
averages.teachers/
averages.teachers.api/
```

1. In each repo: `npm ci`
2. In `averages.teachers.api`: copy `.dev.vars.example` to `.dev.vars` and fill in `SESSION_SECRET` (`openssl rand -base64 32`).
3. In this repo: `npm run dev`. Both Workers start together on http://localhost:8788.

The home page shows "Server ready" when it can reach the API.

## Deploy

1. Deploy `averages.teachers.api` first (see its README).
2. Then this repo: `npm run deploy`. The first deploy creates the teach.averages.io DNS record and certificate.

## Tests

`npm test`

## Files

- `worker/index.js`: sends `/api/*` to the API.
- `public/`: the pages. `js/passkeys.js` is the browser side of passkeys. `favicon.ico`, `favicon.svg` and `apple-touch-icon.png` are the black mark (a black to dark gray gradient). `mark.svg` is the coral mark used on the pages.
- `public/_headers`: security headers (a strict Content-Security-Policy: scripts and styles only from this origin, no inline scripts).

## License

GPL v3, like Averages.io.
