import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { UserRole } from "@prisma/client";
import { z } from "zod";

import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { userService } from "@/server/services/user.service";

const credentialsSchema = z.object({
  account: z.string().min(1),
  password: z.string().min(1),
});

const sessionTokenSchema = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  account: z.string(),
  role: z.nativeEnum(UserRole),
  organizationId: z.string(),
});

export const { auth, handlers, signIn, signOut } = NextAuth({
  secret: env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        account: {
          label: "账号",
          type: "text",
        },
        password: {
          label: "密码",
          type: "password",
        },
      },
      async authorize(credentials) {
        const result = credentialsSchema.safeParse(credentials);

        if (!result.success) {
          return null;
        }

        try {
          return await userService.verifyCredentials(result.data.account, result.data.password);
        } catch (error) {
          if (error instanceof AppError && error.code === "INVALID_CREDENTIALS") {
            return null;
          }

          throw error;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.account = user.account;
        token.role = user.role;
        token.organizationId = user.organizationId;
      }

      return token;
    },
    async session({ session, token }) {
      const parsedToken = sessionTokenSchema.safeParse(token);

      if (session.user && parsedToken.success) {
        session.user.id = parsedToken.data.id;
        session.user.name = parsedToken.data.name ?? session.user.name;
        session.user.account = parsedToken.data.account;
        session.user.role = parsedToken.data.role;
        session.user.organizationId = parsedToken.data.organizationId;
      }

      return session;
    },
  },
});
