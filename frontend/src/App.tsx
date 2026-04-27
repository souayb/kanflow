/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
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

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
