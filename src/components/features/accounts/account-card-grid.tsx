import type { DouyinAccountDTO } from "@/types/douyin-account";
import { AccountCard } from "./account-card";

interface AccountCardGridProps {
  accounts: DouyinAccountDTO[];
  onCardClick: (account: DouyinAccountDTO) => void;
}

export function AccountCardGrid({ accounts, onCardClick }: AccountCardGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {accounts.map((account) => (
        <AccountCard
          key={account.id}
          account={account}
          onClick={() => onCardClick(account)}
        />
      ))}
    </div>
  );
}
