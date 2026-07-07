import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../api';
import { useNav } from '../navigation';
import type { ApiColumn, ApiTask } from '../types';
import { Badge, Button, Card, colors, priorityColor, text } from '../ui';

export default function BoardScreen({ projectId, projectName }: { projectId: string; projectName: string }) {
  const nav = useNav();
  const [columns, setColumns] = useState<ApiColumn[]>([]);
  const [tasks, setTasks] = useState<ApiTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [{ columns }, { tasks }] = await Promise.all([
        api.getColumns(projectId),
        api.getTasks(projectId),
      ]);
      setColumns([...columns].sort((a, b) => a.order - b.order));
      setTasks(tasks);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={nav.pop} hitSlop={12}>
          <Text style={styles.back}>‹ Projects</Text>
        </Pressable>
        <Button
          title="+ New task"
          onPress={() => nav.push({ name: 'NewTask', projectId })}
          style={{ paddingVertical: 8 }}
        />
      </View>

      <Text style={[text.h1, { marginBottom: 16 }]}>{projectName}</Text>
      {error && <Text style={{ color: colors.danger, marginBottom: 12 }}>{error}</Text>}

      <ScrollView
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.text} />}
      >
        {columns.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id);
          return (
            <View key={col.id} style={{ marginBottom: 24 }}>
              <View style={styles.colHeader}>
                <Text style={text.h2}>{col.title}</Text>
                <Text style={text.muted}>{colTasks.length}</Text>
              </View>
              {colTasks.length === 0 && <Text style={[text.muted, { marginTop: 6 }]}>No tasks</Text>}
              {colTasks.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => nav.push({ name: 'TaskDetail', taskId: t.id, projectId })}
                  style={{ marginTop: 10 }}
                >
                  <Card>
                    <View style={styles.taskTop}>
                      <Text style={[text.body, { flex: 1, fontWeight: '600' }]}>{t.title}</Text>
                      <Badge label={t.priority} color={priorityColor(t.priority)} />
                    </View>
                    {!!t.description && (
                      <Text style={[text.muted, { marginTop: 6 }]} numberOfLines={2}>
                        {t.description}
                      </Text>
                    )}
                    {t.githubIssueNumber != null && (
                      <View style={styles.ghRow}>
                        <Text style={styles.ghText}>🐙 GitHub #{t.githubIssueNumber}</Text>
                      </View>
                    )}
                  </Card>
                </Pressable>
              ))}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  back: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  colHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  taskTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ghRow: { marginTop: 10, flexDirection: 'row' },
  ghText: { color: colors.low, fontSize: 12, fontWeight: '600' },
});
