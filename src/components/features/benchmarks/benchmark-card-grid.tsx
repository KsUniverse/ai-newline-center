import type { BenchmarkAccountDTO } from "@/types/douyin-account";

import { BenchmarkCard } from "./benchmark-card";

interface BenchmarkCardGridProps {
  accounts: BenchmarkAccountDTO[];
  archived?: boolean;
  onArchive?: (account: BenchmarkAccountDTO) => void;
}

export function BenchmarkCardGrid({
  accounts,
  archived,
  onArchive,
}: BenchmarkCardGridProps) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2 2xl:grid-cols-3">
      {accounts.map((account) => (
        <BenchmarkCard
          key={account.id}
          account={account}
          archived={archived}
          onArchive={onArchive}
        />
      ))}
    </div>
  );
}
