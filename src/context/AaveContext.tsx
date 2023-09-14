import React, { createContext, useContext, useEffect, useState } from "react";
import { useEthersProvider } from "./Web3Context";
import {
  FormatReserveUSDResponse,
  FormatUserSummaryAndIncentivesResponse,
  FormatUserSummaryResponse,
  formatReserves,
  formatReservesAndIncentives,
} from "@aave/math-utils";
import {
  ReserveDataHumanized,
  UiPoolDataProvider,
  WalletBalanceProvider,
} from "@aave/contract-helpers";
import { ethers } from "ethers";

import { useUser } from "./UserContext";
import {
  MARKETTYPE,
  fetchTVL,
  getMarkets,
  getPools,
  getUserSummary,
  getUserSummaryAndIncentives,
} from "../servcies/aave.service";
import { useCurrentTimestamp } from "../hooks/useCurrentTimestamp";
import dayjs from "dayjs";
import { CHAIN_AVAILABLES } from "../constants/chains";
import {
  IPoolGroup,
  IReserve,
  IUserSummary,
} from "../interfaces/reserve.interface";
import { getAssetIconUrl } from "../utils/getAssetIconUrl";
import { getTotalSupplyBalanceBySymbol } from "../utils/getTotalSupplyBalanceBySymbol";
import { getTotalBorrowBalanceBySymbol } from "../utils/getTotalBorrowBalanceBySymbol";

export type ComputedReserveData = ReturnType<
  typeof formatReservesAndIncentives
>[0] &
  ReserveDataHumanized & {
    iconSymbol: string;
    isEmodeEnabled: boolean;
    isWrappedBaseAsset: boolean;
  };

export type ExtendedFormattedUser =
  FormatUserSummaryAndIncentivesResponse<ComputedReserveData> & {
    earnedAPY: number;
    debtAPY: number;
    netAPY: number;
    isInEmode: boolean;
    userEmodeCategoryId: number;
  };

const stub = (): never => {
  throw new Error("You forgot to wrap your component in <AaveProvider>.");
};

// Define the type for the AAVE context.
type AaveContextType = {
  markets: MARKETTYPE[] | null;
  poolReserves: IReserve[] | null;
  poolGroups: IPoolGroup[] | null;
  userSummary: FormatUserSummaryAndIncentivesResponse<
    ReserveDataHumanized & FormatReserveUSDResponse
  > | null;
  userSummaryAndIncentives: FormatUserSummaryAndIncentivesResponse<
    ReserveDataHumanized & FormatReserveUSDResponse
  > | null;
  userSummaryAndIncentivesGroup: IUserSummary[] | null;
  totalTVL: number | null;
  refresh: () => Promise<void>;
};

const AaveContextDefault: AaveContextType = {
  markets: null,
  poolReserves: null,
  poolGroups: [],
  userSummary: null,
  totalTVL: null,
  userSummaryAndIncentives: null,
  userSummaryAndIncentivesGroup: null,
  refresh: stub,
};

// Create a context for user data.
const AaveContext = createContext<AaveContextType>(AaveContextDefault);

// Custom hook for accessing user context data.
export const useAave = () => useContext(AaveContext);

// Provider component that wraps parts of the app that need user context.
export const AaveProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useUser();
  const currentTimestamp = dayjs().unix(); // useCurrentTimestamp(5);
  const [state, setState] = useState<AaveContextType>(AaveContextDefault);

  const init = async () => {
    console.log("[INFO] {{AaveProvider}} init context... ");
    // load markets from all available chains
    const markets = CHAIN_AVAILABLES.filter((chain) => !chain.testnet).map(
      (chain) => getMarkets(chain.id)
    );
    // looad pools from all available chains
    let poolReserves: IReserve[] = [];
    if (markets && markets.length > 0) {
      console.log("[INFO] {{AaveProvider}} fetchPools... ");
      const pools = await Promise.all(
        markets.map((market) => getPools({ market, currentTimestamp }))
      ).catch((error) => {
        console.error("[ERROR] {{AaveProvider}} fetchPools: ", error);
        return [];
      });
      console.log("[INFO] {{AaveProvider}} fetchPools done: ", { pools });
      poolReserves = pools.flat() as IReserve[];
    }
    // groups poolReserves by symbol (e.g. DAI, USDC, USDT, ...)
    const poolGroups: IPoolGroup[] = poolReserves
      .reduce((acc, reserve) => {
        const symbol = reserve.symbol;
        const chainId = +reserve.id.split("-")[0];
        const borrowApy = reserve.borrowingEnabled
          ? Number(reserve.variableBorrowAPY)
          : 0;
        const supplyApy = Number(reserve.supplyAPY);
        /// TODO: implement balance value
        const walletBalance = 0;
        const supplyBalance = 0;
        const borrowBalance = 0;
        const newReserve: IReserve = {
          ...reserve,
          logo: getAssetIconUrl({ symbol: reserve.symbol }),
          chainId,
          walletBalance,
          supplyBalance,
          borrowBalance,
        };
        const poolGroup = acc.find((r) => r.symbol === symbol);
        if (poolGroup) {
          // add reserve to existing reserves group
          poolGroup.reserves.push(newReserve);
          // check if chainId exist and add if not
          if (!poolGroup.chainIds.includes(chainId)) {
            poolGroup.chainIds.push(chainId);
          }
          // check if borrowApy is lower than topBorrowApy
          if (borrowApy < poolGroup.topBorrowApy) {
            poolGroup.topBorrowApy = borrowApy;
          }
          // check if supplyApy is higher than topSupplyApy
          if (supplyApy > poolGroup.topSupplyApy) {
            poolGroup.topSupplyApy = supplyApy;
          }
          // update totalBorrowBalance
          poolGroup.totalBorrowBalance += Number(newReserve.borrowBalance);
          // update totalSupplyBalance
          poolGroup.totalSupplyBalance += Number(newReserve.supplyBalance);
          // update totalWalletBalance
          poolGroup.totalWalletBalance += Number(newReserve.walletBalance);
          // update borrowingEnabled if is disable and newReserve is enabled
          if (newReserve.borrowingEnabled && !poolGroup.borrowingEnabled) {
            poolGroup.borrowingEnabled = newReserve.borrowingEnabled;
          }
        } else {
          const newGroup: IPoolGroup = {
            reserves: [newReserve],
            symbol,
            name: reserve.name,
            chainIds: [chainId],
            logo: getAssetIconUrl({ symbol }),
            topBorrowApy: borrowApy,
            topSupplyApy: supplyApy,
            borrowingEnabled: reserve.borrowingEnabled,
            totalBorrowBalance: borrowBalance,
            totalSupplyBalance: supplyBalance,
            totalWalletBalance: walletBalance,
          };
          acc.push(newGroup);
        }
        return acc;
      }, [] as IPoolGroup[])
      // sort by existing ballances then by name
      .sort((a, b) => {
        if (a.symbol < b.symbol) return -1;
        if (a.symbol > b.symbol) return 1;
        return 0;
      });
    // update state
    setState((prev) => ({
      ...prev,
      markets,
      poolReserves,
      poolGroups,
    }));
  };

  const loadUserSummary = async () => {
    console.log("[INFO] {{AaveProvider}} loadUserSummary... ");
    if (user && state.markets && state.markets.length > 0) {
      const userSummaryAndIncentivesGroup = await Promise.all(
        state.markets.map((market) =>
          getUserSummaryAndIncentives({ market, currentTimestamp, user })
        )
      )
        .then((r) => r as IUserSummary[])
        .catch((error) => {
          console.error(
            "[ERROR] {{AaveProvider}} fetchUserSummaryAndIncentives: ",
            error
          );
          return null;
        });
      console.log("[INFO] {{AaveProvider}} fetchUserSummaryAndIncentives: ", {
        userSummaryAndIncentivesGroup,
      });
      if (
        userSummaryAndIncentivesGroup &&
        state.poolGroups &&
        state.poolGroups.length > 0
      ) {
        const poolGroups = state.poolGroups.map((poolGroup) => {
          const symbol = poolGroup.symbol;
          const borrowingEnabled = poolGroup.borrowingEnabled;
          // find all `s.userReservesData` with same symbol from all network and sum `totalBorrows`
          const totalBorrowBalance = getTotalBorrowBalanceBySymbol(
            userSummaryAndIncentivesGroup,
            symbol
          );
          // find all `s.userReservesData` with same symbol from all network and sum `underlyingBalance`
          const totalSupplyBalance = getTotalSupplyBalanceBySymbol(
            userSummaryAndIncentivesGroup,
            symbol
          );
          const totalWalletBalance = 0;
          const reserves = poolGroup.reserves.map((reserve) => {
            const userReserve = userSummaryAndIncentivesGroup
              .find((userSummary) => userSummary.chainId === reserve.chainId)
              ?.userReservesData?.find((userReserve) => {
                const {
                  reserve: { symbol },
                } = userReserve;
                if (symbol === reserve.symbol) {
                  return userReserve.reserve;
                }
                return null;
              });

            return {
              ...reserve,
              supplyBalance: Number(userReserve?.underlyingBalance) || 0,
              borrowBalance: Number(userReserve?.totalBorrows) || 0,
            };
          });
          const newState: IPoolGroup = {
            ...poolGroup,
            borrowingEnabled,
            totalBorrowBalance,
            totalSupplyBalance,
            totalWalletBalance,
            reserves,
          };
          return newState;
        });
        console.log("[INFO] {{AaveProvider}} updated poolGroups: ", {
          poolGroups,
        });
        // update `poolGroups.` with userSummaryAndIncentivesGroup
        setState((prev) => ({
          ...prev,
          userSummaryAndIncentivesGroup,
          poolGroups,
        }));
        console.log("[INFO] {{AaveProvider}} loadUserSummary loaded " );
      }
    } else if (!user && state.userSummaryAndIncentivesGroup) {
      console.log("[INFO] {{AaveProvider}} loadUserSummary user not loged " );
      setState((prev) => ({
        ...prev,
        userSummaryAndIncentivesGroup: null,
      }));
      init();
    }
  };

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    loadUserSummary();
  }, [user, state.markets]);

  return (
    <AaveContext.Provider
      value={{
        ...state,
        refresh: async () => {
          console.log("[INFO] {{AaveProvider}} refresh... ");
          let t = undefined;
          await new Promise((resolve) => {
            t = setTimeout(resolve, 10000);
          });
          clearTimeout(t);
          await init();
          console.log("[INFO] {{AaveProvider}} refresh done");
        },
      }}
    >
      {children}
    </AaveContext.Provider>
  );
};
