import { Colors } from '@/constants/Colors';
import { FontFamily, TypeScale } from '@/constants/typography';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DashboardScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        <Ionicons name="leaf" size={48} color={Colors.primary} />
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.subtitle}>Coming soon</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  title: {
    fontFamily: FontFamily.displayBold,
    fontSize: TypeScale.headlineMd,
    color: Colors.primary,
  },
  subtitle: {
    fontFamily: FontFamily.body,
    fontSize: TypeScale.bodyMd,
    color: Colors.textMuted,
  },
});
