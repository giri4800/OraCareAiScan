import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Camera, Upload, Search, Loader2 } from "lucide-react";

export default function ImageUpload() {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    return () => {
      // Cleanup: stop camera stream when component unmounts
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [isFrontCamera, setIsFrontCamera] = useState(false);

  const getAvailableCameras = async () => {
    try {
      // First request permission
      await navigator.mediaDevices.getUserMedia({ video: true });
      
      // Then enumerate devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      console.log('Available cameras:', videoDevices);
      setAvailableCameras(videoDevices);
      
      // Select the first camera by default
      if (videoDevices.length > 0 && !selectedCamera) {
        setSelectedCamera(videoDevices[0].deviceId);
      }
      
      return videoDevices;
    } catch (error) {
      console.error('Error getting cameras:', error);
      toast({
        variant: "destructive",
        title: "Camera Error",
        description: "Failed to access camera list. Please check permissions.",
      });
      return [];
    }
  };

  const handleCameraCapture = async () => {
    try {
      // Reset any existing streams
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      // Get available cameras first
      const cameras = await getAvailableCameras();
      
      // Determine if we're on a mobile device
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      let constraints: MediaTrackConstraints = {
        width: { ideal: isMobile ? 1280 : 1920 },
        height: { ideal: isMobile ? 720 : 1080 },
        // Set quality and framerate for better performance
        aspectRatio: { ideal: 16/9 },
        frameRate: { max: 30 }
      };

      // Handle different camera scenarios
      if (isMobile) {
        // On mobile, use facingMode
        constraints.facingMode = isFrontCamera ? 'user' : 'environment';
      } else if (selectedCamera) {
        // On desktop with specific camera selected
        constraints.deviceId = { exact: selectedCamera };
      }

      console.log('Attempting to access camera with constraints:', constraints);

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: constraints,
        audio: false
      });

      // Store the stream reference
      streamRef.current = stream;

      // Ensure video element is ready
      if (!videoRef.current) {
        throw new Error("Video element not initialized");
      }

      // Set the stream to video element
      videoRef.current.srcObject = stream;
      
      // Wait for video to be ready
      await new Promise((resolve) => {
        if (!videoRef.current) return;
        videoRef.current.onloadedmetadata = () => resolve(true);
      });

      console.log('Camera stream started successfully');
      setShowCamera(true);
      
    } catch (error) {
      console.error('Camera access error:', error);
      toast({
        variant: "destructive",
        title: "Camera Error",
        description: error instanceof Error 
          ? `Failed to access camera: ${error.message}`
          : "Failed to access camera. Please check permissions.",
        duration: 5000,
      });
    }
  };

  const handleCapture = async () => {
    try {
      if (!videoRef.current || !videoRef.current.srcObject) {
        toast({
          variant: "destructive",
          title: "Camera Error",
          description: "Camera stream not available. Please try again.",
        });
        return;
      }

      // Pause video to ensure frame capture is stable
      videoRef.current.pause();

      // Ensure video is playing and ready
      if (videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
        toast({
          title: "Please wait",
          description: "Camera is initializing...",
        });
        return;
      }

      // Create canvas with video dimensions
      const canvas = document.createElement('canvas');
      const video = videoRef.current;
      
      // Get the actual video stream dimensions
      const streamSettings = (video.srcObject as MediaStream)
        .getVideoTracks()[0].getSettings();
      
      // Set canvas size to match video stream
      canvas.width = streamSettings.width || video.videoWidth;
      canvas.height = streamSettings.height || video.videoHeight;
      
      console.log('Capturing image with dimensions:', {
        width: canvas.width,
        height: canvas.height
      });
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error("Could not get canvas context");
      }

      // Clear canvas and draw video frame
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert to blob with high quality
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.95);
      });

      if (!blob) {
        throw new Error("Failed to capture image");
      }

      // Create file from blob
      const file = new File([blob], `camera-capture-${Date.now()}.jpg`, { 
        type: "image/jpeg",
        lastModified: Date.now()
      });

      // Log capture details
      console.log('Image captured:', {
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
      });

      // Handle the captured image
      handleImageSelect(file);
      
      // Clean up camera
      setShowCamera(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      toast({
        title: "Success",
        description: "Image captured successfully",
        duration: 3000,
      });

    } catch (error) {
      console.error('Capture error:', error);
      toast({
        variant: "destructive",
        title: "Capture Failed",
        description: error instanceof Error ? error.message : "Failed to capture image",
        duration: 5000,
      });
    }
  };

  const handleImageSelect = (file: File) => {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast({
        variant: "destructive",
        title: "Invalid File Type",
        description: `Please select a valid image file (${validTypes.join(", ")})`,
      });
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "File Too Large",
        description: "Image size should be less than 5MB",
      });
      return;
    }

    console.log("Selected file:", {
      name: file.name,
      type: file.type,
      size: file.size
    });

    setSelectedImage(file);
    const imageUrl = URL.createObjectURL(file);
    setPreviewUrl(imageUrl);
  };

  const handleAnalyze = async () => {
    if (!selectedImage) {
      toast({
        variant: "destructive",
        title: "No Image Selected",
        description: "Please select an image first",
      });
      return;
    }
    
    setIsUploading(true);
    setProgress(25);

    try {
      const formData = new FormData();
      formData.append("image", selectedImage);

      console.log("Starting image analysis...", {
        name: selectedImage.name,
        type: selectedImage.type,
        size: selectedImage.size
      });

      setProgress(50);
      const response = await fetch("/api/analysis", {
        method: "POST",
        body: formData
      });

      console.log("Response received:", response.status);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      setProgress(75);
      const result = await response.json();
      console.log("Analysis result:", result);
      
      setProgress(100);
      
      toast({
        title: "Analysis Complete",
        description: (
          <div className="space-y-2">
            <p className="font-medium">
              Result: <span className={result.result === "Normal" ? "text-green-600" : "text-red-600"}>
                {result.result}
              </span>
            </p>
            <p>Confidence: {(result.confidence * 100).toFixed(1)}%</p>
            {result.explanation && (
              <p className="text-sm text-gray-600">{result.explanation}</p>
            )}
          </div>
        ),
        duration: 5000,
      });

      // Reset form only on success
      setSelectedImage(null);
      setPreviewUrl(null);
    } catch (error) {
      console.error("Analysis error:", error);
      toast({
        variant: "destructive",
        title: "Analysis Failed",
        description: error instanceof Error 
          ? error.message 
          : "Failed to analyze image. Please try again.",
        duration: 5000,
      });
    } finally {
      setIsUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 p-6">
      <div className="grid grid-cols-2 gap-6">
        <Button
          variant="outline"
          size="lg"
          className="h-24 flex flex-col items-center justify-center gap-2"
          onClick={() => document.getElementById("file-upload")?.click()}
          disabled={isUploading}
        >
          <Upload className="h-6 w-6" />
          <span>Upload Image</span>
        </Button>

        <Button
          variant="outline"
          size="lg"
          className="h-24 flex flex-col items-center justify-center gap-2"
          onClick={handleCameraCapture}
          disabled={isUploading}
        >
          <Camera className="h-6 w-6" />
          <span>Take Photo</span>
        </Button>
      </div>

      <input
        id="file-upload"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImageSelect(file);
        }}
      />
      
      {showCamera && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-2xl w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Take a Photo</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFrontCamera(!isFrontCamera)}
                className="md:hidden" // Only show on mobile
              >
                {isFrontCamera ? 'Use Back Camera' : 'Use Front Camera'}
              </Button>
            </div>

            {availableCameras.length > 1 && (
              <select
                className="w-full p-2 mb-4 border rounded-md dark:bg-gray-800 dark:border-gray-700"
                value={selectedCamera}
                onChange={(e) => setSelectedCamera(e.target.value)}
              >
                {availableCameras.map((camera) => (
                  <option key={camera.deviceId} value={camera.deviceId}>
                    {camera.label || `Camera ${camera.deviceId.slice(0, 5)}...`}
                  </option>
                ))}
              </select>
            )}

            <div className="aspect-video relative rounded-lg overflow-hidden bg-gray-100 mb-4">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex justify-end gap-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowCamera(false);
                  if (streamRef.current) {
                    streamRef.current.getTracks().forEach(track => track.stop());
                  }
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleCapture}>
                <Camera className="w-4 h-4 mr-2" />
                Capture
              </Button>
            </div>
          </div>
        </div>
      )}

      {previewUrl && (
        <div className="space-y-6 bg-card p-6 rounded-lg border">
          <div className="aspect-video relative rounded-lg overflow-hidden border bg-background">
            <img
              src={previewUrl}
              alt="Preview"
              className="object-contain w-full h-full"
            />
          </div>
          
          <Button
            size="lg"
            className="w-full text-lg"
            onClick={handleAnalyze}
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Search className="mr-3 h-5 w-5" />
                Analyze Image
              </>
            )}
          </Button>
        </div>
      )}

      {isUploading && (
        <div className="space-y-3 bg-card p-4 rounded-lg border">
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-foreground text-center font-medium">
            {progress === 100 ? 'Analysis complete!' : 'Analyzing image...'}
          </p>
        </div>
      )}
    </div>
  );
}
