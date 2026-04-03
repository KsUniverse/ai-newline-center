import type { BenchmarkAccountDTO } from "@/types/douyin-account";
import { BenchmarkCard } from "./benchmark-card";

interface BenchmarkCardGridProps {
  accounts: BenchmarkAccountDTO[];
  archived?: boolean;
  currentUserId?: string;
  onArchive?: (id: string) => void;
}

export function BenchmarkCardGrid({
  accounts,
  archived,
  currentUserId,
  onArchive,
}: BenchmarkCardGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {accounts.map((account) => (
        <BenchmarkCard
          key={account.id}
          account={account}
          archived={archived}
          currentUserId={currentUserId}
          onArchive={onArchive}
        />
      ))}
    </div>
  );
}
