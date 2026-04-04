"use client";

import { Loader2, RefreshCw, ShieldAlert, Smartphone } from "lucide-react";

import type {
  DouyinLoginSessionDTO,
  DouyinLoginSessionPurpose,
} from "@/types/douyin-account";
import { Button } from "@/components/ui/button";
import { cn, formatDateTime } from "@/lib/utils";

import {
  getAccountLoginViewCopy,
  type AccountLoginViewState,
} from "./account-login-status-copy";

function getStepState(viewState: AccountLoginViewState, stepIndex: number): "done" | "active" | "upcoming" {
  if (viewState === "SUCCESS") {
    return stepIndex <= 2 ? "done" : "upcoming";
  }

  if (viewState === "QRCODE_READY" || viewState === "SCANNED" || viewState === "EXPIRED") {
    if (stepIndex === 0) {
      return "done";
    }

    if (stepIndex === 1) {
      return "active";
    }

    return "upcoming";
  }

  if (viewState === "FAILED") {
    return stepIndex === 0 ? "done" : stepIndex === 1 ? "active" : "upcoming";
  }

  return stepIndex === 0 ? "active" : "upcoming";
}

interface AccountLoginQrcodePanelProps {
  purpose: DouyinLoginSessionPurpose;
  viewState: AccountLoginViewState;
  session: DouyinLoginSessionDTO | null;
  isStarting: boolean;
  isRefreshing: boolean;
  isCancelling: boolean;
  pollError: string | null;
  onRetry: () => void;
  onRefresh: () => void;
  onCancel: () => void;
}

export function AccountLoginQrcodePanel({
  purpose,
  viewState,
  session,
  isStarting,
  isRefreshing,
  isCancelling,
  pollError,
  onRetry,
  onRefresh,
  onCancel,
}: AccountLoginQrcodePanelProps) {
  const copy = getAccountLoginViewCopy(viewState, purpose, session);
  const isBusy = isStarting || viewState === "CREATING_SESSION" || viewState === "SUCCESS";
  const canShowQr = Boolean(session?.qrcodeDataUrl) && viewState !== "SUCCESS";
  const qrcodeDataUrl = session?.qrcodeDataUrl ?? "";
  const canRefresh = Boolean(session?.id) && !isStarting && !isRefreshing && !isCancelling;
  const showRetry = viewState === "FAILED" || viewState === "IDLE";
  const showRefresh = viewState === "QRCODE_READY" || viewState === "SCANNED" || viewState === "EXPIRED";
  const steps = [
    "生成二维码",
    "手机确认",
    purpose === "CREATE_ACCOUNT" ? "自动建号" : "更新登录态",
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border/60 bg-card p-5">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background text-muted-foreground",
              viewState === "FAILED" && "text-destructive",
              viewState === "EXPIRED" && "text-[hsl(var(--warning))]",
              viewState === "SUCCESS" && "text-primary",
            )}
          >
            {viewState === "FAILED" || viewState === "EXPIRED" ? (
              <ShieldAlert className="h-4 w-4" />
            ) : viewState === "SUCCESS" || viewState === "CREATING_SESSION" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Smartphone className="h-4 w-4" />
            )}
          </span>
          <div className="space-y-1">
            <p className="text-base font-medium text-foreground/90">{copy.title}</p>
            <p className="text-sm leading-6 text-muted-foreground">{copy.description}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {steps.map((step, index) => {
            const stepState = getStepState(viewState, index);

            return (
              <div
                key={step}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm transition-colors",
                  stepState === "done" &&
                    "border-[hsl(var(--success)/0.24)] bg-[hsl(var(--success)/0.12)] text-foreground/90",
                  stepState === "active" &&
                    "border-[hsl(var(--primary)/0.32)] bg-[hsl(var(--primary)/0.12)] text-foreground/90",
                  stepState === "upcoming" &&
                    "border-border/60 bg-background/70 text-muted-foreground",
                )}
              >
                <p className="text-2xs uppercase tracking-[0.12em] text-muted-foreground/70">
                  Step {index + 1}
                </p>
                <p className="mt-1 font-medium">{step}</p>
              </div>
            );
          })}
        </div>

        {session?.expiresAt && (viewState === "QRCODE_READY" || viewState === "SCANNED") && (
          <p className="mt-4 rounded-lg border border-border/60 bg-background/80 px-3 py-2 text-sm text-muted-foreground">
            二维码有效期至 {formatDateTime(session.expiresAt)}
          </p>
        )}

        {pollError && (
          <p className="mt-4 rounded-lg border border-[hsl(var(--warning)/0.28)] bg-[hsl(var(--warning)/0.12)] px-3 py-2 text-sm text-[hsl(var(--warning))]">
            {pollError}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-5">
        <div className="flex min-h-80 items-center justify-center rounded-xl border border-dashed border-border/70 bg-background/80 p-6">
          {canShowQr ? (
            <div className="space-y-4 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrcodeDataUrl}
                alt="抖音登录二维码"
                className="mx-auto h-56 w-56 rounded-xl border border-border/60 bg-card object-contain p-3"
              />
              <p className="text-sm text-muted-foreground">请使用手机抖音 App 扫码</p>
              <p className="text-2xs uppercase tracking-[0.12em] text-muted-foreground/70">
                仅绑定当前账号，不与其他账号共用登录态
              </p>
            </div>
          ) : isBusy ? (
            <div className="space-y-3 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">系统正在同步登录状态，请稍候。</p>
            </div>
          ) : (
            <div className="space-y-3 text-center">
              <ShieldAlert className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                当前没有可展示的二维码，请重新生成后继续登录。
              </p>
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {showRetry && (
            <Button onClick={onRetry} disabled={isStarting || isCancelling} size="sm" className="h-8 px-3 text-sm">
              {isStarting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              重新发起
            </Button>
          )}
          {showRefresh && (
            <Button
              variant="outline"
              onClick={onRefresh}
              disabled={!canRefresh}
              size="sm"
              className="h-8 px-3 text-sm"
            >
              {isRefreshing ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              )}
              刷新二维码
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={onCancel}
            disabled={isCancelling}
            size="sm"
            className="h-8 px-3 text-sm text-muted-foreground hover:text-foreground"
          >
            {isCancelling && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            取消
          </Button>
        </div>
      </div>
    </div>
  );
}