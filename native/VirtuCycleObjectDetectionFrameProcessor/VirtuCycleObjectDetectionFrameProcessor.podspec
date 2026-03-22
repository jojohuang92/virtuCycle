Pod::Spec.new do |s|
  s.name = 'VirtuCycleObjectDetectionFrameProcessor'
  s.version = '1.0.0'
  s.summary = 'Local Vision Camera frame processor for ML Kit object detection.'
  s.homepage = 'https://example.invalid/virtucycle'
  s.license = { :type => 'MIT' }
  s.authors = { 'VirtuCycle' => 'local' }
  s.platforms = { :ios => '15.1' }
  s.source = { :path => '.' }
  s.source_files = 'ios/**/*.{h,m,mm}'
  s.dependency 'VisionCamera'
  s.dependency 'GoogleMLKit/ObjectDetection'
end