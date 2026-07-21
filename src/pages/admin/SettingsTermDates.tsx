import { Link } from "react-router-dom";
import { SchoolTermsManager } from "@/components/admin/settings/SchoolTermsManager";
import { Button } from "@/components/ui/button";
import { FadeRise } from "@/components/motion";
import { ArrowLeft } from "lucide-react";

const SettingsTermDates = () => {
  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <FadeRise>
        <div className="flex items-center gap-3">
          <Link to="/admin/settings">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">Term dates & holidays</h1>
            <p className="text-muted-foreground mt-1">School terms, school holidays, and UK bank holidays</p>
          </div>
        </div>
      </FadeRise>

      <SchoolTermsManager />
    </div>
  );
};

export default SettingsTermDates;
