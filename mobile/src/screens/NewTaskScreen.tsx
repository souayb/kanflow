import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '../api';
import { useNav } from '../navigation';
import type { ApiColumn, Priority } from '../types';
import { Button, colors, priorityColor, text } from '../ui';

const PRIORITIES: Priority[] = ['low', 'medium', 'high'];

export default function NewTaskScreen({ projectId }: { projectId: string }) {
  const nav = useNav();
  const [columns, setColumns] = useState<ApiColumn[]>([]);
  const [columnId, setColumnId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.getColumns(projectId).then(({ columns }) => {
      const sorted = [...columns].sort((a, b) => a.order - b.order);
      setColumns(sorted);
      setColumnId(sorted[0]?.id ?? null);
    });
  }, [projectId]);

  const submit = async () => {
    if (!title.trim() || !columnId) {
      Alert.alert('Missing info', 'A title and a column are required.');
      return;
    }
    setSubmitting(true);
    try {
      const { task } = await api.createTask(projectId, {
        title: title.trim(),
        description: description.trim(),
        priority,
        status: columnId,
      });
      const msg = task.githubIssueNumber != null
        ? `Task created and synced to GitHub issue #${task.githubIssueNumber}.`
        : 'Task created. (GitHub sync is off or unavailable.)';
      Alert.alert('Done', msg);
      nav.pop();
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable onPress={nav.pop} hitSlop={12}>
            <Text style={styles.back}>‹ Back</Text>
          </Pressable>
        </View>
        <Text style={[text.h1, { marginBottom: 20 }]}>New task</Text>

        <Text style={styles.label}>Title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="What needs doing?"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Details (becomes the GitHub issue body)"
          placeholderTextColor={colors.muted}
          multiline
          style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
        />

        <Text style={styles.label}>Priority</Text>
        <View style={styles.row}>
          {PRIORITIES.map((p) => (
            <Pressable
              key={p}
              onPress={() => setPriority(p)}
              style={[
                styles.chip,
                { borderColor: priorityColor(p), backgroundColor: priority === p ? priorityColor(p) + '33' : 'transparent' },
              ]}
            >
              <Text style={{ color: priorityColor(p), fontWeight: '600', textTransform: 'capitalize' }}>{p}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Column</Text>
        <View style={styles.row}>
          {columns.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => setColumnId(c.id)}
              style={[
                styles.chip,
                { borderColor: colors.primary, backgroundColor: columnId === c.id ? colors.primary + '33' : 'transparent' },
              ]}
            >
              <Text style={{ color: colors.text, fontWeight: '600' }}>{c.title}</Text>
            </Pressable>
          ))}
        </View>

        <Button title="Create task" onPress={submit} loading={submitting} style={{ marginTop: 28 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 60 },
  header: { marginBottom: 8 },
  back: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  label: { color: colors.muted, fontSize: 13, marginBottom: 6, marginTop: 16, fontWeight: '600' },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    color: colors.text,
    fontSize: 15,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1 },
});
