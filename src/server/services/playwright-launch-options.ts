type ResolveChromiumLaunchOptionsInput = {
  requestedHeadless: boolean;
  openDevtools: boolean;
  platform: NodeJS.Platform;
  display?: string;
};

export function resolveChromiumLaunchOptions(
  input: ResolveChromiumLaunchOptionsInput,
) {
  const forceHeadless = input.platform === "linux" && !input.display;
  const headless = input.requestedHeadless || forceHeadless;
  const args: string[] = [];

  if (!headless && input.openDevtools) {
    args.push("--auto-open-devtools-for-tabs");
  }

  if (input.platform === "linux") {
    args.push("--no-sandbox", "--disable-setuid-sandbox");
  }

  return {
    headless,
    args,
  };
}
