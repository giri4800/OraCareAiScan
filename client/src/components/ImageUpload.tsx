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
      console.log("Requesting camera access...");
      
      // Check if mediaDevices is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API is not supported in this browser");
      }

      // Try to get the list of available cameras first
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      console.log("Available cameras:", videoDevices);

      if (videoDevices.length === 0) {
        throw new Error("No camera devices found");
      }

      // Try environment camera first, fall back to any available camera
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
      } catch (envError) {
        console.log("Falling back to default camera:", envError);
        stream = await navigator.mediaDevices.getUserMedia({
          video: true
        });
      }

      if (!videoRef.current) {
        throw new Error("Video element not found");
      }

      console.log("Camera stream obtained with constraints:", stream.getVideoTracks()[0].getConstraints());

      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        if (!videoRef.current) return;
        videoRef.current.play().catch(e => {
          console.error("Error playing video:", e);
          toast({
            variant: "destructive",
            title: "Camera Error",
            description: "Failed to start video preview. Please try again.",
          });
        });
      };
      
      streamRef.current = stream;
      setIsCameraActive(true);
      
      console.log("Camera initialized successfully");
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
          <div className="aspect-video relative rounded-lg overflow-hidden border bg-background">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ maxWidth: '100%', maxHeight: '100%' }}
            />
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
