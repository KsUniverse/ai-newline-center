import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

import {
  getBenchmarkArchiveActionLabel,
  getBenchmarkArchiveDialogDescription,
  getBenchmarkArchiveDialogTitle,
} from "./benchmark-copy";

interface BenchmarkArchiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  nickname?: string;
}

export function BenchmarkArchiveDialog({
  open,
  onOpenChange,
  onConfirm,
  nickname,
}: BenchmarkArchiveDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <p className="text-2xs font-medium uppercase tracking-[0.18em] text-primary/80">
            Archive Action
          </p>
          <AlertDialogTitle>{getBenchmarkArchiveDialogTitle(nickname)}</AlertDialogTitle>
          <AlertDialogDescription>
            {getBenchmarkArchiveDialogDescription(nickname)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <Button variant="destructive" size="sm" onClick={onConfirm}>
            {getBenchmarkArchiveActionLabel()}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}