import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { logOut } from "@/lib/firebase";

export default function Navigation() {
  const [, setLocation] = useLocation();

  const handleLogout = async () => {
    await logOut();
    setLocation("/");
  };

  return (
    <nav className="border-b bg-background">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-primary">
          Oral Cancer Detection
        </h1>
        
        <Button variant="ghost" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </nav>
  );
}
