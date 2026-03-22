#import "VirtuCycleObjectDetectionFrameProcessor.h"

#import <MLKitObjectDetection/MLKitObjectDetection.h>
#import <MLKitObjectDetectionCommon/MLKObject.h>
#import <MLKitObjectDetectionCommon/MLKObjectDetector.h>
#import <MLKitObjectDetectionCommon/MLKObjectLabel.h>
#import <MLKitVision/MLKVisionImage.h>
#import <UIKit/UIKit.h>
#import <VisionCamera/Frame.h>
#import <VisionCamera/FrameProcessorPlugin.h>

@interface VirtuCycleDetectObjectsPlugin : FrameProcessorPlugin
@property(nonatomic, strong) MLKObjectDetector* detector;
@property(nonatomic, strong) NSArray* latestResults;
@end

@implementation VirtuCycleDetectObjectsPlugin

- (instancetype)initWithProxy:(VisionCameraProxyHolder*)proxy withOptions:(NSDictionary*)options {
  self = [super initWithProxy:proxy withOptions:options];
  if (self) {
    NSString* modeString = options[@"mode"] ?: @"stream";
    NSString* detectionType = options[@"detectionType"] ?: @"single";
    BOOL classifyObjects = [options[@"classifyObjects"] boolValue];

    MLKObjectDetectorOptions* detectorOptions = [[MLKObjectDetectorOptions alloc] init];
    detectorOptions.detectorMode = [modeString isEqualToString:@"image"]
      ? MLKObjectDetectorModeSingleImage
      : MLKObjectDetectorModeStream;

    if ([detectionType isEqualToString:@"multiple"]) {
      detectorOptions.shouldEnableMultipleObjects = YES;
    }

    detectorOptions.shouldEnableClassification = classifyObjects;
    _detector = [MLKObjectDetector objectDetectorWithOptions:detectorOptions];
    _latestResults = @[];
  }
  return self;
}

- (UIImageOrientation)visionOrientationForFrame:(Frame*)frame {
  switch (frame.orientation) {
    case UIImageOrientationLeft:
      return UIImageOrientationRight;
    case UIImageOrientationRight:
      return UIImageOrientationLeft;
    default:
      return frame.orientation;
  }
}

- (id)callback:(Frame*)frame withArguments:(NSDictionary*)arguments {
  CMSampleBufferRef buffer = frame.buffer;
  MLKVisionImage* image = [[MLKVisionImage alloc] initWithBuffer:buffer];
  image.orientation = [self visionOrientationForFrame:frame];

  __block NSArray<MLKObject*>* detectedObjects = @[];
  __block NSError* detectionError = nil;
  dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);

  [self.detector processImage:image
                   completion:^(NSArray<MLKObject*>* _Nullable objects, NSError* _Nullable error) {
    detectedObjects = objects ?: @[];
    detectionError = error;
    dispatch_semaphore_signal(semaphore);
  }];

  long waitResult = dispatch_semaphore_wait(semaphore, dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.05 * NSEC_PER_SEC)));
  if (detectionError != nil) {
    return self.latestResults;
  }

  if (waitResult != 0) {
    return self.latestResults;
  }

  NSMutableArray* output = [NSMutableArray arrayWithCapacity:detectedObjects.count];
  for (MLKObject* object in detectedObjects) {
    CGRect bounds = object.frame;
    NSMutableArray* labels = [NSMutableArray arrayWithCapacity:object.labels.count];

    for (MLKObjectLabel* label in object.labels) {
      [labels addObject:@{
        @"text": label.text ?: @"",
        @"confidence": @(label.confidence),
        @"index": @(label.index),
      }];
    }

    NSMutableDictionary* item = [@{
      @"bounds": @{
        @"x": @(CGRectGetMidX(bounds)),
        @"y": @(CGRectGetMidY(bounds)),
        @"centerX": @(CGRectGetMidX(bounds)),
        @"centerY": @(CGRectGetMidY(bounds)),
        @"width": @(CGRectGetWidth(bounds)),
        @"height": @(CGRectGetHeight(bounds)),
        @"top": @(CGRectGetMinY(bounds)),
        @"left": @(CGRectGetMinX(bounds)),
        @"bottom": @(CGRectGetMaxY(bounds)),
        @"right": @(CGRectGetMaxX(bounds)),
      },
      @"labels": labels,
    } mutableCopy];

    if (object.trackingID != nil) {
      item[@"trackingId"] = object.trackingID;
    }

    [output addObject:item];
  }

  self.latestResults = output;
  return output;
}

VISION_EXPORT_FRAME_PROCESSOR(VirtuCycleDetectObjectsPlugin, detectObjects)

@end

@implementation VirtuCycleObjectDetectionFrameProcessor
@end