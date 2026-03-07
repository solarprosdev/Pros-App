This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Auth: SendGrid OTP login

- **Flow:** User enters email → app generates a 7-character alphanumeric code → SendGrid emails it → user enters the code → if it matches, they’re logged in (session cookie).
- **No Firebase.** Session is a signed cookie (JWT-style) using `JWT_SECRET`.

**What you need to do:**

1. Get an API key from [SendGrid](https://app.sendgrid.com/) (Settings → API Keys → Create API Key with Mail Send).
2. Copy `.env.local.example` to `.env.local` and set:
   - `SENDGRID_API_KEY` – your SendGrid API key
   - `JWT_SECRET` – a long random string (min 16 chars) for signing sessions
3. Optional: `SENDGRID_FROM_EMAIL` and `SENDGRID_FROM_NAME` for the sender (defaults to `noreply@example.com`; in production use a verified sender in SendGrid).

Then run `npm run dev`, open `/`, enter your email, request a code, and sign in with the code from the email.

---

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

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
