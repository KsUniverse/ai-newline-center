"use client";

import { useState, useEffect } from "react";
import { Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";

import type { TranscriptionDTO } from "@/types/transcription";
import { ApiError, apiClient } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VideoTranscriptionEditor } from "./video-transcription-editor";

interface VideoTranscriptionPanelProps {
  videoId: string;
  videoStoragePath: string | null;
}

export function VideoTranscriptionPanel({
  videoId,
  videoStoragePath,
}: VideoTranscriptionPanelProps) {
  const [transcription, setTranscription] = useState<TranscriptionDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setEditing(false);

    async function fetchTranscription() {
      try {
        const result = await apiClient.get<TranscriptionDTO>(
          `/transcriptions?videoId=${videoId}`,
        );
        if (!cancelled) {
          setTranscription(result);
        }
      } catch (error) {
        if (!cancelled) {
          if (error instanceof ApiError && error.code === "NOT_FOUND") {
            setTranscription(null);
          } else {
            toast.error(error instanceof ApiError ? error.message : "加载转录信息失败");
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchTranscription();
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  // SSE subscription
  useEffect(() => {
    if (!transcription?.id) return;
    if (transcription.status !== "PENDING" && transcription.status !== "PROCESSING") return;

    const source = new EventSource(`/api/transcriptions/${transcription.id}/sse`);

    source.addEventListener("status", (e: MessageEvent) => {
      const data = JSON.parse(e.data as string) as {
        transcriptionId: string;
        status: "PROCESSING";
      };
      setTranscription((prev) => (prev ? { ...prev, status: data.status } : prev));
    });

    source.addEventListener("done", (e: MessageEvent) => {
      const data = JSON.parse(e.data as string) as {
        transcriptionId: string;
        status: "COMPLETED";
        originalText: string;
      };
      setTranscription((prev) =>
        prev ? { ...prev, status: "COMPLETED", originalText: data.originalText } : prev,
      );
      source.close();
    });

    // Listens for custom SSE "error" named event (not a connection error)
    source.addEventListener("error", (e: Event) => {
      if (e instanceof MessageEvent) {
        try {
          const data = JSON.parse(e.data as string) as {
            transcriptionId: string;
            status: "FAILED";
            errorMessage: string | null;
          };
          setTranscription((prev) =>
            prev
              ? { ...prev, status: "FAILED", errorMessage: data.errorMessage }
              : prev,
          );
        } catch {
          // ignore parse errors
        }
        source.close();
      }
    });

    // Handle connection-level errors (non-MessageEvent, e.g. 401/403/network)
    source.onerror = (e: Event) => {
      if (!(e instanceof MessageEvent)) {
        source.close();
        toast.error("转录状态订阅连接中断，请刷新页面重试");
      }
    };

    return () => {
      source.close();
    };
  }, [transcription?.id, transcription?.status]);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const result = await apiClient.post<TranscriptionDTO>("/transcriptions", { videoId });
      setTranscription(result);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "提交失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRestore() {
    if (!transcription) return;
    setRestoring(true);
    try {
      const updated = await apiClient.patch<TranscriptionDTO>(
        `/transcriptions/${transcription.id}`,
        { editedText: null },
      );
      setTranscription(updated);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "恢复失败，请稍后重试");
    } finally {
      setRestoring(false);
    }
  }

  if (loading) {
    return <div className="animate-pulse h-32 rounded-lg bg-muted" />;
  }

  if (videoStoragePath === null) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          视频文件尚未下载，请等待同步完成后再试
        </p>
      </div>
    );
  }

  if (transcription === null) {
    return (
      <Button variant="default" disabled={submitting} onClick={() => void handleSubmit()}>
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            提交中…
          </>
        ) : (
          <>
            <Wand2 className="mr-2 h-4 w-4" />
            AI 转录
          </>
        )}
      </Button>
    );
  }

  if (transcription.status === "PENDING" || transcription.status === "PROCESSING") {
    return (
      <div className="flex items-center gap-3">
        <Button variant="default" size="sm" disabled>
          <Loader2 className="h-4 w-4 animate-spin" />
        </Button>
        <span className="text-sm text-muted-foreground">
          {transcription.status === "PENDING" ? "转录中…" : "AI 处理中，请稍候…"}
        </span>
      </div>
    );
  }

  if (transcription.status === "FAILED") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">
          AI 转录失败：{transcription.errorMessage ?? "未知错误，请重试"}
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={submitting}
          onClick={() => void handleSubmit()}
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              重试中…
            </>
          ) : (
            "重试"
          )}
        </Button>
      </div>
    );
  }

  // COMPLETED
  const hasEditedText = transcription.editedText !== null;
  const displayText = transcription.editedText ?? transcription.originalText;

  return (
    <div className="space-y-3">
      {!editing && (
        <>
          {hasEditedText && (
            <Badge variant="secondary" className="text-xs">
              已手工校对
            </Badge>
          )}
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {displayText === "" || displayText === null ? (
              <span className="text-muted-foreground">
                未识别到有效语音内容，可手动输入文案
              </span>
            ) : (
              displayText
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              编辑
            </Button>
            {hasEditedText && (
              <Button
                variant="link"
                size="sm"
                disabled={restoring}
                className="text-muted-foreground"
                onClick={() => void handleRestore()}
              >
                {restoring ? "恢复中…" : "恢复 AI 原文"}
              </Button>
            )}
          </div>
          <Button
            variant="link"
            size="sm"
            disabled={submitting}
            className="p-0 h-auto text-muted-foreground"
            onClick={() => void handleSubmit()}
          >
            {submitting ? "重新提交中…" : "重新转录"}
          </Button>
        </>
      )}
      {editing && (
        <VideoTranscriptionEditor
          transcriptionId={transcription.id}
          initialText={transcription.editedText ?? transcription.originalText ?? ""}
          hasEditedText={hasEditedText}
          onSaved={(updated) => {
            setTranscription(updated);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      )}
    </div>
  );
}
