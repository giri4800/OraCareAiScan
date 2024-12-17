import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Camera, Upload, Search, Loader2 } from "lucide-react";
import { auth } from "@/lib/firebase";

export default function ImageUpload() {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const handleImageSelect = (file: File) => {
    setSelectedImage(file);
    const imageUrl = URL.createObjectURL(file);
    setPreviewUrl(imageUrl);
  };

  const handleAnalyze = async () => {
    if (!selectedImage) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select an image first",
      });
      return;
    }
    
    setIsUploading(true);
    setProgress(0);

    try {
      console.log("Starting image analysis...");
      const formData = new FormData();
      formData.append("image", selectedImage);

      const response = await fetch("/api/analysis", {
        method: "POST",
        body: formData,
      });

      console.log("Response status:", response.status);
      const responseText = await response.text();
      console.log("Response text:", responseText);

      if (!response.ok) {
        throw new Error(responseText || "Analysis failed");
      }

      const result = JSON.parse(responseText);
      console.log("Analysis result:", result);
      
      toast({
        title: "Analysis Complete",
        description: `Result: ${result.result} (${(parseFloat(result.confidence) * 100).toFixed(1)}% confidence)`,
      });

      // Reset the form
      setSelectedImage(null);
      setPreviewUrl(null);
    } catch (error) {
      console.error("Analysis error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to analyze image",
      });
    } finally {
      setIsUploading(false);
      setProgress(100);
    }
  };

  const handleCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // Implementation for camera capture would go here
      stream.getTracks().forEach(track => track.stop());
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not access camera",
      });
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
          onClick={handleCapture}
          disabled={isUploading}
        >
          <Camera className="h-6 w-6" />
          <span>Use Camera</span>
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

      {previewUrl && (
        <div className="space-y-6 bg-card p-6 rounded-lg border">
          <div className="aspect-[4/3] relative rounded-lg overflow-hidden border bg-background">
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
