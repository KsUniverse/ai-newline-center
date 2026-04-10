"use client";

import { useState } from "react";
import { toast } from "sonner";

import type { CreateFragmentsResult } from "@/types/fragment";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface ViewpointsAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function ViewpointsAddDialog({ open, onOpenChange, onCreated }: ViewpointsAddDialogProps) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setText("");
    }
    onOpenChange(next);
  }

  async function handleSubmit() {
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      toast.error("请至少输入一条观点内容");
      return;
    }

    if (lines.length > 50) {
      toast.error(`一次最多录入 50 条，当前有 ${lines.length} 条，请拆分后分批提交`);
      return;
    }

    const tooLong = lines.find((line) => line.length > 500);
    if (tooLong) {
      toast.error("每条观点不超过 500 字，请检查内容");
      return;
    }

    setSubmitting(true);
    try {
      const result = await apiClient.post<CreateFragmentsResult>("/viewpoints", {
        contents: lines,
      });
      toast.success(`已添加 ${result.created} 条观点`);
      onCreated();
      handleOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "录入失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg rounded-[24px] border-border/60 bg-card/95">
        <DialogHeader>
          <p className="text-2xs font-medium uppercase tracking-[0.18em] text-primary/80">
            Viewpoints
          </p>
          <DialogTitle>添加观点</DialogTitle>
          <DialogDescription>
            每行输入一条观点，支持批量录入，每次最多 50 条，每条不超过 500 字。
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder="输入观点内容，一行一条，支持批量录入"
          className="resize-none rounded-2xl border-border/60 bg-background/80 text-sm leading-7 focus:border-primary/30 focus:ring-2 focus:ring-primary/10"
          disabled={submitting}
        />

        <DialogFooter>
          <Button
            variant="outline"
            type="button"
            disabled={submitting}
            onClick={() => handleOpenChange(false)}
          >
            取消
          </Button>
          <Button type="button" disabled={submitting || text.trim().length === 0} onClick={handleSubmit}>
            {submitting ? "提交中..." : "提交"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
