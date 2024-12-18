import { useState, useRef } from "react";
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

  const startCamera = async () => {
    try {
      console.log("Requesting camera access");
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      console.log("Camera access granted");

      const video = videoRef.current;
      if (!video) {
        console.error("Video element not found");
        return;
      }

      video.srcObject = stream;
      video.onloadedmetadata = () => {
        console.log("Video metadata loaded");
        video.play().catch(e => console.error("Play failed:", e));
      };
      setIsCameraActive(true);
    } catch (error) {
      console.error("Camera access error:", error);
      toast({
        variant: "destructive",
        title: "Camera Error",
        description: "Could not access camera"
      });
    }
  };

  const stopCamera = () => {
    const video = videoRef.current;
    if (video && video.srcObject) {
      const stream = video.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      video.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const captureImage = () => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) return;
      const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
      handleImageSelect(file);
      stopCamera();
    }, 'image/jpeg');
  };

  const handleAnalyze = async () => {
    if (!selectedImage) {
      toast({
        variant: "destructive",
        title: "No Image",
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
        description: result.message
      });

      setSelectedImage(null);
      setPreviewUrl(null);
    } catch (error) {
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
    <div className="w-full max-w-2xl mx-auto p-6 space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Button
          variant="outline"
          onClick={() => document.getElementById('file-upload')?.click()}
          disabled={isUploading || isCameraActive}
          className="h-24"
        >
          <Upload className="h-6 w-6 mr-2" />
          Upload Image
        </Button>

        <Button
          variant="outline"
          onClick={isCameraActive ? stopCamera : startCamera}
          disabled={isUploading}
          className="h-24"
        >
          <Camera className="h-6 w-6 mr-2" />
          {isCameraActive ? 'Stop Camera' : 'Use Camera'}
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
        <div className="relative bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            className="w-full aspect-video object-cover"
            autoPlay
            playsInline
            muted
          />
          <Button
            className="absolute bottom-4 left-1/2 transform -translate-x-1/2"
            onClick={captureImage}
          >
            <Camera className="h-5 w-5 mr-2" />
            Capture
          </Button>
        </div>
      )}

      {previewUrl && !isCameraActive && (
        <div className="space-y-4">
          <div className="rounded-lg overflow-hidden bg-gray-100">
            <img
              src={previewUrl}
              alt="Preview"
              className="w-full aspect-video object-contain"
            />
          </div>

          <Button 
            className="w-full"
            onClick={handleAnalyze}
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Search className="h-5 w-5 mr-2" />
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
