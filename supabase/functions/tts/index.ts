import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';

import { Text, View } from '@/components/Themed';

type BinType = 'Recycling' | 'Trash' | 'Compost' | 'Unknown';

export default function TabOneScreen() {
  const cameraRef = useRef<CameraView | null>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isScanning, setIsScanning] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [facing] = useState<CameraType>('back');
  const [lastResult, setLastResult] = useState<BinType>('Unknown');
  const [lastSpoken, setLastSpoken] = useState('');
  const [statusText, setStatusText] = useState('Starting camera...');

  useEffect(() => {
    if (!permission) return;

    if (!permission.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    if (!isCameraReady || !isScanning) return;

    speakOnce('Camera ready. Point your phone at a can, bottle, or item to scan.');
    setStatusText('Camera ready. Scanning automatically.');
  }, [isCameraReady, isScanning]);

  useEffect(() => {
    if (!isCameraReady || !isScanning) return;

    const interval = setInterval(() => {
      void handleAutoScan();
    }, 4000);

    return () => clearInterval(interval);
  }, [isCameraReady, isScanning, isBusy]);

  const speakOnce = (message: string) => {
    if (message === lastSpoken) return;
    Speech.stop();
    Speech.speak(message, {
      language: 'en',
      rate: 0.9,
      pitch: 1,
    });
    setLastSpoken(message);
  };

  const announceResult = async (bin: BinType, itemLabel?: string) => {
    let message = '';

    if (bin === 'Recycling') {
      message = itemLabel
        ? `${itemLabel} detected. Place it in the recycling bin.`
        : 'Place this item in the recycling bin.';
    } else if (bin === 'Trash') {
      message = itemLabel
        ? `${itemLabel} detected. Place it in the trash bin.`
        : 'Place this item in the trash bin.';
    } else if (bin === 'Compost') {
      message = itemLabel
        ? `${itemLabel} detected. Place it in the compost bin.`
        : 'Place this item in the compost bin.';
    } else {
      message = 'Item not recognized. Please try moving the camera closer.';
    }

    setLastResult(bin);
    setStatusText(message);
    speakOnce(message);

    // Haptics may do nothing while iOS Camera is active.
    // Keep this as a secondary cue, not the main accessible output.
    try {
      if (bin === 'Recycling') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (bin === 'Trash' || bin === 'Compost') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    } catch {
      // ignore haptics errors
    }
  };

  const handleAutoScan = async () => {
    if (!cameraRef.current || isBusy) return;

    try {
      setIsBusy(true);
      setStatusText('Scanning item...');

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5,
        base64: true,
        skipProcessing: true,
      });

      const result = await classifyPhoto(photo.base64 ?? '');

      await announceResult(result.bin, result.label);
    } catch (error) {
      console.log('Scan error:', error);
      setStatusText('Scan failed. Trying again.');
      speakOnce('Scan failed. Trying again.');
    } finally {
      setIsBusy(false);
    }
  };

  // Replace this with your real image classification call later.
  // For now it simulates the scan result so your camera + TTS flow works.
  const classifyPhoto = async (
    base64Image: string
  ): Promise<{ bin: BinType; label?: string }> => {
    if (!base64Image) {
      return { bin: 'Unknown' };
    }

    // TODO:
    // Send the image to your backend / ML model / vision API here.
    // Example future flow:
    // const res = await fetch('https://your-api-url/classify', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ image: base64Image }),
    // });
    // const data = await res.json();
    // return { bin: data.bin, label: data.label };

    // Temporary demo behavior for hackathon UI/TTS testing:
    const demoResults: Array<{ bin: BinType; label: string }> = [
      { bin: 'Recycling', label: 'Plastic bottle' },
      { bin: 'Recycling', label: 'Aluminum can' },
      { bin: 'Trash', label: 'Chip bag' },
      { bin: 'Compost', label: 'Banana peel' },
    ];

    const randomResult =
      demoResults[Math.floor(Math.random() * demoResults.length)];

    await new Promise((resolve) => setTimeout(resolve, 1200));
    return randomResult;
  };

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.helperText}>Loading camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>VirtuCycle</Text>
        <Text style={styles.helperText}>
          Camera access is required so the app can scan items and announce the
          correct bin.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Allow camera access"
          onPress={requestPermission}
          style={styles.permissionButton}
        >
          <Text style={styles.permissionButtonText}>Allow Camera Access</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        onCameraReady={() => setIsCameraReady(true)}
      />

      <View style={styles.overlay}>
        <Text style={styles.appTitle}>VirtuCycle</Text>
        <Text style={styles.status}>{statusText}</Text>
        <Text style={styles.result}>Last result: {lastResult}</Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isScanning ? 'Pause automatic scanning' : 'Resume automatic scanning'}
          onPress={() => setIsScanning((prev) => !prev)}
          style={styles.toggleButton}
        >
          <Text style={styles.toggleButtonText}>
            {isScanning ? 'Pause Scanning' : 'Resume Scanning'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 40,
    padding: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.68)',
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  status: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  result: {
    fontSize: 15,
    color: '#d1fae5',
    marginBottom: 14,
    textAlign: 'center',
    fontWeight: '600',
  },
  toggleButton: {
    backgroundColor: '#22c55e',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  toggleButtonText: {
    color: '#ffffff',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 10,
  },
  helperText: {
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 22,
    marginTop: 10,
    marginBottom: 20,
  },
  permissionButton: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
  },
  permissionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});