import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma/enums";

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/connexion" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });

        // Un compte sans mot de passe vient d'un fournisseur externe : il ne
        // doit pas pouvoir se connecter par ce formulaire.
        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          cinemaId: user.cinemaId,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.cinemaId = user.cinemaId;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = token.role as Role;
        session.user.cinemaId = (token.cinemaId as string | null) ?? null;
      }
      return session;
    },
  },
});

/** Hierarchie des roles : chaque niveau couvre les precedents. */
const ROLE_RANK: Record<Role, number> = {
  CUSTOMER: 0,
  STAFF: 1,
  MANAGER: 2,
  ADMIN: 3,
};

export function hasRole(role: Role | undefined, minimum: Role): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

/**
 * Exige un role minimum. Renvoie la session ou null : l'appelant decide
 * s'il redirige vers la connexion ou s'il renvoie une 403.
 */
export async function requireRole(minimum: Role) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role, minimum)) return null;
  return session;
}
