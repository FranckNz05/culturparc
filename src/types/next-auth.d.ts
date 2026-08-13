import type { Role } from "@/generated/prisma/enums";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      /** Cinema de rattachement du personnel, null pour les clients et admins. */
      cinemaId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
    cinemaId: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
    cinemaId?: string | null;
  }
}
