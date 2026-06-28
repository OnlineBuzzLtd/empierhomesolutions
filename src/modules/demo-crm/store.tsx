"use client";

import { createContext, useCallback, useContext, useMemo, useReducer, useState, type ReactNode } from "react";
import { AGENT_SCRIPTS } from "./agent-scripts";
import { demoCrmReducer } from "./reducer";
import { createSeedState } from "./seed";
import type { DemoAgentId, DemoCrmState } from "./types";

type DemoStoreValue = {
  state: DemoCrmState;
  /** Agent currently playing its scripted conversation, or null. */
  runningAgent: DemoAgentId | null;
  /** Play an agent's conversation, then materialize its CRM entries. */
  runAgent: (agent: DemoAgentId) => Promise<void>;
  /** Wipe all records for a clean test slate (keeps the team). */
  clearAll: () => void;
};

const DemoStoreContext = createContext<DemoStoreValue | null>(null);

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function DemoStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(demoCrmReducer, undefined, () => createSeedState());
  const [runningAgent, setRunningAgent] = useState<DemoAgentId | null>(null);

  const runAgent = useCallback(
    async (agent: DemoAgentId) => {
      if (runningAgent) return;
      const script = AGENT_SCRIPTS[agent];
      setRunningAgent(agent);
      dispatch({ type: "clear_conversation", agent });
      try {
        for (const turn of script.turns) {
          await delay(turn.role === "system" ? 650 : 950);
          dispatch({ type: "append_message", agent, message: turn });
        }
        await delay(700);
        dispatch({ type: "apply_outcome", agent, outcome: script.produces });
      } finally {
        setRunningAgent(null);
      }
    },
    [runningAgent],
  );

  const clearAll = useCallback(() => {
    if (runningAgent) return;
    dispatch({ type: "clear_all" });
  }, [runningAgent]);

  const value = useMemo<DemoStoreValue>(
    () => ({ state, runningAgent, runAgent, clearAll }),
    [state, runningAgent, runAgent, clearAll],
  );

  return <DemoStoreContext.Provider value={value}>{children}</DemoStoreContext.Provider>;
}

export function useDemoStore(): DemoStoreValue {
  const ctx = useContext(DemoStoreContext);
  if (!ctx) {
    throw new Error("useDemoStore must be used within a DemoStoreProvider");
  }
  return ctx;
}
