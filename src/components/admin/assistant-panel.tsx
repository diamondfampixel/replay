"use client";

import * as React from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { AssistantChat } from "@/components/admin/assistant-chat";

type AssistantPanelValue = {
  open: (prompt?: string) => void;
  close: () => void;
};

const AssistantPanelContext = React.createContext<AssistantPanelValue>({
  open: () => {},
  close: () => {},
});

export function useAssistantPanel() {
  return React.useContext(AssistantPanelContext);
}

/**
 * The assistant is reachable from anywhere in the admin as a side panel. The
 * dedicated /admin/assistant page renders the same component with history.
 */
export function AssistantPanelProvider({
  aiConfigured,
  children,
}: {
  aiConfigured: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [seedPrompt, setSeedPrompt] = React.useState<string | undefined>();
  const [sessionKey, setSessionKey] = React.useState(0);

  const value = React.useMemo<AssistantPanelValue>(
    () => ({
      open: (prompt?: string) => {
        setSeedPrompt(prompt);
        setSessionKey((key) => key + 1);
        setIsOpen(true);
      },
      close: () => setIsOpen(false),
    }),
    [],
  );

  return (
    <AssistantPanelContext.Provider value={value}>
      {children}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent width="max-w-[540px]" className="p-0">
          <SheetTitle className="sr-only">AI business assistant</SheetTitle>
          {isOpen && (
            <AssistantChat
              key={sessionKey}
              aiConfigured={aiConfigured}
              seedPrompt={seedPrompt}
              variant="panel"
            />
          )}
        </SheetContent>
      </Sheet>
    </AssistantPanelContext.Provider>
  );
}
