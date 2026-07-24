import { useRef, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { BrandLogoLibrary } from "@/components/admin/settings/BrandLogoLibrary";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useAutosave } from "@/hooks/useAutosave";
import { Link } from "react-router-dom";
import {
  Loader2, Palette, Building2, Upload, X, Globe, MapPin, Phone, Mail,
  FileText, Hash, CreditCard, Users, AtSign, ArrowLeft
} from "lucide-react";

const BRANDING_KEYS = [
  "business_name", "primary_color", "secondary_color", "accent_color", "logo_url", "favicon_url",
];

const BUSINESS_KEYS = [
  "registered_address", "trading_address", "website_url", "company_number",
  "vat_number", "not_vat_registered", "phone_number", "email_address",
  "support_email", "legal_entity_name", "trading_name", "industry_sector",
  "fulltime_employees", "parttime_employees",
  "social_facebook", "social_instagram", "social_twitter", "social_linkedin", "social_tiktok",
];

/** Studio-written note included word-for-word in the day-before trial
 *  reminder email. Stored in app_settings; autosaves as the admin types. */
const TrialReminderCard = () => {
  const [message, setMessage] = useState("");
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "trial_reminder_message")
        .maybeSingle();
      setMessage(data?.value ?? "");
      setLoadedKey("loaded");
    })();
  }, []);

  const autosave = useAutosave({
    enabled: loadedKey != null,
    resetKey: loadedKey,
    data: { message },
    save: async () => {
      const { error } = await supabase
        .from("app_settings")
        .upsert(
          { key: "trial_reminder_message", value: message, updated_at: new Date().toISOString() },
          { onConflict: "key" },
        );
      if (error) throw error;
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" />Trial Reminder Email</CardTitle>
        <CardDescription>
          Sent automatically the day before every booked trial, with the class name, time and
          venue. Your note below is included word-for-word.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Textarea
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="e.g. Please arrive 10 minutes early, wear comfy clothes and bring a bottle of water!"
        />
        <p className="text-xs text-muted-foreground">
          {autosave.status === "saving" || autosave.status === "pending"
            ? "Saving…"
            : autosave.status === "error"
              ? "Couldn't save — check your connection"
              : autosave.status === "saved"
                ? "All changes saved"
                : "Changes save automatically as you type"}
        </p>
      </CardContent>
    </Card>
  );
};

const SettingsCompany = () => {
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();

  const [businessName, setBusinessName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#0a0f1a");
  const [secondaryColor, setSecondaryColor] = useState("#5ab3e8");
  const [accentColor, setAccentColor] = useState("#e91e8c");
  const [logoUrl, setLogoUrl] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);

  const [registeredAddress, setRegisteredAddress] = useState("");
  const [tradingAddress, setTradingAddress] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [companyNumber, setCompanyNumber] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [notVatRegistered, setNotVatRegistered] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [legalEntityName, setLegalEntityName] = useState("");
  const [tradingName, setTradingName] = useState("");
  const [industrySector, setIndustrySector] = useState("");
  const [fulltimeEmployees, setFulltimeEmployees] = useState("");
  const [parttimeEmployees, setParttimeEmployees] = useState("");
  const [socialFacebook, setSocialFacebook] = useState("");
  const [socialInstagram, setSocialInstagram] = useState("");
  const [socialTwitter, setSocialTwitter] = useState("");
  const [socialLinkedin, setSocialLinkedin] = useState("");
  const [socialTiktok, setSocialTiktok] = useState("");
  // Fields hydrate from the server exactly once — later refetches must not
  // overwrite what the admin is typing mid-autosave.
  const [hydrated, setHydrated] = useState(false);
  const manualSaveRef = useRef(false);

  const { data: allSettings, isLoading } = useQuery({
    queryKey: ["admin-settings", user?.id],
    enabled: !authLoading && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .in("key", [...BRANDING_KEYS, ...BUSINESS_KEYS]);
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (allSettings && !hydrated) {
      const v = (key: string) => allSettings.find((s: any) => s.key === key)?.value || "";
      setBusinessName(v("business_name"));
      setPrimaryColor(v("primary_color") || "#0a0f1a");
      setSecondaryColor(v("secondary_color") || "#5ab3e8");
      setAccentColor(v("accent_color") || "#e91e8c");
      setLogoUrl(v("logo_url"));
      setFaviconUrl(v("favicon_url"));
      setRegisteredAddress(v("registered_address"));
      setTradingAddress(v("trading_address"));
      setWebsiteUrl(v("website_url"));
      setCompanyNumber(v("company_number"));
      setVatNumber(v("vat_number"));
      setNotVatRegistered(v("not_vat_registered") === "true");
      setPhoneNumber(v("phone_number"));
      setEmailAddress(v("email_address"));
      setSupportEmail(v("support_email"));
      setLegalEntityName(v("legal_entity_name"));
      setTradingName(v("trading_name"));
      setIndustrySector(v("industry_sector"));
      setFulltimeEmployees(v("fulltime_employees"));
      setParttimeEmployees(v("parttime_employees"));
      setSocialFacebook(v("social_facebook"));
      setSocialInstagram(v("social_instagram"));
      setSocialTwitter(v("social_twitter"));
      setSocialLinkedin(v("social_linkedin"));
      setSocialTiktok(v("social_tiktok"));
      setHydrated(true);
    }
  }, [allSettings, hydrated]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (authLoading || !user) {
        throw new Error("Authentication is still loading. Please wait a moment and try again.");
      }

      const settings = [
        { key: "business_name", value: businessName, description: "Business name" },
        { key: "primary_color", value: primaryColor, description: "Primary brand color" },
        { key: "secondary_color", value: secondaryColor, description: "Secondary brand color" },
        { key: "accent_color", value: accentColor, description: "Accent brand color" },
        { key: "logo_url", value: logoUrl, description: "Main logo URL" },
        { key: "favicon_url", value: faviconUrl, description: "Favicon URL" },
        { key: "registered_address", value: registeredAddress, description: "Registered address" },
        { key: "trading_address", value: tradingAddress, description: "Trading address" },
        { key: "website_url", value: websiteUrl, description: "Website URL" },
        { key: "company_number", value: companyNumber, description: "Company number" },
        { key: "vat_number", value: vatNumber, description: "VAT number" },
        { key: "not_vat_registered", value: notVatRegistered ? "true" : "false", description: "Not VAT registered flag" },
        { key: "phone_number", value: phoneNumber, description: "Phone number" },
        { key: "email_address", value: emailAddress, description: "Email address" },
        { key: "support_email", value: supportEmail, description: "Support email" },
        { key: "legal_entity_name", value: legalEntityName, description: "Legal entity name" },
        { key: "trading_name", value: tradingName, description: "Trading name" },
        { key: "industry_sector", value: industrySector, description: "Industry sector" },
        { key: "fulltime_employees", value: fulltimeEmployees, description: "Full-time employees" },
        { key: "parttime_employees", value: parttimeEmployees, description: "Part-time employees" },
        { key: "social_facebook", value: socialFacebook, description: "Facebook URL" },
        { key: "social_instagram", value: socialInstagram, description: "Instagram URL" },
        { key: "social_twitter", value: socialTwitter, description: "Twitter/X URL" },
        { key: "social_linkedin", value: socialLinkedin, description: "LinkedIn URL" },
        { key: "social_tiktok", value: socialTiktok, description: "TikTok URL" },
      ];

      for (const setting of settings) {
        const { error, data } = await supabase
          .from("app_settings")
          .upsert(
            { key: setting.key, value: setting.value, description: setting.description },
            { onConflict: "key" }
          )
          .select();

        if (error) {
          throw new Error(`${setting.key}: ${error.message}`);
        }

        if (!data || data.length === 0) {
          throw new Error(`${setting.key}: save was blocked`);
        }
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      if (manualSaveRef.current) toast.success("Settings saved successfully");
      manualSaveRef.current = false;
    },
    onError: (error: any) => {
      toast.error("Failed to save: " + error.message);
    },
  });

  // Word-Online-style autosave: settings persist moments after typing stops.
  const autosave = useAutosave({
    enabled: hydrated && !!user,
    resetKey: hydrated ? "company-settings" : null,
    data: {
      businessName, primaryColor, secondaryColor, accentColor, logoUrl, faviconUrl,
      registeredAddress, tradingAddress, websiteUrl, companyNumber, vatNumber,
      notVatRegistered, phoneNumber, emailAddress, supportEmail, legalEntityName,
      tradingName, industrySector, fulltimeEmployees, parttimeEmployees,
      socialFacebook, socialInstagram, socialTwitter, socialLinkedin, socialTiktok,
    },
    save: () => saveMutation.mutateAsync(),
  });

  const handleFileUpload = async (
    file: File,
    folder: string,
    onSuccess: (url: string) => void,
    setLoading: (v: boolean) => void,
    maxSize = 5
  ) => {
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image file"); return; }
    if (file.size > maxSize * 1024 * 1024) { toast.error(`File must be less than ${maxSize}MB`); return; }
    setLoading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${folder}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("branding").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("branding").getPublicUrl(path);
      onSuccess(data.publicUrl);
      toast.success("Uploaded successfully");
    } catch (err: any) {
      toast.error("Upload failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="p-4 md:p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/admin/settings">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <Building2 className="h-6 w-6" />
              Company Information
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Branding, business details, and contact information</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {autosave.status === "saving" || autosave.status === "pending"
              ? "Saving…"
              : autosave.status === "error"
                ? "Couldn't save — check values"
                : autosave.status === "saved"
                  ? "All changes saved"
                  : "Autosave on"}
          </span>
          <Button onClick={() => { manualSaveRef.current = true; saveMutation.mutate(); }} disabled={saveMutation.isPending} size="lg">
            {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save All Settings
          </Button>
        </div>
      </div>

      {/* Branding Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Branding
          </CardTitle>
          <CardDescription>Configure your business name, logo, and brand colours</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="businessName">Business Name</Label>
            <Input id="businessName" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="The Dance Exclusive" />
          </div>

          {/* Logo */}
          <div className="space-y-2">
            <Label>Business Logo</Label>
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-lg border bg-muted flex items-center justify-center overflow-hidden">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" />
                ) : (
                  <div className="text-xs text-muted-foreground">No logo</div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="relative" disabled={uploading}>
                    {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    Upload Logo
                    <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], "logo", setLogoUrl, setUploading)} className="absolute inset-0 cursor-pointer opacity-0" disabled={uploading} />
                  </Button>
                  {logoUrl && <Button variant="ghost" size="sm" onClick={() => setLogoUrl("")}><X className="h-4 w-4" /></Button>}
                </div>
                <p className="text-xs text-muted-foreground">PNG or SVG, max 5MB</p>
              </div>
            </div>
          </div>

          {/* Favicon */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Globe className="h-4 w-4" />Website Favicon</Label>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-lg border bg-muted flex items-center justify-center overflow-hidden">
                {faviconUrl ? (
                  <img src={faviconUrl} alt="Favicon" className="h-full w-full object-contain p-2" />
                ) : (
                  <div className="text-[10px] text-muted-foreground">No icon</div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="relative" disabled={uploadingFavicon}>
                    {uploadingFavicon ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    Upload Favicon
                    <input type="file" accept=".png,.svg,image/png,image/svg+xml" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], "favicon", setFaviconUrl, setUploadingFavicon, 1)} className="absolute inset-0 cursor-pointer opacity-0" disabled={uploadingFavicon} />
                  </Button>
                  {faviconUrl && <Button variant="ghost" size="sm" onClick={() => setFaviconUrl("")}><X className="h-4 w-4" /></Button>}
                </div>
                <p className="text-xs text-muted-foreground">PNG or SVG, recommended 32×32 or 64×64px</p>
              </div>
            </div>
          </div>

          {/* Brand Colours */}
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "Primary Colour", value: primaryColor, set: setPrimaryColor },
              { label: "Secondary Colour", value: secondaryColor, set: setSecondaryColor },
              { label: "Accent Colour", value: accentColor, set: setAccentColor },
            ].map(({ label, value, set }) => (
              <div key={label} className="space-y-2">
                <Label className="flex items-center gap-2"><Palette className="h-4 w-4" />{label}</Label>
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-md border cursor-pointer shrink-0" style={{ backgroundColor: value }}>
                    <input type="color" value={value} onChange={(e) => set(e.target.value)} className="h-full w-full cursor-pointer opacity-0" />
                  </div>
                  <Input value={value} onChange={(e) => set(e.target.value)} className="font-mono" />
                </div>
              </div>
            ))}
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label>Preview</Label>
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded overflow-hidden bg-muted flex items-center justify-center">
                  {logoUrl ? <img src={logoUrl} alt="Preview" className="h-full w-full object-contain" /> : <span className="text-xs text-muted-foreground">Logo</span>}
                </div>
                <span className="font-semibold text-lg">{businessName || "Your Business Name"}</span>
              </div>
              <div className="flex gap-2">
                <div className="rounded px-4 py-2 text-white text-sm font-medium" style={{ backgroundColor: primaryColor }}>Primary</div>
                <div className="rounded px-4 py-2 text-white text-sm font-medium" style={{ backgroundColor: secondaryColor }}>Secondary</div>
                <div className="rounded px-4 py-2 text-white text-sm font-medium" style={{ backgroundColor: accentColor }}>Accent</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logo Library */}
      <BrandLogoLibrary />

      {/* Business Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />Business Details</CardTitle>
          <CardDescription>Company registration, contact information, and legal details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-sm font-medium mb-4 flex items-center gap-2"><FileText className="h-4 w-4" />Company Identity</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Legal Entity Name</Label>
                <Input value={legalEntityName} onChange={(e) => setLegalEntityName(e.target.value)} placeholder="The Dance Exclusive Ltd" />
              </div>
              <div className="space-y-2">
                <Label>Trading Name (if different)</Label>
                <Input value={tradingName} onChange={(e) => setTradingName(e.target.value)} placeholder="The Dance Exclusive" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Hash className="h-3 w-3" />Company Number</Label>
                <Input value={companyNumber} onChange={(e) => setCompanyNumber(e.target.value)} placeholder="12345678" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><CreditCard className="h-3 w-3" />VAT Number</Label>
                <Input value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} placeholder="GB123456789" disabled={notVatRegistered} />
                <div className="flex items-center space-x-2 mt-2">
                  <Checkbox id="notVatRegistered" checked={notVatRegistered} onCheckedChange={(checked) => { setNotVatRegistered(checked === true); if (checked) setVatNumber(""); }} />
                  <Label htmlFor="notVatRegistered" className="text-sm text-muted-foreground cursor-pointer">Not VAT registered</Label>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Industry Sector</Label>
                <Input value={industrySector} onChange={(e) => setIndustrySector(e.target.value)} placeholder="Dance & Performing Arts" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Users className="h-3 w-3" />Full-time Employees</Label>
                <Input type="number" value={fulltimeEmployees} onChange={(e) => setFulltimeEmployees(e.target.value)} placeholder="5" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Users className="h-3 w-3" />Part-time Employees</Label>
                <Input type="number" value={parttimeEmployees} onChange={(e) => setParttimeEmployees(e.target.value)} placeholder="15" />
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-sm font-medium mb-4 flex items-center gap-2"><MapPin className="h-4 w-4" />Addresses</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Registered Address</Label>
                <Textarea value={registeredAddress} onChange={(e) => setRegisteredAddress(e.target.value)} placeholder={"123 Business Street\nCity, County\nAB12 3CD"} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Trading Address</Label>
                <Textarea value={tradingAddress} onChange={(e) => setTradingAddress(e.target.value)} placeholder={"456 Studio Lane\nCity, County\nXY98 7ZW"} rows={3} />
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-sm font-medium mb-4 flex items-center gap-2"><Phone className="h-4 w-4" />Contact Information</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Globe className="h-3 w-3" />Website URL</Label>
                <Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://www.thedanceexclusive.com" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Phone className="h-3 w-3" />Phone Number</Label>
                <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+44 1234 567890" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Mail className="h-3 w-3" />Main Email</Label>
                <Input type="email" value={emailAddress} onChange={(e) => setEmailAddress(e.target.value)} placeholder="info@thedanceexclusive.com" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Mail className="h-3 w-3" />Support Email</Label>
                <Input type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} placeholder="support@thedanceexclusive.com" />
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-sm font-medium mb-4 flex items-center gap-2"><AtSign className="h-4 w-4" />Social Media</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Facebook</Label>
                <Input value={socialFacebook} onChange={(e) => setSocialFacebook(e.target.value)} placeholder="https://facebook.com/yourpage" />
              </div>
              <div className="space-y-2">
                <Label>Instagram</Label>
                <Input value={socialInstagram} onChange={(e) => setSocialInstagram(e.target.value)} placeholder="https://instagram.com/yourprofile" />
              </div>
              <div className="space-y-2">
                <Label>TikTok</Label>
                <Input value={socialTiktok} onChange={(e) => setSocialTiktok(e.target.value)} placeholder="https://tiktok.com/@yourhandle" />
              </div>
              <div className="space-y-2">
                <Label>Twitter / X</Label>
                <Input value={socialTwitter} onChange={(e) => setSocialTwitter(e.target.value)} placeholder="https://x.com/yourhandle" />
              </div>
              <div className="space-y-2">
                <Label>LinkedIn</Label>
                <Input value={socialLinkedin} onChange={(e) => setSocialLinkedin(e.target.value)} placeholder="https://linkedin.com/company/yourcompany" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <TrialReminderCard />

      <div className="flex justify-end pb-8">
        <Button onClick={() => { manualSaveRef.current = true; saveMutation.mutate(); }} disabled={saveMutation.isPending} size="lg">
          {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save All Settings
        </Button>
      </div>
    </div>
  );
};

export default SettingsCompany;
