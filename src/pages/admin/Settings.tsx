import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, GraduationCap, ChevronRight, Settings as SettingsIcon, Menu } from "lucide-react";

const settingsSections = [
  {
    title: "Company Information",
    description: "Branding, business details, contact information, and social media",
    icon: Building2,
    path: "/admin/settings/company",
  },
  {
    title: "Term Dates & Holidays",
    description: "School terms, school holidays, and UK bank holidays",
    icon: GraduationCap,
    path: "/admin/settings/term-dates",
  },
  {
    title: "Menu Navigation",
    description: "Customise the sidebar order, grouping, and dropdown menus",
    icon: Menu,
    path: "/admin/settings/navigation",
  },
];

const AdminSettings = () => {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <SettingsIcon className="h-6 w-6" />
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your business configuration</p>
      </div>

      <div className="grid gap-4">
        {settingsSections.map((section) => (
          <Link key={section.path} to={section.path}>
            <Card className="hover:bg-muted/50 transition-colors cursor-pointer group">
              <CardHeader className="flex flex-row items-center gap-4 py-5">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <section.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base">{section.title}</CardTitle>
                  <CardDescription className="text-sm">{section.description}</CardDescription>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default AdminSettings;
