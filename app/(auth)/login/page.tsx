import { signInGoogleAction } from "@/lib/actions/auth-actions";
import { Button } from "@/components/ui";
import { DevLoginButton } from "@/components/auth/DevLoginButton";

const appName = process.env.APP_NAME ?? "Harusi";

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const params = await searchParams;
  const hasError = Boolean(params?.error);
  const devEmail = process.env.NODE_ENV !== "production" ? process.env.DEV_LOGIN_EMAIL : undefined;

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
      <p className="wordmark text-[56px] leading-none text-ink">{appName}</p>
      <p className="jina-text">Mali bila daftari hupotea bila habari</p>
      <p className="text-sm text-ink-soft">Annette &amp; Simi · Nairobi · August 2027</p>

      {hasError ? (
        <p className="rounded-lg bg-sunken px-4 py-3 text-sm text-danger">
          This app is just for the two of them.
        </p>
      ) : null}

      <form action={signInGoogleAction} className="w-full">
        <Button type="submit" className="w-full">
          Continue with Google
        </Button>
      </form>

      {devEmail ? <DevLoginButton email={devEmail} /> : null}
    </div>
  );
}
