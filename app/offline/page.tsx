const appName = process.env.APP_NAME ?? "Harusi";

// Precached by public/sw.js and served for navigations while offline.
export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-6 text-center">
      <p className="wordmark text-3xl text-ink">{appName}</p>
      <p className="max-w-sm text-sm text-ink-soft">
        You&apos;re offline. Reconnect to see the latest budget, payments and tasks — anything
        already loaded on this device stays visible.
      </p>
    </main>
  );
}
