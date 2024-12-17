import { Switch, Route } from "wouter";
import { Home } from "@/pages/Home";
import { Auth } from "@/pages/Auth";
import { Dashboard } from "@/pages/Dashboard";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/auth" component={Auth} />
        <Route path="/dashboard" component={Dashboard} />
      </Switch>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
