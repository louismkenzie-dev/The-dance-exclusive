import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { CalendarDays, MapPin, Users, Clock, Tag, Plus, QrCode } from "lucide-react";
import BookingQrDialog from "@/components/portal/BookingQrDialog";
import { FadeRise, Stagger } from "@/components/motion";

const statusVariants: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  confirmed: "success",
  pending_payment: "warning",
  cancelled: "destructive",
};

const statusLabels: Record<string, string> = {
  confirmed: "Confirmed",
  pending_payment: "Pending payment",
  cancelled: "Cancelled",
};

const MyBookings = () => {
  const { user, profile } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrBooking, setQrBooking] = useState<any | null>(null);

  const customerType = profile?.customer_type as string | null;
  const primaryIsAdult = customerType === "adult_dancer";

  useEffect(() => {
    if (!user) return;
    const fetchBookings = async () => {
      const { data } = await supabase
        .from("bookings")
        .select(`*,
          classes(name, day_of_week, start_time, end_time, class_type, dance_style, price_per_session, price_per_term, price_per_month, price_per_year,
            venues(name, address_line1, city, postcode),
            workshops(name, cover_image)
          ),
          students(first_name, last_name, preferred_name, profile_photo)`)
        .eq("parent_id", user.id)
        .order("booked_at", { ascending: false });
      if (data) setBookings(data);
      setLoading(false);
    };
    fetchBookings();
  }, [user]);

  const bookNowPath = primaryIsAdult ? "/classes/adult" : "/classes/children";

  return (
    <div className="container max-w-3xl py-8 md:py-10">
      <FadeRise>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">My bookings</h1>
            <p className="mt-1 text-muted-foreground">Everything you've booked, in one place</p>
          </div>
          <Button asChild>
            <Link to={bookNowPath}>
              <Plus className="mr-2 h-4 w-4" /> Book a class
            </Link>
          </Button>
        </div>
      </FadeRise>

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : bookings.length === 0 ? (
        <FadeRise>
          <Card>
            <CardContent className="space-y-5 py-16 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/8 text-primary">
                <CalendarDays className="h-7 w-7" />
              </div>
              <div>
                <p className="font-display text-lg font-semibold">No bookings yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Ready to start dancing? Browse our classes and book your first session!</p>
              </div>
              <Button asChild size="lg">
                <Link to={bookNowPath}>
                  <CalendarDays className="mr-2 h-4 w-4" /> Browse classes
                </Link>
              </Button>
            </CardContent>
          </Card>
        </FadeRise>
      ) : (
        <Stagger className="space-y-4">
          {bookings.map((b) => {
            const cls = b.classes;
            const student = b.students;
            const venue = cls?.venues;
            const isAdult = cls?.class_type === "adult";
            const coverImage = cls?.workshops?.cover_image;

            return (
              <Card
                key={b.id}
                className="overflow-hidden transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-soft-lg"
              >
                <CardContent className="px-0 py-0">
                  <div className="flex">
                    {/* Cover image strip */}
                    {coverImage && (
                      <div className="w-20 flex-shrink-0 md:w-28">
                        <img src={coverImage} alt="" className="h-full w-full object-cover" />
                      </div>
                    )}

                    <div className="flex-1 p-4 md:p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1 space-y-1.5">
                          {/* Title row */}
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-display text-base font-semibold">{cls?.name}</h3>
                            <Badge variant={statusVariants[b.status] || "secondary"} className="text-[10px]">
                              {statusLabels[b.status] || b.status}
                            </Badge>
                            <Badge variant={isAdult ? "accent" : "default"} className="text-[10px]">
                              {isAdult ? "Adult" : "Children's"} class
                            </Badge>
                          </div>

                          {/* Schedule */}
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <CalendarDays className="h-3.5 w-3.5" />
                              {cls?.day_of_week?.charAt(0).toUpperCase() + cls?.day_of_week?.slice(1)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {cls?.start_time?.slice(0, 5)} – {cls?.end_time?.slice(0, 5)}
                            </span>
                          </div>

                          {/* Dance style */}
                          {cls?.dance_style && (
                            <p className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Tag className="h-3 w-3" /> {cls.dance_style}
                            </p>
                          )}

                          {/* Student info */}
                          {student && (
                            <div className="mt-1 flex items-center gap-2">
                              {student.profile_photo ? (
                                <img src={student.profile_photo} alt="" className="h-5 w-5 rounded-full object-cover" />
                              ) : (
                                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                              <span className="text-sm">
                                {student.first_name} {student.last_name}
                                {student.preferred_name && <span className="text-muted-foreground"> "{student.preferred_name}"</span>}
                              </span>
                            </div>
                          )}

                          {/* Venue */}
                          {venue && (
                            <p className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {venue.name}{venue.city && `, ${venue.city}`}{venue.postcode && ` ${venue.postcode}`}
                            </p>
                          )}

                          {/* Booking type & date */}
                          <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground">
                            {b.booking_type && b.booking_type !== "drop_in" && (
                              <Badge variant="secondary" className="text-[10px] capitalize">
                                {b.booking_type.replace(/_/g, " ")}
                              </Badge>
                            )}
                            <span>Booked: {format(new Date(b.booked_at), "d MMM yyyy")}</span>
                          </div>
                        </div>

                        {/* Price + QR */}
                        <div className="flex flex-shrink-0 flex-col items-end gap-2">
                          {b.amount != null && (
                            <span className="font-display text-xl font-bold tabular-nums">£{Number(b.amount).toFixed(2)}</span>
                          )}
                          {b.status === "confirmed" && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setQrBooking(b)}
                              className="gap-1.5"
                            >
                              <QrCode className="h-3.5 w-3.5" /> Sign-in QR
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </Stagger>
      )}

      <BookingQrDialog
        open={!!qrBooking}
        onOpenChange={(o) => !o && setQrBooking(null)}
        booking={qrBooking}
      />
    </div>
  );
};

export default MyBookings;
