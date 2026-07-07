import React, { createContext, useContext, useMemo, useState } from 'react';

/** Minimal stack navigator — avoids a nav library so `npm install` stays lean. */
export type Route =
  | { name: 'Projects' }
  | { name: 'Board'; projectId: string; projectName: string }
  | { name: 'NewTask'; projectId: string }
  | { name: 'TaskDetail'; taskId: string; projectId: string };

interface Nav {
  route: Route;
  stack: Route[];
  push: (r: Route) => void;
  pop: () => void;
  reset: (r: Route) => void;
}

const NavContext = createContext<Nav | null>(null);

export function NavProvider({ initial, children }: { initial: Route; children: React.ReactNode }) {
  const [stack, setStack] = useState<Route[]>([initial]);
  const value = useMemo<Nav>(
    () => ({
      route: stack[stack.length - 1],
      stack,
      push: (r) => setStack((s) => [...s, r]),
      pop: () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)),
      reset: (r) => setStack([r]),
    }),
    [stack],
  );
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav(): Nav {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNav must be used within NavProvider');
  return ctx;
}
