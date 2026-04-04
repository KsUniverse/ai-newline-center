"use client";

import type { ReactNode } from "react";

import type {
  DouyinLoginSessionDTO,
  DouyinLoginSessionPurpose,
} from "@/types/douyin-account";

import type { AccountLoginViewState } from "./account-login-status-copy";
import { AccountLoginQrcodePanel } from "./account-login-qrcode-panel";

interface AccountLoginSessionNote {
  title: string;
  description: ReactNode;
}

interface AccountLoginSessionContentProps {
  purpose: DouyinLoginSessionPurpose;
  viewState: AccountLoginViewState;
  session: DouyinLoginSessionDTO | null;
  isStarting: boolean;
  isRefreshing: boolean;
  isCancelling: boolean;
  pollError: string | null;
  infoTitle: string;
  infoDescription: ReactNode;
  notes: AccountLoginSessionNote[];
  onRetry: () => void;
  onRefresh: () => void;
  onCancel: () => void;
}

export function AccountLoginSessionContent({
  purpose,
  viewState,
  session,
  isStarting,
  isRefreshing,
  isCancelling,
  pollError,
  infoTitle,
  infoDescription,
  notes,
  onRetry,
  onRefresh,
  onCancel,
}: AccountLoginSessionContentProps) {
  return (
    <div className="mt-6 space-y-5">
      <AccountLoginQrcodePanel
        purpose={purpose}
        viewState={viewState}
        session={session}
        isStarting={isStarting}
        isRefreshing={isRefreshing}
        isCancelling={isCancelling}
        pollError={pollError}
        onRetry={onRetry}
        onRefresh={onRefresh}
        onCancel={onCancel}
      />

      <div className="rounded-xl border border-border/60 bg-card/70 p-4 sm:p-5">
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-foreground/90">{infoTitle}</p>
          <div className="text-sm leading-6 text-muted-foreground">{infoDescription}</div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {notes.map((note) => (
            <div
              key={note.title}
              className="rounded-lg border border-border/60 bg-background/80 p-3"
            >
              <p className="text-sm font-medium text-foreground/90">{note.title}</p>
              <div className="mt-1 text-sm leading-6 text-muted-foreground">
                {note.description}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}