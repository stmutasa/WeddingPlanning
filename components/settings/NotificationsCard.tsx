"use client";

import { useState } from "react";
import useSWR from "swr";
import { apiDelete, apiPatch, apiPost, fetcher } from "@/lib/api";
import { useAppSettings, useMe } from "@/lib/hooks";
import { Button, Card, SectionLabel, Select, Toggle, useToast } from "@/components/ui";
import { Banner, CardSkeleton } from "@/components/common";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Settings › Notifications (DESIGN.md §6). Push needs three things to line
 * up: VAPID keys on the server, a service worker, and the browser's own
 * permission — the card says which one is missing rather than failing
 * silently. On iOS none of it works until the app is on the Home Screen.
 */
export function NotificationsCard({ appName }: { appName: string }) {
  const { me, mutate } = useMe();
  const { appSettings, mutate: mutateApp } = useAppSettings();
  const vapid = useSWR<{ publicKey: string | null; configured: boolean }>(
    "/api/push/vapid",
    fetcher,
  );
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!me || !appSettings) return <CardSkeleton />;

  const supported =
    typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
  const permission = supported ? Notification.permission : "unsupported";

  async function enablePush() {
    setBusy(true);
    setError(null);
    try {
      if (!vapid.data?.configured || !vapid.data.publicKey) {
        setError("This server has no VAPID keys, so it cannot send push notifications yet.");
        return;
      }
      const result = await Notification.requestPermission();
      if (result !== "granted") {
        setError("The browser refused notification permission.");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid.data.publicKey),
      });
      const json = subscription.toJSON() as { endpoint?: string; keys?: Record<string, string> };
      await apiPost("/api/push/subscribe", {
        endpoint: json.endpoint,
        keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
      });
      await apiPatch("/api/settings/me", { pushEnabled: true });
      await mutate();
      toast("Notifications on for this device");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not switch notifications on");
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await apiDelete("/api/push/unsubscribe", { endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      await apiPatch("/api/settings/me", { pushEnabled: false });
      await mutate();
      toast("Notifications off");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not switch notifications off");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <SectionLabel>Notifications</SectionLabel>

      {error ? (
        <Banner tone="warn" className="mb-3">
          {error}
        </Banner>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">On this device</p>
          <p className="text-xs text-ink-soft">
            {!supported
              ? "This browser cannot do web push."
              : !vapid.data?.configured
                ? "The server has no VAPID keys yet."
                : permission === "denied"
                  ? "Blocked in the browser's site settings."
                  : me.pushEnabled
                    ? "The weekly digest and payment reminders arrive here."
                    : "Off — nothing is sent to this device."}
          </p>
        </div>
        <Toggle
          checked={me.pushEnabled}
          disabled={busy || !supported || !vapid.data?.configured}
          onChange={(checked) => (checked ? enablePush() : disablePush())}
          label=""
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Select
          label="Digest day"
          value={String(appSettings.digestDay)}
          onChange={async (e) => {
            await apiPatch("/api/settings/app", { digestDay: Number(e.target.value) });
            await mutateApp();
          }}
        >
          {DAYS.map((day, index) => (
            <option key={day} value={index}>
              {day}
            </option>
          ))}
        </Select>
        <Select
          label="Digest hour"
          value={String(me.digestHour)}
          onChange={async (e) => {
            await apiPatch("/api/settings/me", { digestHour: Number(e.target.value) });
            await mutate();
          }}
        >
          {Array.from({ length: 24 }).map((_, hour) => (
            <option key={hour} value={hour}>
              {String(hour).padStart(2, "0")}:00
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">Payment reminders</p>
          <p className="text-xs text-ink-soft">
            One push each morning for instalments due inside seven days. They ride on the same
            switch as the digest — off when notifications are off for this device.
          </p>
        </div>
        <Toggle checked={me.pushEnabled} disabled onChange={() => {}} label="" />
      </div>

      <Banner tone="info" className="mt-3">
        On an iPhone, notifications only work from the installed app: open this site in Safari, tap
        Share, then Add to Home Screen, and turn them on from there.
      </Banner>

      {supported && !busy ? (
        <Button
          size="sm"
          variant="ghost"
          className="mt-2"
          onClick={() =>
            new Notification(appName, { body: "Notifications look right on this device." })
          }
          disabled={permission !== "granted"}
        >
          Send a test notification
        </Button>
      ) : null}
    </Card>
  );
}

/** VAPID keys arrive base64url; PushManager wants raw bytes. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalised);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}
