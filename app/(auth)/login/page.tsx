import { signInGoogleAction } from "@/lib/actions/auth-actions";
import { Button, KangaBand } from "@/components/ui";
import { MOTTO } from "@/lib/jina";
import { DevLoginButton } from "@/components/auth/DevLoginButton";

const appName = process.env.APP_NAME ?? "Harusi";

/**
 * Login (DESIGN.md §6): the wordmark, the app's motto proverb (§5.5 #1),
 * one line about the wedding, and Google. A non-allowlisted account is
 * turned away in the app's own words, not an auth error code.
 */
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const hasError = Boolean(params?.error);
  const devEmail = process.env.NODE_ENV !== "production" ? process.env.DEV_LOGIN_EMAIL : undefined;

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
      <KangaBand className="max-w-[220px]" />

      <div className="flex flex-col items-center gap-3">
        <p className="wordmark text-[56px] leading-none text-ink">{appName}</p>
        <p className="jina-text">{MOTTO.swahili}</p>
        <p className="text-xs text-ink-soft">{MOTTO.translation}</p>
      </div>

      <p className="text-sm text-ink-soft">Annette &amp; Simi · Nairobi · August 2027</p>

      {hasError ? (
        <p className="rounded-lg border-[1.5px] border-danger px-4 py-3 text-sm text-danger">
          This app is just for the two of them.
        </p>
      ) : null}

      <form action={signInGoogleAction} className="w-full">
        <Button type="submit" className="w-full">
          Continue with Google
        </Button>
      </form>

      {devEmail ? <DevLoginButton email={devEmail} /> : null}

      <KangaBand className="max-w-[220px]" />
    </div>
  );
}
