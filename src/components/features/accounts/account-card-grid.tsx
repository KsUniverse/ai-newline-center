import type { DouyinAccountDTO } from "@/types/douyin-account";
import { AccountCard } from "./account-card";

interface AccountCardGridProps {
  accounts: DouyinAccountDTO[];
  onCardClick: (account: DouyinAccountDTO) => void;
}

export function AccountCardGrid({ accounts, onCardClick }: AccountCardGridProps) {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2 2xl:grid-cols-3">
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
