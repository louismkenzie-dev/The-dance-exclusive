import { Link } from "react-router-dom";
import { SchoolTermsManager } from "@/components/admin/settings/SchoolTermsManager";
import { Button } from "@/components/ui/button";
import { ArrowLeft, GraduationCap } from "lucide-react";

const SettingsTermDates = () => {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/admin/settings">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <GraduationCap className="h-6 w-6" />
            Term Dates & Holidays
          </h1>
          <p className="text-sm text-muted-foreground mt-1">School terms, school holidays, and UK bank holidays</p>
        </div>
      </div>

      <SchoolTermsManager />
    </div>
  );
};

export default SettingsTermDates;
