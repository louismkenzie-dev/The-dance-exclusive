import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { FadeRise, Stagger } from "@/components/motion";
import { Building2, GraduationCap, ChevronRight, Menu } from "lucide-react";

const settingsSections = [
  {
    title: "Company information",
    description: "Branding, business details, contact information, and social media",
    icon: Building2,
    path: "/admin/settings/company",
  },
  {
    title: "Term dates & holidays",
    description: "School terms, school holidays, and UK bank holidays",
    icon: GraduationCap,
    path: "/admin/settings/term-dates",
  },
  {
    title: "Menu navigation",
    description: "Customise the sidebar order, grouping, and dropdown menus",
    icon: Menu,
    path: "/admin/settings/navigation",
  },
];

const AdminSettings = () => {
  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-8">
      <FadeRise>
        <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your business configuration</p>
      </FadeRise>

      <Stagger className="grid gap-4">
        {settingsSections.map((section) => (
          <Link key={section.path} to={section.path} className="group block">
            <Card className="flex items-center gap-4 p-5 transition-all duration-300 ease-out group-hover:-translate-y-0.5 group-hover:shadow-soft-lg">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                <section.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display font-semibold">{section.title}</p>
                <p className="text-sm text-muted-foreground">{section.description}</p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground/60 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-foreground" />
            </Card>
          </Link>
        ))}
      </Stagger>
    </div>
  );
};

export default AdminSettings;
