import * as Sentry from "@sentry/nextjs";

export function captureError(err: unknown, context?: Record<string, unknown>) {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    console.error("[tamtam]", err, context ?? "");
    return;
  }
  Sentry.withScope((scope) => {
    if (context) scope.setExtras(context);
    Sentry.captureException(err);
  });
}
