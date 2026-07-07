import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { api } from '../api';
import { useAuth } from '../auth';
import { useNav } from '../navigation';
import type { ApiProject } from '../types';
import { Button, Card, colors, text } from '../ui';

export default function ProjectsScreen() {
  const { user, signOut } = useAuth();
  const nav = useNav();
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { projects } = await api.getProjects();
      setProjects(projects);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={text.muted}>Signed in as</Text>
          <Text style={text.h2}>{user?.name ?? user?.email ?? 'you'}</Text>
        </View>
        <Button title="Sign out" variant="ghost" onPress={signOut} style={{ paddingVertical: 8 }} />
      </View>

      <Text style={[text.h1, { marginBottom: 12 }]}>Projects</Text>

      {error && <Text style={{ color: colors.danger, marginBottom: 12 }}>{error}</Text>}

      <FlatList
        data={projects}
        keyExtractor={(p) => p.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.text} />}
        ListEmptyComponent={
          !loading ? <Text style={text.muted}>No projects yet. Create one in the web app.</Text> : null
        }
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item }) => (
          <Pressable onPress={() => nav.push({ name: 'Board', projectId: item.id, projectName: item.name })}>
            <Card>
              <Text style={text.h2}>{item.name}</Text>
              {!!item.description && <Text style={[text.muted, { marginTop: 4 }]}>{item.description}</Text>}
            </Card>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
});
