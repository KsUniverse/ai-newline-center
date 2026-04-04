"use client";

import { useState } from "react";
import { toast } from "sonner";

import type { TranscriptionDTO } from "@/types/transcription";
import { ApiError, apiClient } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface VideoTranscriptionEditorProps {
  transcriptionId: string;
  initialText: string;
  hasEditedText: boolean;
  onSaved: (updated: TranscriptionDTO) => void;
  onCancel: () => void;
}

export function VideoTranscriptionEditor({
  transcriptionId,
  initialText,
  hasEditedText,
  onSaved,
  onCancel,
}: VideoTranscriptionEditorProps) {
  const [text, setText] = useState(initialText);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await apiClient.patch<TranscriptionDTO>(
        `/transcriptions/${transcriptionId}`,
        { editedText: text },
      );
      onSaved(updated);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      {hasEditedText && (
        <Badge variant="secondary" className="text-xs">
          已手工校对
        </Badge>
      )}
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          disabled={saving}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none disabled:opacity-50"
          placeholder="输入转录文案..."
        />
        <span className="absolute bottom-2 right-3 text-xs text-muted-foreground">
          {text.length} 字
        </span>
      </div>
      <div className="flex gap-2">
        <Button size="sm" disabled={saving} onClick={() => void handleSave()}>
          {saving ? "保存中…" : "保存"}
        </Button>
        <Button variant="outline" size="sm" disabled={saving} onClick={onCancel}>
          取消
        </Button>
      </div>
    </div>
  );
}
