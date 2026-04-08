type AuthRuntimeEnv = {
  AUTH_TRUST_HOST?: boolean;
  NEXTAUTH_URL?: string;
  NODE_ENV: "development" | "production" | "test";
};

export function resolveAuthTrustHost(env: AuthRuntimeEnv) {
  if (typeof env.AUTH_TRUST_HOST === "boolean") {
    return env.AUTH_TRUST_HOST;
  }

  return env.NODE_ENV !== "production" || Boolean(env.NEXTAUTH_URL);
}
