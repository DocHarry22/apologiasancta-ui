# Account recovery and email verification

Set these server-only environment variables before deployment:

| Variable | Value |
| --- | --- |
| `AUTH_PUBLIC_URL` | Canonical public application URL, using HTTPS in production. Never inferred from request headers. |
| `RESEND_API_KEY` | Resend API key with sending access. |
| `AUTH_EMAIL_FROM` | Sender on a domain verified in Resend, e.g. `Apologia Sancta <accounts@example.com>`. |

Email delivery uses the [Resend email API](https://resend.com/docs/api-reference/emails/send-email). No new package is needed. Missing configuration disables signup and email requests with a retryable 503; existing sign-in and issued link consumption remain available. Delivery failures log a fixed message without recipients, provider bodies, or tokens; users can request another link after service is restored.

The sign-in screen links to `/forgot-password` and `/verify-email`. New signup sends verification mail and opens `/verify-email`, without creating a session. New public and invited staff accounts must verify before login. Existing accounts retain sign-in access and can verify from Account → Security. Verification confirms mailbox ownership; password recovery still leaves an unverified new account requiring verification.

Reset links expire after 30 minutes; verification links expire after 24 hours. Both use random 256-bit tokens, persist only SHA-256 hashes, and are single-use. Reissuing a link replaces the earlier token of that purpose. Ordinary password changes also invalidate outstanding reset links. Opening a link never consumes it: reset requires submitting a new password, and verification requires pressing the confirmation button, so email link scanners cannot consume either token.

Tokens travel in URL fragments and are removed from the address bar after capture. Reopen the email if the page is refreshed before completion. Pages use `no-referrer` metadata and are excluded from search indexing. All account email API responses use `Cache-Control: no-store`.

Reset consumption atomically changes the password, clears the reset token, and records a millisecond session cutoff. Every earlier session fails the existing server-side freshness checks, including a session issued in the same millisecond. Recovery clears this browser’s session and CSRF cookies and requires a fresh sign-in. It preserves the account ID, learning progress, and saved research.

The account store initializes additive PostgreSQL/MySQL columns and an `auth_email_limits` table. PostgreSQL uses the existing private account schema and denies access to public/browser roles. The database role needs the same DDL permissions already required by account-store initialization. Expired rate-limit counters are pruned automatically. Production uses durable database storage; the existing memory adapter remains available for local development and tests.

Limits are shared across instances: five emails per normalized address per hour (across reset and verification), 20 email requests per IP per hour, and 30 link submissions per IP per 15 minutes. IP limits return 429 with `Retry-After`. Address limits silently suppress delivery with the same public response, including for unknown, inactive, and already verified addresses. The application proxy must supply a trustworthy client-IP header, as required by the existing login limiter.

Email lookup and delivery run with Next.js `after()` after the generic response, avoiding account enumeration through response bodies or email-provider latency. The UI adds a 60-second resend delay. Client delays supplement the database limits.

Before production release, configure a verified sender and exercise signup → verification → login → forgot password → reset → fresh login using a real inbox. Check that old sessions on another device fail and that reused/expired links offer a replacement. Automated tests cover the route, state, throttling, and UI behavior with a mocked mail provider; live delivery and production database execution require deployment verification.

Security controls follow the [OWASP forgot-password guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).
