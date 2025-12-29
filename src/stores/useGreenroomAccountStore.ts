import { create } from "zustand";
import { persist } from "zustand/middleware";

interface GreenroomAccount {
  greenroomUserId: number | null;
  displayName?: string;
}

interface GreenroomAccountState {
  accounts: Record<string, GreenroomAccount>;
  setAccount: (username: string, account: GreenroomAccount) => void;
  getAccount: (username: string | null) => GreenroomAccount | null;
  clearAccount: (username: string) => void;
}

const DEFAULT_ACCOUNT: GreenroomAccount = {
  greenroomUserId: null,
  displayName: undefined,
};

export const useGreenroomAccountStore = create<GreenroomAccountState>()(
  persist(
    (set, get) => ({
      accounts: {},
      setAccount: (username: string, account: GreenroomAccount) => {
        set((state) => ({
          accounts: {
            ...state.accounts,
            [username.toLowerCase()]: account,
          },
        }));
      },
      getAccount: (username: string | null) => {
        if (!username) return null;
        const accounts = get().accounts;
        return accounts[username.toLowerCase()] || null;
      },
      clearAccount: (username: string) => {
        set((state) => {
          const newAccounts = { ...state.accounts };
          delete newAccounts[username.toLowerCase()];
          return { accounts: newAccounts };
        });
      },
    }),
    {
      name: "greenroom-accounts",
    }
  )
);

export function useCurrentGreenroomAccount() {
  const { accounts, setAccount, getAccount } = useGreenroomAccountStore();
  return {
    accounts,
    setAccount,
    getAccount,
  };
}

