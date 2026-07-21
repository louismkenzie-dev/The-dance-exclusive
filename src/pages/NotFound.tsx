import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AmbientGlow, FadeRise } from "@/components/motion";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6 py-16">
      <AmbientGlow variant="duo" />
      <FadeRise className="relative z-10 mx-auto max-w-xl text-center">
        <h1 className="font-display text-8xl font-extrabold tracking-tight text-foreground md:text-9xl">
          404
        </h1>
        <p className="mt-6 font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          Oops! Page not{" "}
          <em className="font-serif italic font-normal text-primary">found</em>
        </p>
        <p className="mt-2 text-muted-foreground">
          The page you're looking for doesn't exist or may have moved.
        </p>
        <div className="mt-8 flex justify-center">
          <Button asChild size="lg">
            <a href="/">
              <Home />
              Return to home
            </a>
          </Button>
        </div>
      </FadeRise>
    </div>
  );
};

export default NotFound;
