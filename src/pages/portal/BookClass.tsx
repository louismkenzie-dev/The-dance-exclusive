import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, Clock, MapPin, ArrowLeft } from "lucide-react";

const BookClass = () => {
  const { classId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [classData, setClassData] = useState<any>(null);
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("classes")
        .select("*, venues(name), staff(full_name)")
        .eq("id", classId!)
        .single();
      if (data) setClassData(data);

      if (user && data?.class_type === "children") {
        const { data: kids } = await supabase.from("students").select("id, first_name, last_name").eq("parent_id", user.id);
        if (kids) setChildren(kids);
      }
      setLoading(false);
    };
    fetch();
  }, [classId, user]);

  const handleBook = async () => {
    if (!user) { navigate("/auth"); return; }
    if (classData.class_type === "children" && !selectedChild) {
      toast({ title: "Select a child", description: "Please select which child to book for.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("bookings").insert({
      class_id: classId!,
      parent_id: user.id,
      student_id: classData.class_type === "children" ? selectedChild : null,
      status: "pending_payment" as any,
      booking_type: "term",
      amount: classData.price_per_term || classData.price_per_session,
    });
    setSubmitting(false);

    if (error) {
      toast({ title: "Booking failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Booking confirmed!", description: "Your booking has been placed. Payment details will follow." });
      navigate("/account/bookings");
    }
  };

  if (loading) return <div className="container py-12 text-center text-muted-foreground">Loading...</div>;
  if (!classData) return <div className="container py-12 text-center text-muted-foreground">Class not found.</div>;

  return (
    <div className="container py-12 max-w-2xl">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to classes
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{classData.name}</CardTitle>
          {classData.description && <p className="text-muted-foreground mt-2">{classData.description}</p>}
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="w-4 h-4" />
              {classData.day_of_week.charAt(0).toUpperCase() + classData.day_of_week.slice(1)}
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4" />
              {classData.start_time?.slice(0, 5)} – {classData.end_time?.slice(0, 5)}
            </div>
            {classData.venues && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="w-4 h-4" />
                {classData.venues.name}
              </div>
            )}
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Price</span>
              <div>
                {classData.price_per_session && <span className="font-bold">£{classData.price_per_session}/session</span>}
                {classData.price_per_term && <span className="text-muted-foreground ml-2">or £{classData.price_per_term}/term</span>}
              </div>
            </div>
          </div>

          {classData.class_type === "children" && user && (
            <div className="space-y-2">
              <Label>Select Child</Label>
              {children.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No children on your account. <Button variant="link" className="p-0 h-auto" onClick={() => navigate("/account/children")}>Add a child first</Button>.
                </p>
              ) : (
                <Select value={selectedChild} onValueChange={setSelectedChild}>
                  <SelectTrigger><SelectValue placeholder="Select child" /></SelectTrigger>
                  <SelectContent>
                    {children.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <Button onClick={handleBook} className="w-full" size="lg" disabled={submitting}>
            {submitting ? "Booking..." : user ? "Confirm Booking" : "Sign In to Book"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default BookClass;
