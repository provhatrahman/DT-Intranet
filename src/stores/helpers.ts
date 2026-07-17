import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "./useAppStore";
import { useIpodStore } from "./useIpodStore";

// Generic shallow-equality store subscription helper for stores co-located
// with their own `use[Name]StoreShallow` wrapper (e.g. useDisplaySettingsStore,
// useAudioSettingsStore). Keep new store-specific wrappers next to their store
// module instead of adding them here, to avoid this barrel growing back into a
// bundle that drags in every store.
type BoundStoreHook<TState> = {
  <TSelected>(selector: (state: TState) => TSelected): TSelected;
  getState: () => TState;
};

export function useStoreShallow<TState, TSelected>(
  store: BoundStoreHook<TState>,
  selector: (state: TState) => TSelected
): TSelected {
  return store(useShallow(selector));
}

// Generic helper to wrap a selector with Zustand's shallow comparator for AppStore
export function useAppStoreShallow<T>(
  selector: (state: ReturnType<typeof useAppStore.getState>) => T
): T {
  return useAppStore(useShallow(selector));
}

// Generic helper to wrap a selector with Zustand's shallow comparator for IpodStore
export function useIpodStoreShallow<T>(
  selector: (state: ReturnType<typeof useIpodStore.getState>) => T
): T {
  return useIpodStore(useShallow(selector));
}