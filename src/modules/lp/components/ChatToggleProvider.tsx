"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type ChatToggleHandlers = {
  open: () => void;
  close: () => void;
};

type ChatToggleContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  registerHandlers: (handlers: ChatToggleHandlers) => () => void;
};

const ChatToggleContext = createContext<ChatToggleContextValue | null>(null);

export function ChatToggleProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const handlersRef = useRef<ChatToggleHandlers | null>(null);

  const open = useCallback(() => {
    setIsOpen(true);
    handlersRef.current?.open();
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    handlersRef.current?.close();
  }, []);

  const registerHandlers = useCallback((handlers: ChatToggleHandlers) => {
    handlersRef.current = handlers;
    return () => {
      if (handlersRef.current === handlers) {
        handlersRef.current = null;
      }
    };
  }, []);

  const value = useMemo(
    () => ({ isOpen, open, close, registerHandlers }),
    [isOpen, open, close, registerHandlers],
  );

  return <ChatToggleContext.Provider value={value}>{children}</ChatToggleContext.Provider>;
}

export function useChatToggle(): { isOpen: boolean; open: () => void; close: () => void } {
  const ctx = useContext(ChatToggleContext);
  if (!ctx) {
    return {
      isOpen: false,
      open: () => undefined,
      close: () => undefined,
    };
  }
  return { isOpen: ctx.isOpen, open: ctx.open, close: ctx.close };
}

export function useChatToggleRegister(): ChatToggleContextValue["registerHandlers"] {
  const ctx = useContext(ChatToggleContext);
  if (!ctx) {
    return () => () => undefined;
  }
  return ctx.registerHandlers;
}
