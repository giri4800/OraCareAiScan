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

  const handleCameraCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setShowCamera(true);
    } catch (error) {
      console.error('Camera access error:', error);
      toast({
        variant: "destructive",
        title: "Camera Error",
        description: "Failed to access camera. Please check permissions.",
      });
    }
  };

  const handleCapture = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
        handleImageSelect(file);
      }
      setShowCamera(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    }, 'image/jpeg', 0.8);
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
            <h3 className="text-lg font-semibold mb-4">Take a Photo</h3>
            <div className="aspect-video relative rounded-lg overflow-hidden bg-gray-100 mb-4">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex justify-end gap-4">
              <Button variant="outline" onClick={() => setShowCamera(false)}>
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
