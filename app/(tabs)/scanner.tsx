import { useAppTheme } from '@/hooks/useAppTheme';
import { useSession } from '@/hooks/useSession';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';


type BinType = 'Recycling' | 'Trash' | 'Compost' | 'Unknown';

export default function TabOneScreen() {
  const colors = useAppTheme();
  const { ttsEnabled } = useSession();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
  }, [isCameraReady, isScanning]);

  const speakOnce = (message: string) => {
    if (message === lastSpoken) return;
    setLastSpoken(message);
    if (!ttsEnabled) return;
    Speech.stop();
    Speech.speak(message, {
      language: 'en-US',
      rate: 0.9,
      pitch: 1.0,
    });
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
      message = 'I am not sure. Move the item closer and hold it steady.';
    }

    setLastResult(bin);
    setStatusText(message);
    speakOnce(message);

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

      if (result.bin === 'Unknown') {
        setLastResult('Unknown');
        setStatusText('I am not sure. Move the item closer and hold it steady.');
        speakOnce('Move closer and try again.');
        return;
      }

      await announceResult(result.bin, result.label);
    } catch (error) {
      console.log('Scan error:', error);
      setStatusText('Scan failed. Trying again.');
      speakOnce('Scan failed. Trying again.');
    } finally {
      setIsBusy(false);
    }
  };

  const classifyPhoto = async (
    base64Image: string
  ): Promise<{ bin: BinType; label?: string }> => {
    if (!base64Image || base64Image.length < 1000) {
      return { bin: 'Unknown' };
    }
  
    try {
      const res = await fetch('https://your-api-url/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image }),
      });
  
      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }
  
      const data = await res.json();
      console.log('API response:', data);
  
      const confidence = Number(data.confidence ?? 0);
      const label = String(data.label ?? '').toLowerCase();
  
      if (confidence < 0.5) {
        return { bin: 'Unknown' };
      }
  
      if (label.includes('bottle') || label.includes('can')) {
        return { bin: 'Recycling', label };
      }
  
      if (
        label.includes('banana') ||
        label.includes('food') ||
        label.includes('fruit') ||
        label.includes('peel')
      ) {
        return { bin: 'Compost', label };
      }
  
      if (
        label.includes('bag') ||
        label.includes('wrapper') ||
        label.includes('plastic bag')
      ) {
        return { bin: 'Trash', label };
      }
  
      return { bin: 'Unknown', label };
    } catch (err) {
      console.log('Classification error:', err);
  
      // Demo fallback so your app still works during development
      const demoResults: Array<{ bin: BinType; label: string }> = [
        { bin: 'Recycling', label: 'plastic bottle' },
        { bin: 'Recycling', label: 'aluminum can' },
        { bin: 'Trash', label: 'chip bag' },
        { bin: 'Compost', label: 'banana peel' },
      ];
  
      const fallback =
        demoResults[Math.floor(Math.random() * demoResults.length)];
  
      return fallback;
    }
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

function createStyles(colors: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
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
      backgroundColor: colors.overlay,
    },
    appTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.onPrimary,
      marginBottom: 8,
      textAlign: 'center',
    },
    status: {
      fontSize: 16,
      color: colors.onPrimary,
      marginBottom: 8,
      textAlign: 'center',
    },
    result: {
      fontSize: 15,
      color: colors.primaryFixed,
      marginBottom: 14,
      textAlign: 'center',
      fontWeight: '600',
    },
    toggleButton: {
      backgroundColor: colors.tertiary,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    toggleButtonText: {
      color: colors.onPrimary,
      textAlign: 'center',
      fontSize: 16,
      fontWeight: '700',
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      backgroundColor: colors.background,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      marginBottom: 10,
      color: colors.primary,
    },
    helperText: {
      textAlign: 'center',
      fontSize: 16,
      lineHeight: 22,
      marginTop: 10,
      marginBottom: 20,
      color: colors.text,
    },
    permissionButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderRadius: 14,
    },
    permissionButtonText: {
      color: colors.onPrimary,
      fontSize: 16,
      fontWeight: '700',
    },
  });
}
