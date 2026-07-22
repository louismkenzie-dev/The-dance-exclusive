import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { CalendarDays, MapPin, User, Users, Clock, Tag, Plus, QrCode, MessageCircle } from "lucide-react";
import BookingQrDialog from "@/components/portal/BookingQrDialog";

const statusColors: Record<string, "default" | "secondary" | "destructive"> = {
  confirmed: "default",
  pending_payment: "secondary",
  cancelled: "destructive",
};

const statusLabels: Record<string, string> = {
  confirmed: "Confirmed",
  pending_payment: "Pending Payment",
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
          classes(name, day_of_week, start_time, end_time, class_type, dance_style, price_per_session, price_per_term, price_per_month, price_per_year, whatsapp_group_url,
            venues(name, address_line1, city, postcode),
            workshops(name, cover_image)
          ),
          camps(name, start_date, end_date, start_time, end_time, class_type,
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
    <div className="container py-12 max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-display font-bold">My Bookings</h1>
        <Button asChild>
          <Link to={bookNowPath}>
            <Plus className="w-4 h-4 mr-2" /> Book a Class
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : bookings.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center space-y-4">
            <CalendarDays className="w-12 h-12 mx-auto text-muted-foreground/40" />
            <div>
              <p className="text-lg font-semibold">No bookings yet</p>
              <p className="text-sm text-muted-foreground mt-1">Ready to start dancing? Browse our classes and book your first session!</p>
            </div>
            <Button asChild size="lg">
              <Link to={bookNowPath}>
                <CalendarDays className="w-4 h-4 mr-2" /> Browse Classes
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => {
            const camp = b.camps;
            // Camp (holiday workshop) bookings have no class row — surface the
            // camp's details through the same card shape.
            const cls = b.classes ?? (camp ? {
              name: camp.name,
              day_of_week: null,
              start_time: camp.start_time,
              end_time: camp.end_time,
              class_type: camp.class_type,
              dance_style: null,
              whatsapp_group_url: null,
              venues: camp.venues,
              workshops: camp.workshops,
            } : null);
            const student = b.students;
            const venue = cls?.venues;
            const isAdult = cls?.class_type === "adult";
            const coverImage = cls?.workshops?.cover_image;

            return (
              <Card key={b.id} className="animate-fade-in overflow-hidden">
                <CardContent className="py-0 px-0">
                  <div className="flex">
                    {/* Cover image strip */}
                    {coverImage && (
                      <div className="w-20 md:w-28 flex-shrink-0">
                        <img src={coverImage} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}

                    <div className="flex-1 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0 space-y-1.5">
                          {/* Title row */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-base">{cls?.name}</h3>
                            <Badge variant={statusColors[b.status] || "secondary"} className="text-[10px]">
                              {statusLabels[b.status] || b.status}
                            </Badge>
                            <Badge variant="outline" className={`text-[10px] ${isAdult ? "border-pink-500/40 text-pink-400" : "border-primary/40 text-primary"}`}>
                              {isAdult ? "Adult" : "Children's"} Class
                            </Badge>
                          </div>

                          {/* Schedule */}
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <CalendarDays className="w-3.5 h-3.5" />
                              {cls?.day_of_week
                                ? cls.day_of_week.charAt(0).toUpperCase() + cls.day_of_week.slice(1)
                                : camp?.start_date && camp?.end_date
                                  ? `${camp.start_date.slice(8, 10)}/${camp.start_date.slice(5, 7)} – ${camp.end_date.slice(8, 10)}/${camp.end_date.slice(5, 7)}`
                                  : "—"}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {cls?.start_time?.slice(0, 5)} – {cls?.end_time?.slice(0, 5)}
                            </span>
                          </div>

                          {/* Dance style */}
                          {cls?.dance_style && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Tag className="w-3 h-3" /> {cls.dance_style}
                            </p>
                          )}

                          {/* Student info */}
                          {student && (
                            <div className="flex items-center gap-2 mt-1">
                              {student.profile_photo ? (
                                <img src={student.profile_photo} alt="" className="w-5 h-5 rounded-full object-cover" />
                              ) : (
                                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                              )}
                              <span className="text-sm">
                                {student.first_name} {student.last_name}
                                {student.preferred_name && <span className="text-muted-foreground"> "{student.preferred_name}"</span>}
                              </span>
                            </div>
                          )}

                          {/* Venue */}
                          {venue && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {venue.name}{venue.city && `, ${venue.city}`}{venue.postcode && ` ${venue.postcode}`}
                            </p>
                          )}

                          {/* Booking type & date */}
                          <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                            {b.booking_type && b.booking_type !== "drop_in" && (
                              <Badge variant="outline" className="text-[10px] capitalize">
                                {b.booking_type.replace(/_/g, " ")}
                              </Badge>
                            )}
                            <span>Booked: {format(new Date(b.booked_at), "d MMM yyyy")}</span>
                          </div>

                          {/* WhatsApp group link (confirmed bookings only) */}
                          {b.status === "confirmed" && cls?.whatsapp_group_url && (
                            <a
                              href={cls.whatsapp_group_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex w-fit items-center gap-1.5 rounded-md bg-[#25D366] px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#1DA851] mt-1"
                            >
                              <MessageCircle className="w-3.5 h-3.5" /> Join the class WhatsApp group
                            </a>
                          )}
                        </div>

                        {/* Price + QR */}
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          {b.amount != null && (
                            <span className="text-xl font-bold">£{Number(b.amount).toFixed(2)}</span>
                          )}
                          {b.status === "confirmed" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setQrBooking(b)}
                              className="gap-1.5"
                            >
                              <QrCode className="w-3.5 h-3.5" /> Sign-in QR
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
        </div>
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
