import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { auth } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import ImageUpload from "@/components/ImageUpload";
import ResultCard from "@/components/ResultCard";
import Navigation from "@/components/Navigation";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";

interface Analysis {
  id: string;
  imageUrl: string;
  result: string;
  confidence: number;
  timestamp: Date;
}

export function Dashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        setLocation("/auth");
      }
    });
    
    return () => unsubscribe();
  }, [setLocation]);

  const { data: analysisHistory, isLoading } = useQuery<Analysis[]>({
    queryKey: ["/api/analysis/history"],
  });

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <Card>
              <CardContent className="pt-6">
                <h2 className="text-2xl font-bold mb-4">Upload Image</h2>
                <ImageUpload />
              </CardContent>
            </Card>
          </div>

          <div>
            <h2 className="text-2xl font-bold mb-4">Analysis History</h2>
            <div className="space-y-4">
              {isLoading ? (
                <p>Loading history...</p>
              ) : analysisHistory?.map((analysis) => (
                <ResultCard key={analysis.id} analysis={analysis} />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
