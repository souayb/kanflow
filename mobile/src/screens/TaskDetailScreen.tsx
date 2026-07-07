import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../api';
import { useNav } from '../navigation';
import type { ApiColumn, ApiTask, Priority } from '../types';
import { Badge, Button, Card, colors, priorityColor, text } from '../ui';

const PRIORITIES: Priority[] = ['low', 'medium', 'high'];

export default function TaskDetailScreen({ taskId, projectId }: { taskId: string; projectId: string }) {
  const nav = useNav();
  const [task, setTask] = useState<ApiTask | null>(null);
  const [columns, setColumns] = useState<ApiColumn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [{ tasks }, { columns }] = await Promise.all([
        api.getTasks(projectId),
        api.getColumns(projectId),
      ]);
      setTask(tasks.find((t) => t.id === taskId) ?? null);
      setColumns([...columns].sort((a, b) => a.order - b.order));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [projectId, taskId]);

  useEffect(() => {
    load();
  }, [load]);

  const patch = async (body: Partial<Pick<ApiTask, 'status' | 'priority'>>) => {
    if (!task) return;
    setBusy(true);
    try {
      const { task: updated } = await api.updateTask(task.id, body);
      setTask(updated);
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (!task) return;
    Alert.alert('Delete task', 'This also closes the linked GitHub issue. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteTask(task.id);
            nav.pop();
          } catch (e) {
            Alert.alert('Error', (e as Error).message);
          }
        },
      },
    ]);
  };

  if (error) return <Centered><Text style={{ color: colors.danger }}>{error}</Text></Centered>;
  if (!task) return <Centered><Text style={text.muted}>Loading…</Text></Centered>;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable onPress={nav.pop} hitSlop={12} style={{ marginBottom: 8 }}>
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>

      <View style={styles.titleRow}>
        <Text style={[text.h1, { flex: 1 }]}>{task.title}</Text>
        <Badge label={task.priority} color={priorityColor(task.priority)} />
      </View>

      {!!task.description && (
        <Card style={{ marginTop: 16 }}>
          <Text style={text.body}>{task.description}</Text>
        </Card>
      )}

      {task.githubIssueNumber != null && (
        <Pressable onPress={() => task.githubIssueUrl && Linking.openURL(task.githubIssueUrl)}>
          <Card style={{ marginTop: 16, borderColor: colors.low }}>
            <Text style={{ color: colors.low, fontWeight: '700' }}>🐙 GitHub issue #{task.githubIssueNumber}</Text>
            {!!task.githubIssueUrl && <Text style={[text.muted, { marginTop: 4 }]}>{task.githubIssueUrl}</Text>}
          </Card>
        </Pressable>
      )}

      <Text style={styles.label}>Priority</Text>
      <View style={styles.row}>
        {PRIORITIES.map((p) => (
          <Pressable
            key={p}
            disabled={busy}
            onPress={() => patch({ priority: p })}
            style={[styles.chip, { borderColor: priorityColor(p), backgroundColor: task.priority === p ? priorityColor(p) + '33' : 'transparent' }]}
          >
            <Text style={{ color: priorityColor(p), fontWeight: '600', textTransform: 'capitalize' }}>{p}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Move to column</Text>
      <View style={styles.row}>
        {columns.map((c) => (
          <Pressable
            key={c.id}
            disabled={busy}
            onPress={() => patch({ status: c.id })}
            style={[styles.chip, { borderColor: colors.primary, backgroundColor: task.status === c.id ? colors.primary + '33' : 'transparent' }]}
          >
            <Text style={{ color: colors.text, fontWeight: '600' }}>{c.title}</Text>
          </Pressable>
        ))}
      </View>

      <Button title="Delete task" variant="danger" onPress={remove} style={{ marginTop: 32 }} />
    </ScrollView>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 60 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  back: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { color: colors.muted, fontSize: 13, marginBottom: 6, marginTop: 20, fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1 },
});
