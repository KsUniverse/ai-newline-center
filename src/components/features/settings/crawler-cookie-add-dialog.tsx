"use client";

import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { managementClient } from "@/lib/management-client";
import type { CrawlerCookieDTO } from "@/types/crawler-cookie";

const addCookieSchema = z.object({
  value: z.string().min(1, "Cookie 值不能为空"),
});
type AddCookieFormValues = z.infer<typeof addCookieSchema>;

interface AddCrawlerCookieDialogProps {
  open: boolean;
  onClose: () => void; 
  onCreated: (item: CrawlerCookieDTO) => void;
}

export function AddCrawlerCookieDialog({ open, onClose, onCreated }: AddCrawlerCookieDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddCookieFormValues>({
    resolver: zodResolver(addCookieSchema),
    defaultValues: { value: "" },
  });

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open) {
      reset({ value: "" });
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [open, reset]);

  const { ref: registerRef, ...registerRest } = register("value");

  const onSubmit = async (data: AddCookieFormValues) => {
    try {
      const item = await managementClient.createCrawlerCookie({ value: data.value });
      toast.success("Cookie 已添加");
      onCreated(item);
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "添加失败，请重试";
      toast.error(`添加失败：${message}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <p className="text-2xs font-medium uppercase tracking-[0.18em] text-primary/80">
            System Settings
          </p>
          <DialogTitle>添加爬虫 Cookie</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cookie-value">Cookie 值</Label>
            <Textarea
              id="cookie-value"
              placeholder="请粘贴完整的 Cookie 字符串"
              rows={5}
              className="resize-none font-mono text-xs"
              {...registerRest}
              ref={(el) => {
                registerRef(el);
                textareaRef.current = el;
              }}
            />
            {errors.value && (
              <p className="text-xs text-destructive">{errors.value.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              取消
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              确认添加
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
