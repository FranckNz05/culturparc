import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { auth, signIn } from "@/auth";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: PageProps<"/connexion">) {
  const session = await auth();
  const { error, callbackUrl } = await searchParams;

  if (session?.user) {
    redirect(typeof callbackUrl === "string" ? callbackUrl : "/mon-compte");
  }

  async function login(formData: FormData) {
    "use server";

    const target =
      typeof formData.get("callbackUrl") === "string" &&
      formData.get("callbackUrl")
        ? String(formData.get("callbackUrl"))
        : "/mon-compte";

    await signIn("credentials", {
      email: String(formData.get("email") ?? "").toLowerCase(),
      password: String(formData.get("password") ?? ""),
      redirectTo: target,
    });
  }

  const inputClass =
    "w-full rounded-lg border border-ink-600 bg-ink-850 px-3 py-2.5 text-sm text-ink-50 " +
    "placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-sm flex-1 px-4 py-16">
        <h1 className="font-display text-3xl text-ink-50">Connexion</h1>
        <p className="mt-2 text-sm text-ink-300">
          Espace client, gestion et controle d&apos;acces.
        </p>

        {error && (
          <p
            role="alert"
            className="mt-6 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
          >
            Identifiants incorrects.
          </p>
        )}

        <form action={login} className="mt-8 space-y-4">
          <input
            type="hidden"
            name="callbackUrl"
            value={typeof callbackUrl === "string" ? callbackUrl : ""}
          />

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink-100">Email</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className={inputClass}
              placeholder="vous@cultureparc.cg"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink-100">Mot de passe</span>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className={inputClass}
            />
          </label>

          <Button type="submit" size="lg" className="w-full">
            Se connecter
          </Button>
        </form>
      </main>

      <SiteFooter />
    </>
  );
}
