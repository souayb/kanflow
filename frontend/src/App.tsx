/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { AppProvider } from './AppContext';
import Layout from './components/Layout';
import { useApp } from './AppContext';
import DashboardView from './components/DashboardView';
import KanbanView from './components/KanbanView';
import ReportingView from './components/ReportingView';
import PersonalTodoView from './components/PersonalTodoView';
import TimeKeepingView from './components/TimeKeepingView';

function AppContent() {
  const [currentView, setCurrentView] = React.useState<'dashboard' | 'kanban' | 'reporting' | 'todos' | 'time'>('kanban');
  const { boardNavSeq } = useApp();
  const lastNavSeq = React.useRef(0);

  React.useEffect(() => {
    if (boardNavSeq > lastNavSeq.current) {
      lastNavSeq.current = boardNavSeq;
      setCurrentView('kanban');
    }
  }, [boardNavSeq]);

  return (
    <Layout currentView={currentView} onViewChange={setCurrentView}>
      {currentView === 'dashboard' && <DashboardView />}
      {currentView === 'kanban' && <KanbanView />}
      {currentView === 'reporting' && <ReportingView />}
      {currentView === 'todos' && <PersonalTodoView />}
      {currentView === 'time' && <TimeKeepingView />}
    </Layout>
  );
}

function AuthenticatedApp() {
  const { kcUser } = useAuth();
  return (
    <AppProvider kcUser={kcUser}>
      <AppContent />
    </AppProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}
