import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="mb-4 font-mono text-4xl font-bold text-foreground">404</h1>
        <p className="mb-6 font-mono text-lg text-muted-foreground">Page not found</p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-4 py-2 font-mono text-sm text-primary hover:bg-primary/10"
        >
          Return to Home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
