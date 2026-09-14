"use client";

import { useState } from "react";
import { apiPatch } from "@/lib/api";
import { useMe } from "@/lib/hooks";
import { HUES, THEMES, type Hue, type Theme } from "@/lib/types";
import { Button, Card, HueDot, Input, SectionLabel, Select, useToast } from "@/components/ui";
import { Banner, CardSkeleton } from "@/components/common";

const TIMEZONES = [
  "America/New_York",
  "America/Los_Angeles",
  "America/Chicago",
  "Europe/London",
  "Africa/Nairobi",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "UTC",
];

/** Settings › Profile (DESIGN.md §6): name, hue, timezone, theme. */
export function ProfileCard() {
  const { me, mutate } = useMe();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  if (!me) return <CardSkeleton />;

  return (
    <ProfileForm
      key={me.id}
      initial={me}
      onSaved={mutate}
      saving={saving}
      setSaving={setSaving}
      toast={toast}
    />
  );
}

function ProfileForm({
  initial,
  onSaved,
  saving,
  setSaving,
  toast,
}: {
  initial: NonNullable<ReturnType<typeof useMe>["me"]>;
  onSaved: () => Promise<unknown>;
  saving: boolean;
  setSaving: (value: boolean) => void;
  toast: (message: string) => void;
}) {
  const [displayName, setDisplayName] = useState(initial.displayName ?? "");
  const [hue, setHue] = useState<Hue>(initial.hue);
  const [timezone, setTimezone] = useState(initial.timezone);
  const [theme, setTheme] = useState<Theme>(initial.theme);

  async function save() {
    setSaving(true);
    try {
      await apiPatch("/api/settings/me", {
        displayName: displayName.trim() || undefined,
        hue,
        timezone,
        theme,
      });
      toast("Profile saved");
      await onSaved();
      // The theme is stamped on <html> from this value at layout level.
      document.documentElement.setAttribute("data-theme", theme);
      if (theme === "system") document.documentElement.removeAttribute("data-theme");
    } finally {
      setSaving(false);
    }
  }

  const zones = TIMEZONES.includes(timezone) ? TIMEZONES : [timezone, ...TIMEZONES];

  return (
    <Card>
      <SectionLabel>Profile</SectionLabel>
      <div className="flex flex-col gap-3">
        <Input
          label="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />

        <div>
          <p className="label-tracked mb-2">Your colour</p>
          <div className="flex flex-wrap gap-2">
            {HUES.map((option) => (
              <button
                key={option}
                onClick={() => setHue(option)}
                aria-pressed={hue === option}
                aria-label={option}
                className={`focus-ring flex min-h-11 items-center gap-2 rounded-full px-3 text-[12px] font-semibold capitalize ${
                  hue === option
                    ? "border-2 border-ink text-ink"
                    : "border-2 border-transparent bg-sunken text-ink-soft"
                }`}
              >
                <HueDot hue={option} size={10} />
                {option}
              </button>
            ))}
          </div>
          {hue === "red" ? (
            <Banner tone="warn" className="mt-2">
              Red is also the colour this app uses for overspending and overdue payments. Your name
              in red will read as an alarm at a glance — pick another if you can.
            </Banner>
          ) : null}
        </div>

        <Select label="Timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
          {zones.map((zone) => (
            <option key={zone} value={zone}>
              {zone.replace("_", " ")}
            </option>
          ))}
        </Select>

        <Select label="Theme" value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
          {THEMES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>

        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </Card>
  );
}
