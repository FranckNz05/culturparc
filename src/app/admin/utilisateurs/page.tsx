import { requireRole } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { NewUserForm, ResetPasswordForm } from "./user-forms";
import { updateUserRole } from "./actions";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  CUSTOMER: "Client",
  STAFF: "Controle d'acces",
  MANAGER: "Responsable",
  ADMIN: "Administrateur",
};

const ROLE_TONES: Record<string, "outline" | "brand" | "success"> = {
  CUSTOMER: "outline",
  STAFF: "outline",
  MANAGER: "brand",
  ADMIN: "success",
};

const selectClass =
  "rounded-lg border border-ink-600 bg-ink-850 px-2 py-1.5 text-xs text-ink-100";

export default async function UsersAdminPage() {
  // Reserve aux administrateurs : creer un compte ou changer un role engage
  // l'acces au back-office, pas seulement la programmation d'un site.
  const session = await requireRole("ADMIN");
  if (!session) {
    return (
      <div className="rounded-xl border border-warning/40 bg-warning/10 p-6 text-sm text-warning">
        Cette page est reservee aux administrateurs.
      </div>
    );
  }

  const [users, cinemas] = await Promise.all([
    prisma.user.findMany({
      where: { role: { not: "CUSTOMER" } },
      include: { cinema: { select: { name: true, city: true } } },
      orderBy: [{ role: "desc" }, { name: "asc" }],
    }),
    prisma.cinema.findMany({
      where: { active: true },
      select: { id: true, name: true, city: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-ink-50">Comptes du personnel</h1>
        <p className="mt-1 text-sm text-ink-300">
          {users.length} compte{users.length > 1 ? "s" : ""} avec acces au
          back-office ou au controle d&apos;acces.
        </p>
      </div>

      <NewUserForm cinemas={cinemas} />

      <div className="overflow-x-auto rounded-xl border border-ink-700">
        <table className="w-full min-w-3xl text-sm">
          <thead className="bg-ink-850 text-left text-xs uppercase tracking-wider text-ink-400">
            <tr>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Site</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-800 bg-ink-900">
            {users.map((user) => {
              const isSelf = user.id === session.user.id;

              return (
                <tr key={user.id}>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-ink-50">
                    {user.name}
                    {isSelf && (
                      <Badge tone="outline" className="ml-2">
                        Vous
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-300">{user.email}</td>
                  <td className="px-4 py-3">
                    {isSelf ? (
                      <Badge tone={ROLE_TONES[user.role]}>
                        {ROLE_LABELS[user.role]}
                      </Badge>
                    ) : (
                      <form action={updateUserRole} className="flex flex-wrap gap-1">
                        <input type="hidden" name="userId" value={user.id} />
                        <select name="role" defaultValue={user.role} className={selectClass}>
                          {Object.entries(ROLE_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <select
                          name="cinemaId"
                          defaultValue={
                            cinemas.find((c) => c.name === user.cinema?.name)?.id ?? ""
                          }
                          className={selectClass}
                        >
                          <option value="">Sans site</option>
                          {cinemas.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          className="rounded-lg border border-ink-600 px-2 py-1.5 text-xs text-ink-200 hover:border-brand-500 hover:text-brand-400"
                        >
                          OK
                        </button>
                      </form>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-300">
                    {user.cinema ? `${user.cinema.name}` : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <ResetPasswordForm userId={user.id} userName={user.name} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <p className="rounded-xl border border-dashed border-ink-700 p-8 text-center text-sm text-ink-300">
          Aucun compte pour le moment.
        </p>
      )}
    </div>
  );
}
