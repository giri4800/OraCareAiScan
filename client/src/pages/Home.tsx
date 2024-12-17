import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-6">
            Early Oral Cancer Detection Using AI
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            Upload or capture images of oral conditions for instant AI-powered analysis
            and early detection of potential concerns.
          </p>
          
          <div className="flex gap-4 justify-center">
            <Link href="/auth">
              <Button size="lg" className="bg-primary hover:bg-primary/90">
                Get Started
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-2">Early Detection</h3>
                <p className="text-gray-600">
                  AI-powered analysis helps identify potential signs of oral cancer in early stages
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-2">Instant Results</h3>
                <p className="text-gray-600">
                  Get analysis results within seconds of uploading your images
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-2">Secure & Private</h3>
                <p className="text-gray-600">
                  Your data is encrypted and handled with strict medical privacy standards
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
