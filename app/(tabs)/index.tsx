import { StyleSheet, TouchableOpacity } from 'react-native';
import * as Speech from 'expo-speech';

import { Text, View } from '@/components/Themed';

export default function TabOneScreen() {
  const speakBinInstruction = (binType: 'Recycling' | 'Trash' | 'Compost') => {
    let message = '';

    if (binType === 'Recycling') {
      message = 'This item goes in the recycling bin.';
    } else if (binType === 'Trash') {
      message = 'This item goes in the trash bin.';
    } else if (binType === 'Compost') {
      message = 'This item goes in the compost bin.';
    }

    Speech.stop();
    Speech.speak(message, {
      language: 'en',
      pitch: 1,
      rate: 0.9,
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>VirtuCycle</Text>
      <Text style={styles.subtitle}>
        Tap a button to hear where the item should go.
      </Text>

      <TouchableOpacity
        style={[styles.button, styles.recyclingButton]}
        onPress={() => speakBinInstruction('Recycling')}
      >
        <Text style={styles.buttonText}>Recycling</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.trashButton]}
        onPress={() => speakBinInstruction('Trash')}
      >
        <Text style={styles.buttonText}>Trash</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.compostButton]}
        onPress={() => speakBinInstruction('Compost')}
      >
        <Text style={styles.buttonText}>Compost</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  recyclingButton: {
    backgroundColor: '#2e7d32',
  },
  trashButton: {
    backgroundColor: '#616161',
  },
  compostButton: {
    backgroundColor: '#8d6e63',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});