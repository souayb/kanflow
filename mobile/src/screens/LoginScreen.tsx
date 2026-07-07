import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth';
import { Button, colors, text } from '../ui';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);

  const onPress = async () => {
    setLoading(true);
    try {
      await signIn();
    } catch (e) {
      const msg = (e as Error).message;
      if (msg !== 'cancelled') Alert.alert('Sign-in failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>Kanflow</Text>
      <Text style={[text.muted, { textAlign: 'center', marginBottom: 40 }]}>
        Manage your boards and sync tasks to GitHub.
      </Text>
      <Button title="Sign in with Keycloak" onPress={onPress} loading={loading} style={{ minWidth: 240 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  logo: { color: colors.primary, fontSize: 40, fontWeight: '800', marginBottom: 8 },
});
