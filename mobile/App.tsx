import React, { useEffect } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/auth';
import { setTokenGetter } from './src/api';
import { NavProvider, useNav } from './src/navigation';
import { colors } from './src/ui';
import LoginScreen from './src/screens/LoginScreen';
import ProjectsScreen from './src/screens/ProjectsScreen';
import BoardScreen from './src/screens/BoardScreen';
import NewTaskScreen from './src/screens/NewTaskScreen';
import TaskDetailScreen from './src/screens/TaskDetailScreen';

/** Renders only the top route so navigating back remounts (and refreshes) screens. */
function Router() {
  const { route } = useNav();
  switch (route.name) {
    case 'Projects':
      return <ProjectsScreen />;
    case 'Board':
      return <BoardScreen projectId={route.projectId} projectName={route.projectName} />;
    case 'NewTask':
      return <NewTaskScreen projectId={route.projectId} />;
    case 'TaskDetail':
      return <TaskDetailScreen taskId={route.taskId} projectId={route.projectId} />;
  }
}

function Gate() {
  const { ready, token, getFreshToken } = useAuth();

  // Give the API client a way to fetch a fresh Bearer token.
  useEffect(() => {
    setTokenGetter(getFreshToken);
  }, [getFreshToken]);

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }
  if (!token) return <LoginScreen />;

  return (
    <NavProvider initial={{ name: 'Projects' }}>
      <Router />
    </NavProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <Gate />
      </SafeAreaView>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
