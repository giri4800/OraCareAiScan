import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Camera, Upload, Search, Loader2, X } from "lucide-react";

export default function ImageUpload() {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { toast } = useToast();

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleImageSelect = (file: File) => {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast({
        variant: "destructive",
        title: "Invalid File Type",
        description: `Supported formats: ${validTypes.join(", ")}`,
      });
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
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

  const startCamera = async () => {
    try {
      console.log("Starting camera initialization process...");
      
      // Check if mediaDevices is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API is not supported in this browser");
      }

      // Verify video element exists before proceeding
      if (!videoRef.current) {
        throw new Error("Video element not found");
      }

      try {
        // Request camera permissions first
        console.log("Requesting initial camera permissions...");
        await navigator.mediaDevices.getUserMedia({ video: true });
        console.log("Camera permission granted");
      } catch (permissionError) {
        console.error("Permission error:", permissionError);
        throw new Error(
          permissionError instanceof Error 
            ? permissionError.message 
            : "Failed to get camera permissions"
        );
      }

      // Try to get the list of available cameras
      let videoDevices: MediaDeviceInfo[] = [];
      try {
        console.log("Enumerating available cameras...");
        const devices = await navigator.mediaDevices.enumerateDevices();
        videoDevices = devices.filter(device => device.kind === 'videoinput');
        console.log("Available cameras:", videoDevices.map(device => ({
          deviceId: device.deviceId,
          label: device.label || 'Unnamed Camera',
          groupId: device.groupId
        })));
      } catch (enumError) {
        console.error("Error enumerating devices:", enumError);
        throw new Error("Failed to detect available cameras");
      }

      if (videoDevices.length === 0) {
        throw new Error("No camera devices found. Please ensure your external camera is properly connected.");
      }

      // Stop any existing streams
      if (streamRef.current) {
        console.log("Stopping existing stream...");
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // Clear existing video source
      if (videoRef.current.srcObject) {
        console.log("Clearing existing video source...");
        const oldStream = videoRef.current.srcObject as MediaStream;
        oldStream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }

      // Initialize camera stream with progressive fallbacks
      let stream: MediaStream;
      try {
        console.log("Starting camera initialization sequence...");
        const primaryDevice = videoDevices[0];
        
        // Try first with exact deviceId and constraints
        try {
          console.log("Attempting to initialize camera with exact constraints:", {
            deviceId: primaryDevice.deviceId,
            label: primaryDevice.label || 'Unnamed Camera'
          });
          
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: { exact: primaryDevice.deviceId },
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30 }
            }
          });
          console.log("Successfully initialized camera with exact constraints");
        } catch (exactError) {
          console.warn("Failed with exact constraints:", exactError);
          
          // Try with ideal constraints
          try {
            console.log("Attempting with ideal constraints...");
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                deviceId: { ideal: primaryDevice.deviceId },
                width: { ideal: 1280 },
                height: { ideal: 720 }
              }
            });
            console.log("Successfully initialized camera with ideal constraints");
          } catch (idealError) {
            console.warn("Failed with ideal constraints:", idealError);
            
            // Final fallback to basic video capture
            console.log("Attempting basic video capture...");
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                width: { ideal: 640 },
                height: { ideal: 480 }
              }
            });
            console.log("Successfully initialized camera with basic settings");
          }
        }
      } catch (streamError) {
        console.error("All camera initialization attempts failed:", streamError);
        throw new Error(
          streamError instanceof Error 
            ? `Failed to initialize camera: ${streamError.message}`
            : "Failed to initialize camera stream"
        );
      }

      // Ensure video tracks are active
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack || !videoTrack.enabled) {
        throw new Error("No active video track found in stream");
      }

      console.log("Camera stream obtained:", {
        constraints: videoTrack.getConstraints(),
        settings: videoTrack.getSettings()
      });

      // Set up video element
      videoRef.current.autoplay = true;
      videoRef.current.playsInline = true;
      videoRef.current.muted = true;

      // Assign stream to video element
      videoRef.current.srcObject = stream;
      
      // Set up metadata and play handlers
      const playVideo = async () => {
        if (!videoRef.current) return;
        
        try {
          await videoRef.current.play();
          console.log("Video playing successfully:", {
            readyState: videoRef.current.readyState,
            paused: videoRef.current.paused,
            videoWidth: videoRef.current.videoWidth,
            videoHeight: videoRef.current.videoHeight
          });
          setIsCameraActive(true);
        } catch (error) {
          console.error("Error playing video:", error);
          toast({
            variant: "destructive",
            title: "Camera Error",
            description: "Failed to start video preview. Please try again.",
          });
        }
      };

      videoRef.current.onloadedmetadata = playVideo;
      
      // Store stream reference
      streamRef.current = stream;
    } catch (error) {
      console.error('Camera access error:', error);
      
      let errorMessage = "Failed to access camera. ";
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          errorMessage += "Please grant camera permissions in your browser settings.";
        } else if (error.name === 'NotFoundError') {
          errorMessage += "No camera device was found on your device.";
        } else if (error.name === 'NotSupportedError') {
          errorMessage += "Your browser doesn't support camera access.";
        } else if (error.message === "Camera API is not supported in this browser") {
          errorMessage = error.message;
        } else {
          errorMessage += "Please check your camera connection and try again.";
        }
      }

      toast({
        variant: "destructive",
        title: "Camera Error",
        description: errorMessage,
        duration: 5000,
      });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setIsCameraActive(false);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      console.log("Camera stopped");
    }
  };

  const captureImage = () => {
    if (!videoRef.current) {
      console.error("Video element not found");
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error("Failed to get canvas context");
      }
      
      ctx.drawImage(videoRef.current, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) {
          throw new Error("Failed to create image blob");
        }
        
        const file = new File([blob], "captured-image.jpg", { type: "image/jpeg" });
        handleImageSelect(file);
        stopCamera();
      }, 'image/jpeg', 0.8);
    } catch (error) {
      console.error("Image capture error:", error);
      toast({
        variant: "destructive",
        title: "Capture Error",
        description: "Failed to capture image. Please try again.",
      });
    }
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
          disabled={isUploading || isCameraActive}
        >
          <Upload className="h-6 w-6" />
          <span>Upload Image</span>
        </Button>

        <Button
          variant="outline"
          size="lg"
          className="h-24 flex flex-col items-center justify-center gap-2"
          onClick={isCameraActive ? stopCamera : startCamera}
          disabled={isUploading}
        >
          {isCameraActive ? (
            <>
              <X className="h-6 w-6" />
              <span>Stop Camera</span>
            </>
          ) : (
            <>
              <Camera className="h-6 w-6" />
              <span>Use Camera</span>
            </>
          )}
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

      {isCameraActive && (
        <div className="space-y-4 bg-card p-6 rounded-lg border">
          <div className="aspect-video relative rounded-lg overflow-hidden border bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-contain"
              style={{ 
                minWidth: '100%', 
                minHeight: '100%',
                backgroundColor: 'black'
              }}
              width={1280}
              height={720}
            />
            <div className={`absolute inset-0 flex flex-col items-center justify-center text-white transition-opacity duration-300 ${isCameraActive ? 'opacity-0' : 'opacity-100'}`}>
              <div className="bg-black/50 p-4 rounded-lg text-center max-w-md">
                <div className="animate-spin h-8 w-8 border-4 border-white border-t-transparent rounded-full mx-auto mb-2"></div>
                <p className="text-lg font-semibold mb-2">Initializing camera...</p>
                <div className="space-y-2 text-sm">
                  <p>Please check:</p>
                  <ul className="list-disc list-inside text-left space-y-1">
                    <li>External camera is properly connected</li>
                    <li>Camera permissions are granted in browser</li>
                    <li>No other applications are using the camera</li>
                  </ul>
                  <p className="text-xs opacity-75 mt-2">
                    If issues persist, try disconnecting and reconnecting your camera
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Button
              size="lg"
              className="w-full"
              onClick={captureImage}
            >
              <Camera className="mr-2 h-5 w-5" />
              Capture Image
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              Make sure you're in a well-lit area and the camera is focused
            </p>
          </div>
        </div>
      )}

      {previewUrl && !isCameraActive && (
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
