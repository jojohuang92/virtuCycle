import { VisionCameraProxy, type Frame } from "react-native-vision-camera";

export type VisionDetectionLabel = {
  text: string;
  confidence: number;
  index: number;
};

export type VisionDetectionBounds = {
  x: number;
  y: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  top: number;
  left: number;
  bottom: number;
  right: number;
};

export type VisionDetectedObject = {
  trackingId?: number;
  bounds: VisionDetectionBounds;
  labels: VisionDetectionLabel[];
};

type DetectObjectsPlugin = {
  call(frame: Frame): VisionDetectedObject[];
};

export function createDetectObjectsPlugin() {
  const plugin = VisionCameraProxy.initFrameProcessorPlugin("detectObjects", {
    mode: "stream",
    detectionType: "multiple",
    classifyObjects: true,
  }) as DetectObjectsPlugin | undefined;

  if (!plugin) {
    throw new Error("Vision Camera object detection plugin is not available.");
  }

  return {
    detectObjects(frame: Frame): VisionDetectedObject[] {
      "worklet";
      return plugin.call(frame) ?? [];
    },
  };
}
