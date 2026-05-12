# TrustPay Deployment

This guide prepares the KFIP demo deployment. The fastest submission path is a single Vercel deployment from `apps/mobile`, which includes the Expo Web app and a lightweight `/api` Demo API.

## Single Vercel Deployment

Recommended for KFIP submission.

Current production URL:

```text
https://xrpl-tawny.vercel.app
```

1. Set the Vercel project root to the repository root.
2. Deploy with the root `vercel.json`.
3. The web app calls the bundled Vercel Demo API at `/api`.

No XRPL seed/private key is required for the Vercel demo. The live XRPL proof is documented separately in `docs/XRPL-TESTNET-EVIDENCE.md`.

## Optional Hosted Nest API

Use this if you want the web app to call the real NestJS Demo Mode API instead of the bundled Vercel Demo API.

### API Deployment

Recommended host: Render.

1. Connect the GitHub repository to Render.
2. Use the root `render.yaml` blueprint.
3. Deploy the `trustpay-api` service.
4. Copy the deployed API URL, for example `https://trustpay-api.onrender.com`.

The API runs in Demo Mode and seeds canonical demo data on startup. It does not require XRPL seeds or private keys.

### Web Deployment With External API

Recommended host: Vercel.

1. Set the Vercel project root to `apps/mobile`.
2. Set this environment variable:

```text
EXPO_PUBLIC_API_URL=https://<your-render-api-url>
```

3. Deploy with the existing `apps/mobile/vercel.json`.

## Local Verification

Run the API:

```bash
pnpm demo:reset
pnpm demo:api
```

Run the web app locally:

```bash
EXPO_PUBLIC_API_URL=http://localhost:3000 pnpm --filter mobile exec expo start --web
```

Build the static web output:

```bash
EXPO_PUBLIC_API_URL=http://localhost:3000 pnpm --filter mobile exec expo export --platform web
```

## Demo Accounts

```text
Consumer: 010-2000-0001 / OTP: 123456
Business: 010-1000-0002 / OTP: 123456
```
