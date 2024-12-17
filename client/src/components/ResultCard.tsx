import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { formatDistance } from "date-fns";

interface Analysis {
  id: string;
  imageUrl: string;
  result: string;
  confidence: number;
  timestamp: Date;
}

interface ResultCardProps {
  analysis: Analysis;
}

export default function ResultCard({ analysis }: ResultCardProps) {
  const handleDelete = async () => {
    try {
      await fetch(`/api/analysis/${analysis.id}`, {
        method: "DELETE",
      });
    } catch (error) {
      console.error("Failed to delete analysis:", error);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between p-4">
        <div className="text-sm text-gray-500">
          {formatDistance(new Date(analysis.timestamp), new Date(), {
            addSuffix: true,
          })}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="aspect-video relative mb-4">
          <img
            src={analysis.imageUrl}
            alt="Analysis"
            className="rounded-md object-cover w-full h-full"
          />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="font-medium">Analysis Result:</span>
            <span className={analysis.result === "Normal" ? "text-green-600" : "text-red-600"}>
              {analysis.result}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-medium">Confidence:</span>
            <span>{(analysis.confidence * 100).toFixed(1)}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
