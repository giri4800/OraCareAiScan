import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Camera, Upload } from "lucide-react";

export default function ImageUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch("/api/analysis", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      toast({
        title: "Success",
        description: "Image uploaded and analyzed successfully",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: (error as Error).message,
      });
    } finally {
      setIsUploading(false);
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
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Button
          onClick={() => document.getElementById("file-upload")?.click()}
          disabled={isUploading}
        >
          <Upload className="mr-2 h-4 w-4" />
          Upload Image
        </Button>
        
        <Button onClick={handleCapture} disabled={isUploading}>
          <Camera className="mr-2 h-4 w-4" />
          Use Camera
        </Button>
      </div>

      <input
        id="file-upload"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file);
        }}
      />

      {isUploading && (
        <div className="space-y-2">
          <Progress value={progress} />
          <p className="text-sm text-gray-500 text-center">
            Uploading and analyzing...
          </p>
        </div>
      )}
    </div>
  );
}
