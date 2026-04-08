This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Admin recovery

If you ever get locked out of the admin panel (e.g. accidentally rejected yourself or the DB record was wiped), restore your access with the bootstrap script:

```bash
npx tsx scripts/bootstrap-admin.ts your@email.com
```

This sets `status: "approved"` and `isAdmin: true` for that email in the `jobhunt` database. Safe to run multiple times.

## Clerk Webhook Setup

To sync users into MongoDB on sign-up, you need to configure a webhook in the Clerk dashboard.

1. Go to **Clerk Dashboard → Webhooks → Add Endpoint**.
2. Set the URL to `https://<your-domain>/api/webhooks/clerk`.
3. Subscribe to these events: `user.created`, `user.updated`, `user.deleted`.
4. Copy the **Signing Secret** and add it to your environment as `CLERK_WEBHOOK_SIGNING_SECRET`.

**Local development:** Use [ngrok](https://ngrok.com) to expose your local server (`ngrok http 3000`), then set the ngrok URL as the webhook endpoint in Clerk. Alternatively, use Clerk's built-in webhook tester in the dashboard to send test events directly without a tunnel.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
