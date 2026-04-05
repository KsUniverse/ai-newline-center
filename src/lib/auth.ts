import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { UserRole } from "@prisma/client";
import { z } from "zod";

import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { ensureServerBootstrap } from "@/lib/server-bootstrap";
import { userRepository } from "@/server/repositories/user.repository";
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

const nextAuth = NextAuth({
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
        const dbUser = await userRepository.findById(parsedToken.data.id);

        if (!dbUser || dbUser.status === "DISABLED") {
          return {
            ...session,
            user: undefined,
          };
        }

        session.user.id = parsedToken.data.id;
        session.user.name = dbUser.name;
        session.user.account = parsedToken.data.account;
        session.user.role = dbUser.role;
        session.user.organizationId = dbUser.organizationId;
      }

      return session;
    },
  },
});

const baseAuth = nextAuth.auth;

export const { handlers, signIn, signOut } = nextAuth;

export const auth = (async (...args: Parameters<typeof baseAuth>) => {
  await ensureServerBootstrap();
  return baseAuth(...args);
}) as unknown as typeof baseAuth;
