"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import type { AccountPreview, DouyinAccountDTO } from "@/types/douyin-account";
import { toCreateDouyinAccountPayload } from "@/components/features/accounts/account-payload";
import { apiClient, ApiError } from "@/lib/api-client";
import { proxyImageUrl, formatNumber } from "@/lib/utils";
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

const DOUYIN_URL_REGEX = /^https?:\/\/(www\.)?douyin\.com\/user\/.+$/;

type DrawerStep = "INPUT" | "FETCHING" | "PREVIEW" | "ERROR" | "SUBMITTING";

interface AccountAddDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AccountAddDrawer({ open, onOpenChange, onSuccess }: AccountAddDrawerProps) {
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
      const result = await apiClient.post<AccountPreview>("/douyin-accounts/preview", {
        profileUrl: trimmedUrl,
      });
      setPreview(result);
      setStep("PREVIEW");
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "获取账号信息失败，请检查链接是否正确";
      setFetchError(message);
      setStep("ERROR");
    }
  }

  async function handleSubmit() {
    if (!preview) return;

    setStep("SUBMITTING");

    try {
      await apiClient.post<DouyinAccountDTO>(
        "/douyin-accounts",
        toCreateDouyinAccountPayload(preview),
      );
      toast.success("账号添加成功");
      handleOpenChange(false);
      onSuccess();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "添加失败，请稍后重试";
      toast.error(message);
      setStep("PREVIEW");
    }
  }

  const isFetching = step === "FETCHING";
  const isSubmitting = step === "SUBMITTING";

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>添加账号</SheetTitle>
          <SheetDescription>输入抖音主页链接，系统将自动获取账号信息</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Step 1: Input */}
          <div className="space-y-2">
            <Label htmlFor="profile-url" className="text-sm">
              抖音主页链接
            </Label>
            <Input
              id="profile-url"
              placeholder="https://www.douyin.com/user/xxxxx"
              value={profileUrl}
              onChange={(e) => {
                setProfileUrl(e.target.value);
                if (urlError) setUrlError("");
              }}
              disabled={isFetching || step === "PREVIEW" || isSubmitting}
            />
            {urlError && (
              <p className="text-sm text-destructive">{urlError}</p>
            )}
          </div>

          {/* State: FETCHING */}
          {isFetching && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">正在获取账号信息…</span>
            </div>
          )}

          {/* State: ERROR */}
          {step === "ERROR" && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
              <p className="text-sm text-destructive">{fetchError}</p>
              <Button variant="outline" size="sm" onClick={handleFetchPreview}>
                重试
              </Button>
            </div>
          )}

          {/* State: PREVIEW / SUBMITTING */}
          {(step === "PREVIEW" || isSubmitting) && preview && (
            <div className="rounded-lg border border-border/60 bg-card p-4 space-y-3">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={proxyImageUrl(preview.avatar)}
                  alt={preview.nickname}
                  className="h-12 w-12 rounded-full bg-muted object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground/90">
                    {preview.nickname}
                  </p>
                  <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="tabular-nums tracking-tight">
                      {formatNumber(preview.followersCount)} 粉丝
                    </span>
                    <span className="tabular-nums tracking-tight">
                      {formatNumber(preview.videosCount)} 作品
                    </span>
                  </div>
                </div>
              </div>
              {preview.bio && (
                <p className="text-sm text-muted-foreground/70 line-clamp-2">{preview.bio}</p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {(step === "INPUT" || step === "ERROR") && (
              <Button
                onClick={handleFetchPreview}
                disabled={isFetching}
                size="sm"
                className="h-8 rounded-md text-sm px-3 shadow-sm"
              >
                获取账号信息
              </Button>
            )}
            {(step === "PREVIEW" || isSubmitting) && (
              <>
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  size="sm"
                  className="h-8 rounded-md text-sm px-3 shadow-sm"
                >
                  {isSubmitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  添加
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-md text-sm px-3"
                  onClick={reset}
                  disabled={isSubmitting}
                >
                  重新输入
                </Button>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
