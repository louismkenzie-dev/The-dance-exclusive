export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      attendance: {
        Row: {
          booking_id: string
          check_in_method: string | null
          check_out_method: string | null
          checked_in_at: string | null
          checked_out_at: string | null
          class_id: string
          class_session_id: string | null
          collector_name: string | null
          created_at: string
          id: string
          notes: string | null
          session_date: string
          status: string
          student_id: string | null
        }
        Insert: {
          booking_id: string
          check_in_method?: string | null
          check_out_method?: string | null
          checked_in_at?: string | null
          checked_out_at?: string | null
          class_id: string
          class_session_id?: string | null
          collector_name?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          session_date: string
          status?: string
          student_id?: string | null
        }
        Update: {
          booking_id?: string
          check_in_method?: string | null
          check_out_method?: string | null
          checked_in_at?: string | null
          checked_out_at?: string | null
          class_id?: string
          class_session_id?: string | null
          collector_name?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          session_date?: string
          status?: string
          student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_class_session_id_fkey"
            columns: ["class_session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      authorized_collectors: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          parent_id: string
          phone: string | null
          relationship: string
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          parent_id: string
          phone?: string | null
          relationship: string
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          parent_id?: string
          phone?: string | null
          relationship?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "authorized_collectors_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_qr_tokens: {
        Row: {
          booking_id: string
          class_session_id: string | null
          created_at: string
          id: string
          student_id: string | null
          token: string
          valid_from: string
          valid_until: string
        }
        Insert: {
          booking_id: string
          class_session_id?: string | null
          created_at?: string
          id?: string
          student_id?: string | null
          token: string
          valid_from?: string
          valid_until: string
        }
        Update: {
          booking_id?: string
          class_session_id?: string | null
          created_at?: string
          id?: string
          student_id?: string | null
          token?: string
          valid_from?: string
          valid_until?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          amount: number | null
          booked_at: string
          booking_type: string
          camp_id: string | null
          class_id: string | null
          created_at: string
          id: string
          notes: string | null
          parent_id: string
          status: Database["public"]["Enums"]["booking_status"]
          student_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          booked_at?: string
          booking_type?: string
          camp_id?: string | null
          class_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          parent_id: string
          status?: Database["public"]["Enums"]["booking_status"]
          student_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          booked_at?: string
          booking_type?: string
          camp_id?: string | null
          class_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          parent_id?: string
          status?: Database["public"]["Enums"]["booking_status"]
          student_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_camp_id_fkey"
            columns: ["camp_id"]
            isOneToOne: false
            referencedRelation: "camps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_logos: {
        Row: {
          created_at: string
          display_order: number
          id: string
          image_url: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          image_url: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      camp_instructors: {
        Row: {
          camp_id: string
          created_at: string
          id: string
          instructor_role: string
          pay_per_hour_override: number | null
          staff_id: string
        }
        Insert: {
          camp_id: string
          created_at?: string
          id?: string
          instructor_role?: string
          pay_per_hour_override?: number | null
          staff_id: string
        }
        Update: {
          camp_id?: string
          created_at?: string
          id?: string
          instructor_role?: string
          pay_per_hour_override?: number | null
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "camp_instructors_camp_id_fkey"
            columns: ["camp_id"]
            isOneToOne: false
            referencedRelation: "camps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camp_instructors_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      camp_session_instructors: {
        Row: {
          created_at: string
          id: string
          instructor_role: string
          pay_per_hour_override: number | null
          session_id: string
          staff_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          instructor_role?: string
          pay_per_hour_override?: number | null
          session_id: string
          staff_id: string
        }
        Update: {
          created_at?: string
          id?: string
          instructor_role?: string
          pay_per_hour_override?: number | null
          session_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "camp_session_instructors_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "camp_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camp_session_instructors_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      camp_sessions: {
        Row: {
          camp_id: string
          created_at: string
          end_time: string
          id: string
          notes: string | null
          session_date: string
          start_time: string
          status: string
          updated_at: string
        }
        Insert: {
          camp_id: string
          created_at?: string
          end_time: string
          id?: string
          notes?: string | null
          session_date: string
          start_time: string
          status?: string
          updated_at?: string
        }
        Update: {
          camp_id?: string
          created_at?: string
          end_time?: string
          id?: string
          notes?: string | null
          session_date?: string
          start_time?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "camp_sessions_camp_id_fkey"
            columns: ["camp_id"]
            isOneToOne: false
            referencedRelation: "camps"
            referencedColumns: ["id"]
          },
        ]
      }
      camps: {
        Row: {
          age_max: number | null
          age_min: number | null
          capacity: number
          class_type: Database["public"]["Enums"]["class_type"]
          created_at: string
          dance_style: string | null
          description: string | null
          end_date: string | null
          end_time: string
          id: string
          is_active: boolean
          name: string
          price_per_day: number | null
          price_total: number | null
          sibling_discount_enabled: boolean
          start_date: string | null
          start_time: string
          updated_at: string
          venue_id: string | null
          workshop_id: string | null
        }
        Insert: {
          age_max?: number | null
          age_min?: number | null
          capacity?: number
          class_type?: Database["public"]["Enums"]["class_type"]
          created_at?: string
          dance_style?: string | null
          description?: string | null
          end_date?: string | null
          end_time?: string
          id?: string
          is_active?: boolean
          name: string
          price_per_day?: number | null
          price_total?: number | null
          sibling_discount_enabled?: boolean
          start_date?: string | null
          start_time?: string
          updated_at?: string
          venue_id?: string | null
          workshop_id?: string | null
        }
        Update: {
          age_max?: number | null
          age_min?: number | null
          capacity?: number
          class_type?: Database["public"]["Enums"]["class_type"]
          created_at?: string
          dance_style?: string | null
          description?: string | null
          end_date?: string | null
          end_time?: string
          id?: string
          is_active?: boolean
          name?: string
          price_per_day?: number | null
          price_total?: number | null
          sibling_discount_enabled?: boolean
          start_date?: string | null
          start_time?: string
          updated_at?: string
          venue_id?: string | null
          workshop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "camps_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "camps_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          camp_id: string | null
          cart_item_id: string
          class_id: string | null
          class_name: string
          class_type: Database["public"]["Enums"]["class_type"]
          created_at: string
          dance_style: string | null
          day_of_week: Database["public"]["Enums"]["day_of_week"]
          end_time: string
          id: string
          item_kind: string
          pricing_plan: string
          selected_session_dates: string[]
          selected_session_ids: string[]
          sessions_count: number | null
          start_time: string
          student_id: string | null
          student_name: string | null
          term_discount_percent: number | null
          total_price: number
          unit_price: number
          updated_at: string
          user_id: string
          venue_name: string | null
          workshop_image: string | null
        }
        Insert: {
          camp_id?: string | null
          cart_item_id: string
          class_id?: string | null
          class_name: string
          class_type: Database["public"]["Enums"]["class_type"]
          created_at?: string
          dance_style?: string | null
          day_of_week: Database["public"]["Enums"]["day_of_week"]
          end_time: string
          id?: string
          item_kind?: string
          pricing_plan: string
          selected_session_dates?: string[]
          selected_session_ids?: string[]
          sessions_count?: number | null
          start_time: string
          student_id?: string | null
          student_name?: string | null
          term_discount_percent?: number | null
          total_price?: number
          unit_price?: number
          updated_at?: string
          user_id: string
          venue_name?: string | null
          workshop_image?: string | null
        }
        Update: {
          camp_id?: string | null
          cart_item_id?: string
          class_id?: string | null
          class_name?: string
          class_type?: Database["public"]["Enums"]["class_type"]
          created_at?: string
          dance_style?: string | null
          day_of_week?: Database["public"]["Enums"]["day_of_week"]
          end_time?: string
          id?: string
          item_kind?: string
          pricing_plan?: string
          selected_session_dates?: string[]
          selected_session_ids?: string[]
          sessions_count?: number | null
          start_time?: string
          student_id?: string | null
          student_name?: string | null
          term_discount_percent?: number | null
          total_price?: number
          unit_price?: number
          updated_at?: string
          user_id?: string
          venue_name?: string | null
          workshop_image?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_camp_id_fkey"
            columns: ["camp_id"]
            isOneToOne: false
            referencedRelation: "camps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      class_instructors: {
        Row: {
          class_id: string
          created_at: string
          id: string
          instructor_role: string
          pay_per_hour_override: number | null
          staff_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          instructor_role?: string
          pay_per_hour_override?: number | null
          staff_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          instructor_role?: string
          pay_per_hour_override?: number | null
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_instructors_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_instructors_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      class_passes: {
        Row: {
          amount_paid: number
          cart_item_ref: string | null
          created_at: string
          expires_at: string
          id: string
          pass_type: string
          payment_intent_id: string | null
          purchased_at: string
          sessions_remaining: number
          sessions_total: number
          student_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_paid?: number
          cart_item_ref?: string | null
          created_at?: string
          expires_at: string
          id?: string
          pass_type: string
          payment_intent_id?: string | null
          purchased_at?: string
          sessions_remaining: number
          sessions_total: number
          student_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_paid?: number
          cart_item_ref?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          pass_type?: string
          payment_intent_id?: string | null
          purchased_at?: string
          sessions_remaining?: number
          sessions_total?: number
          student_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_passes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      class_sessions: {
        Row: {
          class_id: string
          created_at: string
          end_time: string
          id: string
          instructor_id: string | null
          notes: string | null
          price_override: number | null
          session_date: string
          start_time: string
          status: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          end_time: string
          id?: string
          instructor_id?: string | null
          notes?: string | null
          price_override?: number | null
          session_date: string
          start_time: string
          status?: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          end_time?: string
          id?: string
          instructor_id?: string | null
          notes?: string | null
          price_override?: number | null
          session_date?: string
          start_time?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_sessions_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          ability_level: string | null
          age_max: number | null
          age_min: number | null
          allow_trial: boolean
          audience_label: string | null
          booking_enabled: boolean
          capacity: number
          class_type: Database["public"]["Enums"]["class_type"]
          created_at: string
          dance_style: string | null
          day_of_week: Database["public"]["Enums"]["day_of_week"]
          days_of_week: string[]
          description: string | null
          end_time: string
          gender: string | null
          id: string
          instructor_id: string | null
          invite_only: boolean
          is_active: boolean
          monthly_discount_percent: number | null
          name: string
          price_per_month: number | null
          price_per_session: number | null
          price_per_term: number | null
          price_per_year: number | null
          publicly_visible: boolean
          school_term_id: string | null
          school_year_max: number | null
          school_year_min: number | null
          sibling_discount_enabled: boolean
          sort_order: number
          start_time: string
          status: string
          term_discount_amount: number | null
          term_discount_percent: number | null
          term_end: string | null
          term_start: string | null
          updated_at: string
          venue_id: string | null
          whatsapp_group_url: string | null
          workshop_id: string | null
          year_discount_amount: number | null
          year_discount_percent: number | null
        }
        Insert: {
          ability_level?: string | null
          age_max?: number | null
          age_min?: number | null
          allow_trial?: boolean
          audience_label?: string | null
          booking_enabled?: boolean
          capacity?: number
          class_type?: Database["public"]["Enums"]["class_type"]
          created_at?: string
          dance_style?: string | null
          day_of_week: Database["public"]["Enums"]["day_of_week"]
          days_of_week?: string[]
          description?: string | null
          end_time: string
          gender?: string | null
          id?: string
          instructor_id?: string | null
          invite_only?: boolean
          is_active?: boolean
          monthly_discount_percent?: number | null
          name: string
          price_per_month?: number | null
          price_per_session?: number | null
          price_per_term?: number | null
          price_per_year?: number | null
          publicly_visible?: boolean
          school_term_id?: string | null
          school_year_max?: number | null
          school_year_min?: number | null
          sibling_discount_enabled?: boolean
          sort_order?: number
          start_time: string
          status?: string
          term_discount_amount?: number | null
          term_discount_percent?: number | null
          term_end?: string | null
          term_start?: string | null
          updated_at?: string
          venue_id?: string | null
          whatsapp_group_url?: string | null
          workshop_id?: string | null
          year_discount_amount?: number | null
          year_discount_percent?: number | null
        }
        Update: {
          ability_level?: string | null
          age_max?: number | null
          age_min?: number | null
          allow_trial?: boolean
          audience_label?: string | null
          booking_enabled?: boolean
          capacity?: number
          class_type?: Database["public"]["Enums"]["class_type"]
          created_at?: string
          dance_style?: string | null
          day_of_week?: Database["public"]["Enums"]["day_of_week"]
          days_of_week?: string[]
          description?: string | null
          end_time?: string
          gender?: string | null
          id?: string
          instructor_id?: string | null
          invite_only?: boolean
          is_active?: boolean
          monthly_discount_percent?: number | null
          name?: string
          price_per_month?: number | null
          price_per_session?: number | null
          price_per_term?: number | null
          price_per_year?: number | null
          publicly_visible?: boolean
          school_term_id?: string | null
          school_year_max?: number | null
          school_year_min?: number | null
          sibling_discount_enabled?: boolean
          sort_order?: number
          start_time?: string
          status?: string
          term_discount_amount?: number | null
          term_discount_percent?: number | null
          term_end?: string | null
          term_start?: string | null
          updated_at?: string
          venue_id?: string | null
          whatsapp_group_url?: string | null
          workshop_id?: string | null
          year_discount_amount?: number | null
          year_discount_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_school_term_id_fkey"
            columns: ["school_term_id"]
            isOneToOne: false
            referencedRelation: "school_terms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_redemptions: {
        Row: {
          amount_discounted: number
          coupon_id: string
          id: string
          payment_intent_id: string | null
          redeemed_at: string
          user_id: string
        }
        Insert: {
          amount_discounted?: number
          coupon_id: string
          id?: string
          payment_intent_id?: string | null
          redeemed_at?: string
          user_id: string
        }
        Update: {
          amount_discounted?: number
          coupon_id?: string
          id?: string
          payment_intent_id?: string | null
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          applies_to_camp_ids: string[] | null
          applies_to_class_ids: string[]
          applies_to_class_types: string[]
          applies_to_pricing_plans: string[]
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          updated_at: string
          usage_limit_per_user: number | null
          usage_limit_total: number | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          applies_to_camp_ids?: string[] | null
          applies_to_class_ids?: string[]
          applies_to_class_types?: string[]
          applies_to_pricing_plans?: string[]
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_type: string
          discount_value: number
          id?: string
          is_active?: boolean
          updated_at?: string
          usage_limit_per_user?: number | null
          usage_limit_total?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          applies_to_camp_ids?: string[] | null
          applies_to_class_ids?: string[]
          applies_to_class_types?: string[]
          applies_to_pricing_plans?: string[]
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          updated_at?: string
          usage_limit_per_user?: number | null
          usage_limit_total?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      medical_waivers: {
        Row: {
          consent_given: boolean
          created_at: string
          id: string
          parent_id: string
          photo_consent: boolean
          signed_at: string | null
          student_id: string
          updated_at: string
          waiver_text: string | null
        }
        Insert: {
          consent_given?: boolean
          created_at?: string
          id?: string
          parent_id: string
          photo_consent?: boolean
          signed_at?: string | null
          student_id: string
          updated_at?: string
          waiver_text?: string | null
        }
        Update: {
          consent_given?: boolean
          created_at?: string
          id?: string
          parent_id?: string
          photo_consent?: boolean
          signed_at?: string | null
          student_id?: string
          updated_at?: string
          waiver_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medical_waivers_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      merchandise_bundle_items: {
        Row: {
          bundle_id: string
          created_at: string
          id: string
          item_id: string
          quantity: number
        }
        Insert: {
          bundle_id: string
          created_at?: string
          id?: string
          item_id: string
          quantity?: number
        }
        Update: {
          bundle_id?: string
          created_at?: string
          id?: string
          item_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "merchandise_bundle_items_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "merchandise_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchandise_bundle_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "merchandise_items"
            referencedColumns: ["id"]
          },
        ]
      }
      merchandise_bundles: {
        Row: {
          bundle_price: number
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          bundle_price?: number
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          bundle_price?: number
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      merchandise_items: {
        Row: {
          base_price: number
          category: string
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          base_price?: number
          category?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          base_price?: number
          category?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      merchandise_media: {
        Row: {
          caption: string | null
          created_at: string
          file_path: string
          id: string
          is_primary: boolean
          item_id: string
          media_type: string
          sort_order: number | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          file_path: string
          id?: string
          is_primary?: boolean
          item_id: string
          media_type?: string
          sort_order?: number | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          file_path?: string
          id?: string
          is_primary?: boolean
          item_id?: string
          media_type?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "merchandise_media_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "merchandise_items"
            referencedColumns: ["id"]
          },
        ]
      }
      merchandise_variants: {
        Row: {
          color: string | null
          created_at: string
          id: string
          is_active: boolean
          item_id: string
          price_override: number | null
          size: string
          sku: string | null
          stock_quantity: number
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          item_id: string
          price_override?: number | null
          size: string
          sku?: string | null
          stock_quantity?: number
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          item_id?: string
          price_override?: number | null
          size?: string
          sku?: string | null
          stock_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "merchandise_variants_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "merchandise_items"
            referencedColumns: ["id"]
          },
        ]
      }
      party_extras: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          name: string
          price: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          price?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          price?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      party_inquiries: {
        Row: {
          birthday_child_age: number | null
          birthday_child_name: string
          created_at: string
          email: string
          guest_count: number | null
          id: string
          notes: string | null
          parent_name: string
          party_package_id: string | null
          phone: string | null
          preferred_date: string | null
          preferred_time: string | null
          selected_extras: string[]
          status: string
          updated_at: string
          venue_preference: string | null
        }
        Insert: {
          birthday_child_age?: number | null
          birthday_child_name: string
          created_at?: string
          email: string
          guest_count?: number | null
          id?: string
          notes?: string | null
          parent_name: string
          party_package_id?: string | null
          phone?: string | null
          preferred_date?: string | null
          preferred_time?: string | null
          selected_extras?: string[]
          status?: string
          updated_at?: string
          venue_preference?: string | null
        }
        Update: {
          birthday_child_age?: number | null
          birthday_child_name?: string
          created_at?: string
          email?: string
          guest_count?: number | null
          id?: string
          notes?: string | null
          parent_name?: string
          party_package_id?: string | null
          phone?: string | null
          preferred_date?: string | null
          preferred_time?: string | null
          selected_extras?: string[]
          status?: string
          updated_at?: string
          venue_preference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "party_inquiries_party_package_id_fkey"
            columns: ["party_package_id"]
            isOneToOne: false
            referencedRelation: "party_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      party_package_media: {
        Row: {
          caption: string | null
          created_at: string
          file_path: string
          id: string
          media_type: string
          package_id: string
          sort_order: number | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          file_path: string
          id?: string
          media_type?: string
          package_id: string
          sort_order?: number | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          file_path?: string
          id?: string
          media_type?: string
          package_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "party_package_media_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "party_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      party_packages: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          extra_guest_price: number
          header_image: string | null
          id: string
          included_items: string[]
          is_active: boolean
          max_guests: number
          name: string
          price_1_5hr: number | null
          price_1hr: number | null
          updated_at: string
          venue_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          extra_guest_price?: number
          header_image?: string | null
          id?: string
          included_items?: string[]
          is_active?: boolean
          max_guests?: number
          name: string
          price_1_5hr?: number | null
          price_1hr?: number | null
          updated_at?: string
          venue_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          extra_guest_price?: number
          header_image?: string | null
          id?: string
          included_items?: string[]
          is_active?: boolean
          max_guests?: number
          name?: string
          price_1_5hr?: number | null
          price_1hr?: number | null
          updated_at?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "party_packages_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ability_level: string | null
          address_line1: string | null
          address_line2: string | null
          allergies_list: string[] | null
          avatar_url: string | null
          city: string | null
          county: string | null
          created_at: string
          customer_type: string | null
          dance_experience: string | null
          dance_style_preference: string | null
          date_of_birth: string | null
          email: string
          full_name: string
          gender: string | null
          has_epipen: boolean | null
          has_inhaler: boolean | null
          id: string
          medical_conditions_list: string[] | null
          medical_info: string | null
          phone: string | null
          pickup_pin: string | null
          postcode: string | null
          preferred_name: string | null
          profile_photo: string | null
          secondary_phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ability_level?: string | null
          address_line1?: string | null
          address_line2?: string | null
          allergies_list?: string[] | null
          avatar_url?: string | null
          city?: string | null
          county?: string | null
          created_at?: string
          customer_type?: string | null
          dance_experience?: string | null
          dance_style_preference?: string | null
          date_of_birth?: string | null
          email: string
          full_name: string
          gender?: string | null
          has_epipen?: boolean | null
          has_inhaler?: boolean | null
          id?: string
          medical_conditions_list?: string[] | null
          medical_info?: string | null
          phone?: string | null
          pickup_pin?: string | null
          postcode?: string | null
          preferred_name?: string | null
          profile_photo?: string | null
          secondary_phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ability_level?: string | null
          address_line1?: string | null
          address_line2?: string | null
          allergies_list?: string[] | null
          avatar_url?: string | null
          city?: string | null
          county?: string | null
          created_at?: string
          customer_type?: string | null
          dance_experience?: string | null
          dance_style_preference?: string | null
          date_of_birth?: string | null
          email?: string
          full_name?: string
          gender?: string | null
          has_epipen?: boolean | null
          has_inhaler?: boolean | null
          id?: string
          medical_conditions_list?: string[] | null
          medical_info?: string | null
          phone?: string | null
          pickup_pin?: string | null
          postcode?: string | null
          preferred_name?: string | null
          profile_photo?: string | null
          secondary_phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      school_holidays: {
        Row: {
          academic_year: string
          created_at: string
          end_date: string
          holiday_type: string
          id: string
          last_synced_at: string | null
          name: string
          source: string
          start_date: string
          updated_at: string
        }
        Insert: {
          academic_year: string
          created_at?: string
          end_date: string
          holiday_type?: string
          id?: string
          last_synced_at?: string | null
          name: string
          source?: string
          start_date: string
          updated_at?: string
        }
        Update: {
          academic_year?: string
          created_at?: string
          end_date?: string
          holiday_type?: string
          id?: string
          last_synced_at?: string | null
          name?: string
          source?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      school_terms: {
        Row: {
          academic_year: string
          created_at: string
          end_date: string
          id: string
          name: string
          start_date: string
          term_type: string
          updated_at: string
        }
        Insert: {
          academic_year: string
          created_at?: string
          end_date: string
          id?: string
          name: string
          start_date: string
          term_type?: string
          updated_at?: string
        }
        Update: {
          academic_year?: string
          created_at?: string
          end_date?: string
          id?: string
          name?: string
          start_date?: string
          term_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      session_availability: {
        Row: {
          class_session_id: string
          created_at: string
          id: string
          notes: string | null
          staff_id: string
          status: string
          updated_at: string
        }
        Insert: {
          class_session_id: string
          created_at?: string
          id?: string
          notes?: string | null
          staff_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          class_session_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          staff_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_availability_class_session_id_fkey"
            columns: ["class_session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_availability_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      session_instructors: {
        Row: {
          created_at: string
          id: string
          instructor_role: string
          pay_per_hour_override: number | null
          session_id: string
          staff_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          instructor_role?: string
          pay_per_hour_override?: number | null
          session_id: string
          staff_id: string
        }
        Update: {
          created_at?: string
          id?: string
          instructor_role?: string
          pay_per_hour_override?: number | null
          session_id?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_instructors_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_instructors_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      shows: {
        Row: {
          capacity: number | null
          class_type: Database["public"]["Enums"]["class_type"]
          cover_image: string | null
          created_at: string
          dance_style: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          is_active: boolean
          name: string
          show_date: string | null
          show_time: string | null
          ticket_price: number | null
          tickets_sold: number | null
          updated_at: string
          venue_id: string | null
        }
        Insert: {
          capacity?: number | null
          class_type?: Database["public"]["Enums"]["class_type"]
          cover_image?: string | null
          created_at?: string
          dance_style?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean
          name: string
          show_date?: string | null
          show_time?: string | null
          ticket_price?: number | null
          tickets_sold?: number | null
          updated_at?: string
          venue_id?: string | null
        }
        Update: {
          capacity?: number | null
          class_type?: Database["public"]["Enums"]["class_type"]
          cover_image?: string | null
          created_at?: string
          dance_style?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean
          name?: string
          show_date?: string | null
          show_time?: string | null
          ticket_price?: number | null
          tickets_sold?: number | null
          updated_at?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shows_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          county: string | null
          created_at: string
          dance_skills: string[]
          date_of_birth: string | null
          dbs_certificate_back: string | null
          dbs_certificate_front: string | null
          dbs_expiry_date: string | null
          dbs_issue_date: string | null
          dbs_number: string | null
          dbs_update_service: boolean
          description: string | null
          drives: boolean
          email: string | null
          first_name: string | null
          full_name: string
          id: string
          invited_at: string | null
          is_active: boolean
          last_invite_sent_at: string | null
          last_name: string | null
          latitude: number | null
          longitude: number | null
          middle_name: string | null
          next_of_kin_name: string | null
          next_of_kin_phone: string | null
          next_of_kin_relationship: string | null
          onboarding_completed_at: string | null
          pay_per_hour: number | null
          phone: string | null
          pli_certificate: string | null
          pli_cover_level: string | null
          pli_expiry_date: string | null
          postcode: string | null
          profile_photo: string | null
          role: string
          secondary_nok_name: string | null
          secondary_nok_phone: string | null
          secondary_nok_relationship: string | null
          secondary_phone: string | null
          self_employed: boolean
          start_date: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          county?: string | null
          created_at?: string
          dance_skills?: string[]
          date_of_birth?: string | null
          dbs_certificate_back?: string | null
          dbs_certificate_front?: string | null
          dbs_expiry_date?: string | null
          dbs_issue_date?: string | null
          dbs_number?: string | null
          dbs_update_service?: boolean
          description?: string | null
          drives?: boolean
          email?: string | null
          first_name?: string | null
          full_name: string
          id?: string
          invited_at?: string | null
          is_active?: boolean
          last_invite_sent_at?: string | null
          last_name?: string | null
          latitude?: number | null
          longitude?: number | null
          middle_name?: string | null
          next_of_kin_name?: string | null
          next_of_kin_phone?: string | null
          next_of_kin_relationship?: string | null
          onboarding_completed_at?: string | null
          pay_per_hour?: number | null
          phone?: string | null
          pli_certificate?: string | null
          pli_cover_level?: string | null
          pli_expiry_date?: string | null
          postcode?: string | null
          profile_photo?: string | null
          role?: string
          secondary_nok_name?: string | null
          secondary_nok_phone?: string | null
          secondary_nok_relationship?: string | null
          secondary_phone?: string | null
          self_employed?: boolean
          start_date?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          county?: string | null
          created_at?: string
          dance_skills?: string[]
          date_of_birth?: string | null
          dbs_certificate_back?: string | null
          dbs_certificate_front?: string | null
          dbs_expiry_date?: string | null
          dbs_issue_date?: string | null
          dbs_number?: string | null
          dbs_update_service?: boolean
          description?: string | null
          drives?: boolean
          email?: string | null
          first_name?: string | null
          full_name?: string
          id?: string
          invited_at?: string | null
          is_active?: boolean
          last_invite_sent_at?: string | null
          last_name?: string | null
          latitude?: number | null
          longitude?: number | null
          middle_name?: string | null
          next_of_kin_name?: string | null
          next_of_kin_phone?: string | null
          next_of_kin_relationship?: string | null
          onboarding_completed_at?: string | null
          pay_per_hour?: number | null
          phone?: string | null
          pli_certificate?: string | null
          pli_cover_level?: string | null
          pli_expiry_date?: string | null
          postcode?: string | null
          profile_photo?: string | null
          role?: string
          secondary_nok_name?: string | null
          secondary_nok_phone?: string | null
          secondary_nok_relationship?: string | null
          secondary_phone?: string | null
          self_employed?: boolean
          start_date?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      staff_documents: {
        Row: {
          created_at: string
          doc_type: string
          expiry_date: string | null
          file_path: string
          id: string
          label: string | null
          staff_id: string
        }
        Insert: {
          created_at?: string
          doc_type: string
          expiry_date?: string | null
          file_path: string
          id?: string
          label?: string | null
          staff_id: string
        }
        Update: {
          created_at?: string
          doc_type?: string
          expiry_date?: string | null
          file_path?: string
          id?: string
          label?: string | null
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_documents_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          ability_level: string | null
          allergies: string | null
          allergies_list: string[]
          avatar_url: string | null
          child_hook: string | null
          created_at: string
          dance_style_preference: string | null
          date_of_birth: string
          ehcp_in_place: boolean
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          expected_arrival_time: string | null
          expected_departure_time: string | null
          first_name: string
          gender: string | null
          has_epipen: boolean
          has_inhaler: boolean
          has_send: boolean
          has_stage_experience: boolean
          id: string
          is_self: boolean
          is_toilet_trained: boolean
          last_name: string
          medical_conditions_list: string[]
          medical_info: string | null
          notes: string | null
          one_to_one_required: boolean
          parent_id: string
          photo_consent: boolean
          preferred_name: string | null
          profile_photo: string | null
          prone_to_accidents: boolean
          send_conditions_list: string[]
          send_details: string | null
          send_triggers_coping: Json | null
          social_media_consent: boolean
          toileting_notes: string | null
          updated_at: string
          wears_nappies: boolean
        }
        Insert: {
          ability_level?: string | null
          allergies?: string | null
          allergies_list?: string[]
          avatar_url?: string | null
          child_hook?: string | null
          created_at?: string
          dance_style_preference?: string | null
          date_of_birth: string
          ehcp_in_place?: boolean
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          expected_arrival_time?: string | null
          expected_departure_time?: string | null
          first_name: string
          gender?: string | null
          has_epipen?: boolean
          has_inhaler?: boolean
          has_send?: boolean
          has_stage_experience?: boolean
          id?: string
          is_self?: boolean
          is_toilet_trained?: boolean
          last_name: string
          medical_conditions_list?: string[]
          medical_info?: string | null
          notes?: string | null
          one_to_one_required?: boolean
          parent_id: string
          photo_consent?: boolean
          preferred_name?: string | null
          profile_photo?: string | null
          prone_to_accidents?: boolean
          send_conditions_list?: string[]
          send_details?: string | null
          send_triggers_coping?: Json | null
          social_media_consent?: boolean
          toileting_notes?: string | null
          updated_at?: string
          wears_nappies?: boolean
        }
        Update: {
          ability_level?: string | null
          allergies?: string | null
          allergies_list?: string[]
          avatar_url?: string | null
          child_hook?: string | null
          created_at?: string
          dance_style_preference?: string | null
          date_of_birth?: string
          ehcp_in_place?: boolean
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          expected_arrival_time?: string | null
          expected_departure_time?: string | null
          first_name?: string
          gender?: string | null
          has_epipen?: boolean
          has_inhaler?: boolean
          has_send?: boolean
          has_stage_experience?: boolean
          id?: string
          is_self?: boolean
          is_toilet_trained?: boolean
          last_name?: string
          medical_conditions_list?: string[]
          medical_info?: string | null
          notes?: string | null
          one_to_one_required?: boolean
          parent_id?: string
          photo_consent?: boolean
          preferred_name?: string | null
          profile_photo?: string | null
          prone_to_accidents?: boolean
          send_conditions_list?: string[]
          send_details?: string | null
          send_triggers_coping?: Json | null
          social_media_consent?: boolean
          toileting_notes?: string | null
          updated_at?: string
          wears_nappies?: boolean
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      venue_contacts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          role: string | null
          venue_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          role?: string | null
          venue_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          role?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_contacts_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_facilities: {
        Row: {
          created_at: string
          id: string
          name: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          venue_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_facilities_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_photos: {
        Row: {
          caption: string | null
          category: string
          created_at: string
          file_path: string
          id: string
          is_primary: boolean
          sort_order: number
          venue_id: string
        }
        Insert: {
          caption?: string | null
          category: string
          created_at?: string
          file_path: string
          id?: string
          is_primary?: boolean
          sort_order?: number
          venue_id: string
        }
        Update: {
          caption?: string | null
          category?: string
          created_at?: string
          file_path?: string
          id?: string
          is_primary?: boolean
          sort_order?: number
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_photos_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          access_code: string | null
          accessibility_info: string | null
          address_line1: string | null
          address_line2: string | null
          capacity: number | null
          city: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          contract_notify_weeks: number | null
          contract_renewal_date: string | null
          county: string | null
          created_at: string
          description: string | null
          directions: string | null
          drop_off_info: string | null
          email: string | null
          featured_order: number | null
          floor_type: string | null
          has_changing_rooms: boolean | null
          has_mirrors: boolean | null
          has_parking: boolean | null
          has_sound_system: boolean | null
          has_waiting_area: boolean
          hero_image: string | null
          hire_cost_notes: string | null
          hire_cost_per_day: number | null
          hire_cost_per_hour: number | null
          id: string
          is_active: boolean
          is_featured: boolean
          latitude: number | null
          longitude: number | null
          map_embed_url: string | null
          name: string
          notes: string | null
          parking_details: string | null
          phone: string | null
          photo_indoor: string | null
          photo_outside: string | null
          photo_parking: string | null
          postcode: string | null
          publicly_visible: boolean
          short_description: string | null
          slug: string | null
          status: string
          updated_at: string
          website_url: string | null
          what3words: string | null
          wifi_network: string | null
          wifi_password: string | null
        }
        Insert: {
          access_code?: string | null
          accessibility_info?: string | null
          address_line1?: string | null
          address_line2?: string | null
          capacity?: number | null
          city?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contract_notify_weeks?: number | null
          contract_renewal_date?: string | null
          county?: string | null
          created_at?: string
          description?: string | null
          directions?: string | null
          drop_off_info?: string | null
          email?: string | null
          featured_order?: number | null
          floor_type?: string | null
          has_changing_rooms?: boolean | null
          has_mirrors?: boolean | null
          has_parking?: boolean | null
          has_sound_system?: boolean | null
          has_waiting_area?: boolean
          hero_image?: string | null
          hire_cost_notes?: string | null
          hire_cost_per_day?: number | null
          hire_cost_per_hour?: number | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          latitude?: number | null
          longitude?: number | null
          map_embed_url?: string | null
          name: string
          notes?: string | null
          parking_details?: string | null
          phone?: string | null
          photo_indoor?: string | null
          photo_outside?: string | null
          photo_parking?: string | null
          postcode?: string | null
          publicly_visible?: boolean
          short_description?: string | null
          slug?: string | null
          status?: string
          updated_at?: string
          website_url?: string | null
          what3words?: string | null
          wifi_network?: string | null
          wifi_password?: string | null
        }
        Update: {
          access_code?: string | null
          accessibility_info?: string | null
          address_line1?: string | null
          address_line2?: string | null
          capacity?: number | null
          city?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contract_notify_weeks?: number | null
          contract_renewal_date?: string | null
          county?: string | null
          created_at?: string
          description?: string | null
          directions?: string | null
          drop_off_info?: string | null
          email?: string | null
          featured_order?: number | null
          floor_type?: string | null
          has_changing_rooms?: boolean | null
          has_mirrors?: boolean | null
          has_parking?: boolean | null
          has_sound_system?: boolean | null
          has_waiting_area?: boolean
          hero_image?: string | null
          hire_cost_notes?: string | null
          hire_cost_per_day?: number | null
          hire_cost_per_hour?: number | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          latitude?: number | null
          longitude?: number | null
          map_embed_url?: string | null
          name?: string
          notes?: string | null
          parking_details?: string | null
          phone?: string | null
          photo_indoor?: string | null
          photo_outside?: string | null
          photo_parking?: string | null
          postcode?: string | null
          publicly_visible?: boolean
          short_description?: string | null
          slug?: string | null
          status?: string
          updated_at?: string
          website_url?: string | null
          what3words?: string | null
          wifi_network?: string | null
          wifi_password?: string | null
        }
        Relationships: []
      }
      workshop_media: {
        Row: {
          caption: string | null
          created_at: string
          file_path: string
          id: string
          media_type: string
          sort_order: number | null
          workshop_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          file_path: string
          id?: string
          media_type?: string
          sort_order?: number | null
          workshop_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          file_path?: string
          id?: string
          media_type?: string
          sort_order?: number | null
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_media_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      workshops: {
        Row: {
          age_max: number | null
          age_min: number | null
          capacity: number | null
          class_type: Database["public"]["Enums"]["class_type"]
          cover_image: string | null
          created_at: string
          dance_style: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          is_active: boolean
          links: string[]
          name: string
          price: number | null
          theme: string | null
          updated_at: string
          youtube_url: string | null
        }
        Insert: {
          age_max?: number | null
          age_min?: number | null
          capacity?: number | null
          class_type?: Database["public"]["Enums"]["class_type"]
          cover_image?: string | null
          created_at?: string
          dance_style?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean
          links?: string[]
          name: string
          price?: number | null
          theme?: string | null
          updated_at?: string
          youtube_url?: string | null
        }
        Update: {
          age_max?: number | null
          age_min?: number | null
          capacity?: number | null
          class_type?: Database["public"]["Enums"]["class_type"]
          cover_image?: string | null
          created_at?: string
          dance_style?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean
          links?: string[]
          name?: string
          price?: number | null
          theme?: string | null
          updated_at?: string
          youtube_url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_staff_id_for_user: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      internal_get_secret: { Args: { secret_name: string }; Returns: string }
      staff_teaches_class: {
        Args: { _class_id: string; _staff_id: string }
        Returns: boolean
      }
      staff_teaches_session: {
        Args: { _session_id: string; _staff_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "parent" | "staff"
      booking_status: "confirmed" | "pending_payment" | "cancelled"
      class_type: "children" | "adult"
      day_of_week:
        | "monday"
        | "tuesday"
        | "wednesday"
        | "thursday"
        | "friday"
        | "saturday"
        | "sunday"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "parent", "staff"],
      booking_status: ["confirmed", "pending_payment", "cancelled"],
      class_type: ["children", "adult"],
      day_of_week: [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ],
    },
  },
} as const
