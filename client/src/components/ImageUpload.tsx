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
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();

  const handleImageSelect = (file: File) => {
    setSelectedImage(file);
    const imageUrl = URL.createObjectURL(file);
    setPreviewUrl(imageUrl);
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      // Create video element if needed
      if (!videoRef.current) {
        console.error("Video element not initialized");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true
      });

      // Attach stream to video element
      videoRef.current.srcObject = stream;
      videoRef.current.play();
      setIsCameraActive(true);
    } catch (error) {
      console.error('Camera error:', error);
      toast({
        variant: "destructive",
        title: "Camera Error",
        description: "Failed to access camera"
      });
    }
  };

  const captureImage = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) return;
      const file = new File([blob], "captured-image.jpg", { type: "image/jpeg" });
      handleImageSelect(file);
      stopCamera();
    }, 'image/jpeg', 0.8);
  };

  const handleAnalyze = async () => {
    if (!selectedImage) {
      toast({
        variant: "destructive",
        title: "No Image Selected",
        description: "Please select or capture an image first"
      });
      return;
    }

    setIsUploading(true);
    setProgress(25);

    try {
      const formData = new FormData();
      formData.append("image", selectedImage);

      const response = await fetch("/api/analysis", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      setProgress(100);
      const result = await response.json();

      toast({
        title: "Analysis Complete",
        description: `Result: ${result.message}`,
      });

      setSelectedImage(null);
      setPreviewUrl(null);
    } catch (error) {
      console.error("Analysis error:", error);
      toast({
        variant: "destructive",
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Failed to analyze image"
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
          <Camera className="h-6 w-6" />
          <span>{isCameraActive ? 'Stop Camera' : 'Use Camera'}</span>
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
        <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />
          <Button
            size="lg"
            className="absolute bottom-4 left-1/2 transform -translate-x-1/2"
            onClick={captureImage}
          >
            <Camera className="mr-2 h-5 w-5" />
            Capture Image
          </Button>
        </div>
      )}

      {previewUrl && !isCameraActive && (
        <div className="space-y-4">
          <div className="aspect-video relative rounded-lg overflow-hidden bg-gray-100">
            <img
              src={previewUrl}
              alt="Preview"
              className="w-full h-full object-contain"
            />
          </div>

          <Button
            size="lg"
            className="w-full"
            onClick={handleAnalyze}
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Search className="mr-2 h-5 w-5" />
                Analyze Image
              </>
            )}
          </Button>
        </div>
      )}

      {isUploading && (
        <Progress value={progress} className="h-2" />
      )}
    </div>
  );
}