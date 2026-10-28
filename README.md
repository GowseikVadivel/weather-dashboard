# Weather Dashboard

A responsive, bright-minimal weather dashboard with a server-side WeatherAPI proxy and a raw/formatted JSON inspector.

## Features
- Search any supported city; Enter submits.
- Ten popular-city shortcuts.
- Current temperature, condition, feels-like, humidity, wind, UV, cloud cover, local time.
- Deterministic mood engine in `public/app.js`.
- Raw and formatted JSON tabs with copy actions.
- Server-side API key; the browser only calls `/api/weather`.
- Input validation, timeout, upstream error handling, stale-request protection, accessible controls and reduced-motion support.

## Run locally
1. Install Node.js and the Vercel CLI.
2. Copy `.env.example` to `.env` and set `WEATHERAPI_KEY` to a newly rotated key.
3. Run `npm install` (no runtime packages are required) and `vercel dev`.
4. Open the local URL shown by Vercel.

## Deploy to Vercel
1. Create a GitHub repository and upload these files.
2. Import the repository at https://vercel.com/new.
3. In **Project → Settings → Environment Variables**, add `WEATHERAPI_KEY` using your newly rotated WeatherAPI key for Production, Preview, and Development as needed.
4. Deploy, then test several cities and the JSON inspector.

Do not commit `.env`, paste credentials into frontend files, or reuse credentials that were exposed in a chat. Rotate the Vercel token shared with the project brief before using a new token for any account operations.

## Mood priority
1. Temperature >= 38°C → Scorching
2. Temperature <= 5°C → Freezing
3. Humidity >= 80% and temperature >= 28°C → Muggy
4. Wind >= 30 km/h → Windy
5. Temperature 20–30°C, humidity <= 60%, wind <= 20 km/h → Pleasant
6. Temperature 15–30°C, humidity <= 75%, wind <= 30 km/h → Comfortable
7. Otherwise → Mixed

The API inspector displays the response body returned by the upstream API (including upstream error bodies when JSON), with the server-side credential never returned to the client. The endpoint intentionally returns a generic error if the server key is missing.
