"use client";

import { useState } from "react";
import { AlertCircle, Link2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import type { AccountPreview, BenchmarkAccountDTO } from "@/types/douyin-account";
import { toCreateDouyinAccountPayload } from "@/lib/account-payload";
import { apiClient, ApiError } from "@/lib/api-client";
import { cn, proxyImageUrl, formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import {
  BENCHMARK_ADD_ACTION_LABEL,
  getBenchmarkAddDrawerDescription,
  getBenchmarkAddFetchActionLabel,
  getBenchmarkAddInputHint,
  getBenchmarkAddMemberHint,
  getBenchmarkAddPreviewErrorMessage,
  getBenchmarkAddPreviewTitle,
  getBenchmarkAddRetryActionLabel,
  getBenchmarkAddSuccessMessage,
  getBenchmarkResetInputLabel,
} from "./benchmark-copy";

const DOUYIN_URL_REGEX = /^https?:\/\/(www\.)?douyin\.com\/user\/.+$/;

type DrawerStep = "INPUT" | "FETCHING" | "PREVIEW" | "ERROR" | "SUBMITTING";

interface BenchmarkAddDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function BenchmarkAddDrawer({ open, onOpenChange, onSuccess }: BenchmarkAddDrawerProps) {
  const [profileUrl, setProfileUrl] = useState("");
  const [urlError, setUrlError] = useState("");
  const [step, setStep] = useState<DrawerStep>("INPUT");
  const [preview, setPreview] = useState<AccountPreview | null>(null);
  const [fetchError, setFetchError] = useState("");

  function reset() {
    setProfileUrl("");
    setUrlError("");
    setStep("INPUT");
    setPreview(null);
    setFetchError("");
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      reset();
    }
    onOpenChange(nextOpen);
  }

  function validateUrl(url: string): boolean {
    if (!url.trim()) {
      setUrlError("请输入抖音主页链接");
      return false;
    }
    if (!DOUYIN_URL_REGEX.test(url.trim())) {
      setUrlError("请输入合法的抖音主页链接，如 https://www.douyin.com/user/xxxxx");
      return false;
    }
    setUrlError("");
    return true;
  }

  async function handleFetchPreview() {
    const trimmedUrl = profileUrl.trim();
    if (!validateUrl(trimmedUrl)) return;

    setStep("FETCHING");
    setFetchError("");

    try {
      const result = await apiClient.post<AccountPreview>("/benchmarks/preview", {
        profileUrl: trimmedUrl,
      });
      setPreview(result);
      setStep("PREVIEW");
    } catch (error) {
      setFetchError(getBenchmarkAddPreviewErrorMessage(error));
      setStep("ERROR");
    }
  }

  async function handleSubmit() {
    if (!preview) return;

    setStep("SUBMITTING");

    try {
      await apiClient.post<BenchmarkAccountDTO>(
        "/benchmarks",
        toCreateDouyinAccountPayload(preview),
      );
      toast.success(getBenchmarkAddSuccessMessage());
      handleOpenChange(false);
      onSuccess();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "加入研究库失败，请稍后重试。";
      toast.error(message);
      setStep("PREVIEW");
    }
  }

  const isFetching = step === "FETCHING";
  const isSubmitting = step === "SUBMITTING";

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full border-l border-border/60 bg-card/95 p-0 sm:max-w-lg">
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b border-border/60 px-6 py-6 text-left">
            <p className="text-2xs font-medium uppercase tracking-[0.24em] text-primary/80">
              Research Intake
            </p>
            <SheetTitle className="text-xl font-semibold tracking-tight text-foreground/95">
              {BENCHMARK_ADD_ACTION_LABEL}
            </SheetTitle>
            <SheetDescription className="text-sm leading-6 text-muted-foreground/80">
              {getBenchmarkAddDrawerDescription()}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
            <div
              className={cn(
                "rounded-3xl border p-4 shadow-sm transition-colors",
                urlError
                  ? "border-destructive/30 bg-destructive/5"
                  : "border-border/60 bg-background/80",
              )}
            >
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-2xs font-medium uppercase tracking-[0.18em] text-primary/80">
                    Profile URL
                  </p>
                  <Label htmlFor="benchmark-profile-url" className="text-sm font-medium text-foreground/90">
                    抖音主页链接
                  </Label>
                </div>

                <div
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border px-3 py-3 transition-all",
                    urlError
                      ? "border-destructive/30 bg-background/90"
                      : "border-border/60 bg-card/90 focus-within:border-primary/30 focus-within:bg-card focus-within:ring-4 focus-within:ring-primary/8",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-sm",
                      urlError
                        ? "border-destructive/25 bg-destructive/5 text-destructive"
                        : "border-border/60 bg-background/90 text-primary",
                    )}
                  >
                    <Link2 className="h-4 w-4" />
                  </span>
                  <Input
                    id="benchmark-profile-url"
                    placeholder="https://www.douyin.com/user/xxxxx"
                    value={profileUrl}
                    onChange={(event) => {
                      setProfileUrl(event.target.value);
                      if (urlError) setUrlError("");
                    }}
                    disabled={isFetching || step === "PREVIEW" || isSubmitting}
                    className="h-auto border-0 bg-transparent px-0 py-0 text-[15px] shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/50"
                  />
                </div>

                <p className={urlError ? "text-sm leading-6 text-destructive" : "text-sm leading-6 text-muted-foreground/75"}>
                  {urlError || getBenchmarkAddInputHint()}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/80 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-foreground/90">成员关联优先于重复建档</p>
                  <p className="text-sm leading-6 text-muted-foreground/80">
                    {getBenchmarkAddMemberHint()}
                  </p>
                </div>
              </div>
            </div>

            {isFetching ? (
              <div className="flex min-h-52 flex-col items-center justify-center rounded-3xl border border-border/60 bg-card/80 px-6 py-8 text-center shadow-sm">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <p className="mt-4 text-base font-medium text-foreground/90">正在读取账号档案</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground/80">
                  正在解析主页链接并获取账号基础资料，请稍候。
                </p>
              </div>
            ) : null}

            {step === "ERROR" ? (
              <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-destructive">无法生成账号预览</p>
                    <p className="text-sm leading-6 text-destructive/90">{fetchError}</p>
                  </div>
                </div>
              </div>
            ) : null}

            {(step === "PREVIEW" || isSubmitting) && preview ? (
              <div className="space-y-4 rounded-3xl border border-border/60 bg-card/80 p-5 shadow-sm">
                <div className="space-y-1">
                  <p className="text-2xs font-medium uppercase tracking-[0.18em] text-primary/80">
                    Preview
                  </p>
                  <h3 className="text-lg font-semibold tracking-tight text-foreground/95">
                    {getBenchmarkAddPreviewTitle()}
                  </h3>
                </div>

                <div className="flex items-center gap-4 rounded-2xl border border-border/60 bg-background/80 p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={proxyImageUrl(preview.avatar)}
                    alt={preview.nickname}
                    className="h-14 w-14 rounded-full border border-border/60 bg-muted object-cover"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate text-base font-semibold tracking-tight text-foreground/95">
                      {preview.nickname}
                    </p>
                    {preview.signature || preview.bio ? (
                      <p className="line-clamp-2 text-sm leading-6 text-muted-foreground/80">
                        {preview.signature ?? preview.bio}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-border/60 bg-background/80 p-3">
                    <p className="text-2xs uppercase tracking-[0.18em] text-muted-foreground/70">粉丝</p>
                    <p className="mt-1 text-base font-semibold tracking-tight text-foreground/95">
                      {formatNumber(preview.followersCount)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-background/80 p-3">
                    <p className="text-2xs uppercase tracking-[0.18em] text-muted-foreground/70">作品</p>
                    <p className="mt-1 text-base font-semibold tracking-tight text-foreground/95">
                      {formatNumber(preview.videosCount)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-background/80 p-3">
                    <p className="text-2xs uppercase tracking-[0.18em] text-muted-foreground/70">获赞</p>
                    <p className="mt-1 text-base font-semibold tracking-tight text-foreground/95">
                      {formatNumber(preview.likesCount)}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="border-t border-border/60 px-6 py-5">
            <div className="flex flex-wrap gap-2">
              {step === "INPUT" ? (
                <Button
                  onClick={() => void handleFetchPreview()}
                  disabled={isFetching}
                  size="sm"
                  className="h-8 rounded-md px-3 text-sm shadow-sm"
                >
                  {getBenchmarkAddFetchActionLabel()}
                </Button>
              ) : null}

              {step === "ERROR" ? (
                <Button
                  onClick={() => void handleFetchPreview()}
                  size="sm"
                  className="h-8 rounded-md px-3 text-sm shadow-sm"
                >
                  {getBenchmarkAddRetryActionLabel()}
                </Button>
              ) : null}

              {(step === "PREVIEW" || isSubmitting) && (
                <>
                  <Button
                    onClick={() => void handleSubmit()}
                    disabled={isSubmitting}
                    size="sm"
                    className="h-8 rounded-md px-3 text-sm shadow-sm"
                  >
                    {isSubmitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                    {BENCHMARK_ADD_ACTION_LABEL}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-md px-3 text-sm"
                    onClick={reset}
                    disabled={isSubmitting}
                  >
                    {getBenchmarkResetInputLabel()}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
