"use client";

import type { DouyinVideoDTO } from "@/types/douyin-account";

import { AiWorkspacePanel } from "./ai-workspace-panel";

interface BenchmarkVideoDetailPanelProps {
  video: DouyinVideoDTO | null;
  onClose: () => void;
}

export function BenchmarkVideoDetailPanel({
  video,
  onClose,
}: BenchmarkVideoDetailPanelProps) {
  return <AiWorkspacePanel video={video} onClose={onClose} />;
}

