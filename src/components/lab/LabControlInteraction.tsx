import { createContext, useContext, type ReactNode } from 'react';

type ReportControlInteraction = (controlId: string) => void;

const LabControlInteractionContext = createContext<ReportControlInteraction>(() => undefined);

interface LabControlInteractionProviderProps {
  children: ReactNode;
  onInteraction: ReportControlInteraction;
}

export function LabControlInteractionProvider({
  children,
  onInteraction,
}: LabControlInteractionProviderProps) {
  return (
    <LabControlInteractionContext.Provider value={onInteraction}>
      {children}
    </LabControlInteractionContext.Provider>
  );
}

export function useLabControlInteraction(): ReportControlInteraction {
  return useContext(LabControlInteractionContext);
}
