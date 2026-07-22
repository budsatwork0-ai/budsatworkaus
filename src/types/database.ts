// Supabase Database Types
// These types should be regenerated using `supabase gen types typescript` after schema changes.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string;
          full_name: string;
          email: string | null;
          phone: string | null;
          region: string | null;
          company_name: string | null;
          abn: string | null;
          default_address: string | null;
          latitude: number | null;
          longitude: number | null;
          environment: 'production' | 'sandbox';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          email?: string | null;
          phone?: string | null;
          region?: string | null;
          company_name?: string | null;
          abn?: string | null;
          default_address?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          environment?: 'production' | 'sandbox';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          email?: string | null;
          phone?: string | null;
          region?: string | null;
          company_name?: string | null;
          abn?: string | null;
          default_address?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          environment?: 'production' | 'sandbox';
          created_at?: string;
          updated_at?: string;
        };
      };
      orders: {
        Row: {
          id: string;
          quote_id: string | null;
          customer_id: string | null;
          customer_name: string;
          customer_email: string | null;
          customer_phone: string | null;
          service_type: string;
          context: string;
          scope: string | null;
          frequency: string;
          analytics_session_id: string | null;
          base_price: number;
          discount_percent: number;
          final_price: number;
          scheduled_date: string | null;
          scheduled_time: string | null;
          estimated_duration_minutes: number;
          assigned_crew_id: string | null;
          day_before_reminder_sent: boolean;
          status: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
          auto_completed_at: string | null;
          stripe_checkout_session_id: string | null;
          stripe_payment_intent_id: string | null;
          environment: 'production' | 'sandbox';
        };
        Insert: {
          id?: string;
          quote_id?: string | null;
          customer_id?: string | null;
          customer_name: string;
          customer_email?: string | null;
          customer_phone?: string | null;
          service_type: string;
          context: string;
          scope?: string | null;
          frequency?: string;
          analytics_session_id?: string | null;
          base_price: number;
          discount_percent?: number;
          final_price: number;
          scheduled_date?: string | null;
          scheduled_time?: string | null;
          estimated_duration_minutes?: number;
          assigned_crew_id?: string | null;
          day_before_reminder_sent?: boolean;
          status?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
          auto_completed_at?: string | null;
          stripe_checkout_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          environment?: 'production' | 'sandbox';
        };
        Update: {
          id?: string;
          quote_id?: string | null;
          customer_id?: string | null;
          customer_name?: string;
          customer_email?: string | null;
          customer_phone?: string | null;
          service_type?: string;
          context?: string;
          scope?: string | null;
          frequency?: string;
          analytics_session_id?: string | null;
          base_price?: number;
          discount_percent?: number;
          final_price?: number;
          scheduled_date?: string | null;
          scheduled_time?: string | null;
          estimated_duration_minutes?: number;
          assigned_crew_id?: string | null;
          day_before_reminder_sent?: boolean;
          status?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
          auto_completed_at?: string | null;
          stripe_checkout_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          environment?: 'production' | 'sandbox';
        };
      };
      subscriptions: {
        Row: {
          id: string;
          customer_id: string | null;
          customer_name: string;
          customer_email: string | null;
          customer_phone: string | null;
          service_type: string;
          context: string;
          scope: string | null;
          frequency: string;
          base_price: number;
          discount_percent: number;
          price_per_cycle: number;
          status: string;
          start_date: string;
          next_service_date: string | null;
          last_service_date: string | null;
          end_date: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id?: string | null;
          customer_name: string;
          customer_email?: string | null;
          customer_phone?: string | null;
          service_type: string;
          context: string;
          scope?: string | null;
          frequency: string;
          base_price: number;
          discount_percent?: number;
          price_per_cycle: number;
          status?: string;
          start_date: string;
          next_service_date?: string | null;
          last_service_date?: string | null;
          end_date?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string | null;
          customer_name?: string;
          customer_email?: string | null;
          customer_phone?: string | null;
          service_type?: string;
          context?: string;
          scope?: string | null;
          frequency?: string;
          base_price?: number;
          discount_percent?: number;
          price_per_cycle?: number;
          status?: string;
          start_date?: string;
          next_service_date?: string | null;
          last_service_date?: string | null;
          end_date?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      subscription_orders: {
        Row: {
          id: string;
          subscription_id: string | null;
          order_id: string | null;
          service_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          subscription_id?: string | null;
          order_id?: string | null;
          service_date: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          subscription_id?: string | null;
          order_id?: string | null;
          service_date?: string;
          created_at?: string;
        };
      };
      rego_cache: {
        Row: {
          id: string;
          plate: string;
          state: string;
          make: string | null;
          model: string | null;
          year: number | null;
          body_type: string | null;
          category: string | null;
          raw_response: Json | null;
          cached_at: string;
          expires_at: string | null;
        };
        Insert: {
          id?: string;
          plate: string;
          state: string;
          make?: string | null;
          model?: string | null;
          year?: number | null;
          body_type?: string | null;
          category?: string | null;
          raw_response?: Json | null;
          cached_at?: string;
          expires_at?: string | null;
        };
        Update: {
          id?: string;
          plate?: string;
          state?: string;
          make?: string | null;
          model?: string | null;
          year?: number | null;
          body_type?: string | null;
          category?: string | null;
          raw_response?: Json | null;
          cached_at?: string;
          expires_at?: string | null;
        };
      };
      vehicle_overrides: {
        Row: {
          id: string;
          make: string;
          model_pattern: string;
          category: string;
          priority: number;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          make: string;
          model_pattern: string;
          category: string;
          priority?: number;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          make?: string;
          model_pattern?: string;
          category?: string;
          priority?: number;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      site_settings: {
        Row: {
          key: string;
          value: Json;
          description: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          key: string;
          value: Json;
          description?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          key?: string;
          value?: Json;
          description?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
      };
      payables: {
        Row: {
          id: string;
          vendor_name: string;
          description: string | null;
          category: string;
          amount: number;
          due_date: string | null;
          paid_date: string | null;
          status: string;
          invoice_number: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vendor_name: string;
          description?: string | null;
          category: string;
          amount: number;
          due_date?: string | null;
          paid_date?: string | null;
          status?: string;
          invoice_number?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          vendor_name?: string;
          description?: string | null;
          category?: string;
          amount?: number;
          due_date?: string | null;
          paid_date?: string | null;
          status?: string;
          invoice_number?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      applicants: {
        Row: {
          id: string;
          role: string;
          stage: string;
          full_name: string;
          email: string;
          phone: string | null;
          suburb: string | null;
          availability: string[] | null;
          services: string[] | null;
          needs_transport: boolean;
          pickup_suburb: string | null;
          max_ride_minutes: number | null;
          ndis_participant: boolean;
          ndis_number: string | null;
          ndis_funding_type: string | null;
          support_coordinator_contact: string | null;
          mobility_aid: string | null;
          ride_preferences: string | null;
          car_compliant: boolean;
          all_clearances: boolean;
          resume: string | null;
          abn: string | null;
          years_experience: number | null;
          seats_available: number | null;
          boot_space: string | null;
          can_carry_aid: string | null;
          pickup_radius_km: number | null;
          quality_business_name: string | null;
          quality_contribution_types: string[] | null;
          quality_message: string | null;
          innovation_organisation: string | null;
          innovation_interest_areas: string[] | null;
          innovation_notes: string | null;
          owner: string | null;
          notes: string | null;
          missing_docs: string[] | null;
          sla_deadline: string | null;
          user_id: string | null;
          consent: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          role: string;
          stage?: string;
          full_name: string;
          email: string;
          user_id?: string | null;
          phone?: string | null;
          suburb?: string | null;
          availability?: string[] | null;
          services?: string[] | null;
          needs_transport?: boolean;
          pickup_suburb?: string | null;
          max_ride_minutes?: number | null;
          ndis_participant?: boolean;
          ndis_number?: string | null;
          ndis_funding_type?: string | null;
          support_coordinator_contact?: string | null;
          mobility_aid?: string | null;
          ride_preferences?: string | null;
          car_compliant?: boolean;
          all_clearances?: boolean;
          resume?: string | null;
          abn?: string | null;
          years_experience?: number | null;
          seats_available?: number | null;
          boot_space?: string | null;
          can_carry_aid?: string | null;
          pickup_radius_km?: number | null;
          quality_business_name?: string | null;
          quality_contribution_types?: string[] | null;
          quality_message?: string | null;
          innovation_organisation?: string | null;
          innovation_interest_areas?: string[] | null;
          innovation_notes?: string | null;
          owner?: string | null;
          notes?: string | null;
          missing_docs?: string[] | null;
          sla_deadline?: string | null;
          consent?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          role?: string;
          stage?: string;
          full_name?: string;
          email?: string;
          user_id?: string | null;
          phone?: string | null;
          suburb?: string | null;
          availability?: string[] | null;
          services?: string[] | null;
          needs_transport?: boolean;
          pickup_suburb?: string | null;
          max_ride_minutes?: number | null;
          ndis_participant?: boolean;
          ndis_number?: string | null;
          ndis_funding_type?: string | null;
          support_coordinator_contact?: string | null;
          mobility_aid?: string | null;
          ride_preferences?: string | null;
          car_compliant?: boolean;
          all_clearances?: boolean;
          resume?: string | null;
          abn?: string | null;
          years_experience?: number | null;
          seats_available?: number | null;
          boot_space?: string | null;
          can_carry_aid?: string | null;
          pickup_radius_km?: number | null;
          quality_business_name?: string | null;
          quality_contribution_types?: string[] | null;
          quality_message?: string | null;
          innovation_organisation?: string | null;
          innovation_interest_areas?: string[] | null;
          innovation_notes?: string | null;
          owner?: string | null;
          notes?: string | null;
          missing_docs?: string[] | null;
          sla_deadline?: string | null;
          consent?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      payments: {
        Row: {
          id: string;
          order_id: string | null;
          subscription_id: string | null;
          customer_id: string | null;
          amount: number;
          payment_method: string;
          payment_reference: string | null;
          payment_provider: 'manual' | 'stripe' | 'paypal';
          provider_event_id: string | null;
          currency: string;
          environment: 'production' | 'sandbox';
          status: string;
          paid_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id?: string | null;
          subscription_id?: string | null;
          customer_id?: string | null;
          amount: number;
          payment_method: string;
          payment_reference?: string | null;
          payment_provider?: 'manual' | 'stripe' | 'paypal';
          provider_event_id?: string | null;
          currency?: string;
          environment?: 'production' | 'sandbox';
          status?: string;
          paid_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string | null;
          subscription_id?: string | null;
          customer_id?: string | null;
          amount?: number;
          payment_method?: string;
          payment_reference?: string | null;
          payment_provider?: 'manual' | 'stripe' | 'paypal';
          provider_event_id?: string | null;
          currency?: string;
          environment?: 'production' | 'sandbox';
          status?: string;
          paid_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      payment_refunds: {
        Row: {
          id: string;
          payment_id: string;
          environment: 'production' | 'sandbox';
          provider: 'manual' | 'stripe' | 'paypal';
          provider_refund_reference: string;
          provider_event_reference: string | null;
          amount: number;
          currency: string;
          status: 'pending' | 'succeeded' | 'failed' | 'cancelled';
          reason: string | null;
          provider_created_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          payment_id: string;
          environment: 'production' | 'sandbox';
          provider: 'manual' | 'stripe' | 'paypal';
          provider_refund_reference: string;
          provider_event_reference?: string | null;
          amount: number;
          currency: string;
          status: 'pending' | 'succeeded' | 'failed' | 'cancelled';
          reason?: string | null;
          provider_created_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: 'pending' | 'succeeded' | 'failed' | 'cancelled';
          reason?: string | null;
          updated_at?: string;
        };
      };
      payment_refund_events: {
        Row: {
          id: string;
          payment_refund_id: string;
          provider: 'manual' | 'stripe' | 'paypal';
          provider_event_reference: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          payment_refund_id: string;
          provider: 'manual' | 'stripe' | 'paypal';
          provider_event_reference: string;
          created_at?: string;
        };
        Update: Record<string, never>;
      };
      payment_provider_objects: {
        Row: {
          id: string; payment_id: string; environment: 'production' | 'sandbox';
          provider: 'manual' | 'stripe' | 'paypal';
          object_type: 'checkout_session' | 'payment_intent' | 'charge' | 'paypal_order' | 'paypal_capture';
          object_id: string; created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; payment_id: string; environment: 'production' | 'sandbox';
          provider: 'manual' | 'stripe' | 'paypal';
          object_type: 'checkout_session' | 'payment_intent' | 'charge' | 'paypal_order' | 'paypal_capture';
          object_id: string; created_at?: string; updated_at?: string;
        };
        Update: Record<string, never>;
      };
      payment_events: {
        Row: {
          id: string; payment_id: string | null; environment: 'production' | 'sandbox' | null;
          provider: 'manual' | 'stripe' | 'paypal'; provider_event_id: string;
          event_type: string; provider_object_type: string | null; provider_object_id: string | null;
          status: 'pending' | 'processed' | 'failed' | 'quarantined'; failure_reason: string | null;
          first_seen_at: string; processed_at: string | null; updated_at: string;
        };
        Insert: {
          id?: string; payment_id?: string | null; environment?: 'production' | 'sandbox' | null;
          provider: 'manual' | 'stripe' | 'paypal'; provider_event_id: string;
          event_type: string; provider_object_type?: string | null; provider_object_id?: string | null;
          status?: 'pending' | 'processed' | 'failed' | 'quarantined'; failure_reason?: string | null;
          first_seen_at?: string; processed_at?: string | null; updated_at?: string;
        };
        Update: {
          payment_id?: string | null; environment?: 'production' | 'sandbox' | null;
          status?: 'pending' | 'processed' | 'failed' | 'quarantined'; failure_reason?: string | null;
          processed_at?: string | null; updated_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string | null;
          role: string;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          email?: string | null;
          role?: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          email?: string | null;
          role?: string;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      employees: {
        Row: {
          id: string;
          user_id: string;
          full_name: string;
          email: string;
          phone: string | null;
          suburb: string | null;
          photo_url: string | null;
          availability: string[] | null;
          services: string[] | null;
          bio: string | null;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
          onboarding_complete: boolean;
          crew_access_approved: boolean;
          ndis_worker: boolean;
          hourly_rate: number;
          default_role: string | null;
          employment_type: string;
          roster_active: boolean;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          full_name: string;
          email: string;
          phone?: string | null;
          suburb?: string | null;
          photo_url?: string | null;
          availability?: string[] | null;
          services?: string[] | null;
          bio?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          onboarding_complete?: boolean;
          crew_access_approved?: boolean;
          ndis_worker?: boolean;
          hourly_rate?: number;
          default_role?: string | null;
          employment_type?: string;
          roster_active?: boolean;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          full_name?: string;
          email?: string;
          phone?: string | null;
          suburb?: string | null;
          photo_url?: string | null;
          availability?: string[] | null;
          services?: string[] | null;
          bio?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          onboarding_complete?: boolean;
          crew_access_approved?: boolean;
          ndis_worker?: boolean;
          hourly_rate?: number;
          default_role?: string | null;
          employment_type?: string;
          roster_active?: boolean;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      job_assignments: {
        Row: {
          id: string;
          order_id: string;
          employee_id: string;
          status: string;
          accepted_at: string | null;
          started_at: string | null;
          completed_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          employee_id: string;
          status?: string;
          accepted_at?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          employee_id?: string;
          status?: string;
          accepted_at?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      checklist_templates: {
        Row: {
          id: string;
          service_type: string;
          name: string;
          items: Json;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          service_type: string;
          name: string;
          items?: Json;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          service_type?: string;
          name?: string;
          items?: Json;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      job_completions: {
        Row: {
          id: string;
          assignment_id: string;
          checklist_responses: Json;
          notes: string | null;
          photos: string[] | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          assignment_id: string;
          checklist_responses?: Json;
          notes?: string | null;
          photos?: string[] | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          assignment_id?: string;
          checklist_responses?: Json;
          notes?: string | null;
          photos?: string[] | null;
          completed_at?: string | null;
          created_at?: string;
        };
      };
      employee_documents: {
        Row: {
          id: string;
          employee_id: string;
          doc_type: string;
          file_url: string;
          file_name: string | null;
          status: string;
          expires_at: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          doc_type: string;
          file_url: string;
          file_name?: string | null;
          status?: string;
          expires_at?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          employee_id?: string;
          doc_type?: string;
          file_url?: string;
          file_name?: string | null;
          status?: string;
          expires_at?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      employee_onboarding: {
        Row: {
          id: string;
          employee_id: string;
          section: string;
          responses: Json;
          completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          section: string;
          responses?: Json;
          completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          employee_id?: string;
          section?: string;
          responses?: Json;
          completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      audit_log: {
        Row: {
          id: string;
          entity_type: string;
          entity_id: string;
          action: string;
          old_value: Json | null;
          new_value: Json | null;
          source: string | null;
          user_email: string | null;
          details: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          entity_type: string;
          entity_id: string;
          action: string;
          old_value?: Json | null;
          new_value?: Json | null;
          source?: string | null;
          user_email?: string | null;
          details?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          entity_type?: string;
          entity_id?: string;
          action?: string;
          old_value?: Json | null;
          new_value?: Json | null;
          source?: string | null;
          user_email?: string | null;
          details?: string | null;
          created_at?: string;
        };
      };
      quotes: {
        Row: {
          id: string;
          customer_id: string | null;
          customer_name: string;
          customer_email: string | null;
          customer_phone: string | null;
          service_type: string;
          context: string;
          scope: string | null;
          service_address: string | null;
          frequency: string;
          analytics_session_id: string | null;
          total: number;
          submitted_total: number;
          reviewed_total: number | null;
          status: string;
          payment_status: string;
          payment_requested_at: string | null;
          paid_at: string | null;
          finalized_at: string | null;
          finalized_by: string | null;
          cancellation_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          stripe_checkout_session_id: string | null;
          stripe_checkout_url: string | null;
          stripe_payment_intent_id: string | null;
          last_reminder_sent_at: string | null;
          last_discount_offer_sent_at: string | null;
          notes: string | null;
          converted_order_id: string | null;
          converted_subscription_id: string | null;
          environment: 'production' | 'sandbox';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id?: string | null;
          customer_name: string;
          customer_email?: string | null;
          customer_phone?: string | null;
          service_type: string;
          context?: string;
          scope?: string | null;
          service_address?: string | null;
          frequency?: string;
          analytics_session_id?: string | null;
          total?: number;
          submitted_total?: number;
          reviewed_total?: number | null;
          status?: string;
          payment_status?: string;
          payment_requested_at?: string | null;
          paid_at?: string | null;
          finalized_at?: string | null;
          finalized_by?: string | null;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          stripe_checkout_session_id?: string | null;
          stripe_checkout_url?: string | null;
          stripe_payment_intent_id?: string | null;
          last_reminder_sent_at?: string | null;
          last_discount_offer_sent_at?: string | null;
          notes?: string | null;
          converted_order_id?: string | null;
          converted_subscription_id?: string | null;
          environment?: 'production' | 'sandbox';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string | null;
          customer_name?: string;
          customer_email?: string | null;
          customer_phone?: string | null;
          service_type?: string;
          context?: string;
          scope?: string | null;
          service_address?: string | null;
          frequency?: string;
          analytics_session_id?: string | null;
          total?: number;
          submitted_total?: number;
          reviewed_total?: number | null;
          status?: string;
          payment_status?: string;
          payment_requested_at?: string | null;
          paid_at?: string | null;
          finalized_at?: string | null;
          finalized_by?: string | null;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          stripe_checkout_session_id?: string | null;
          stripe_checkout_url?: string | null;
          stripe_payment_intent_id?: string | null;
          last_reminder_sent_at?: string | null;
          last_discount_offer_sent_at?: string | null;
          notes?: string | null;
          converted_order_id?: string | null;
          converted_subscription_id?: string | null;
          environment?: 'production' | 'sandbox';
          created_at?: string;
          updated_at?: string;
        };
      };
      ratings: {
        Row: {
          id: string;
          order_id: string;
          customer_id: string | null;
          rating: number;
          comment: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          customer_id?: string | null;
          rating: number;
          comment?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          customer_id?: string | null;
          rating?: number;
          comment?: string | null;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      cleanup_expired_rego_cache: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      calculate_outstanding_receivables: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      calculate_pending_payables: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      get_revenue_by_service: {
        Args: {
          start_date: string;
          end_date: string;
        };
        Returns: {
          service_type: string;
          total_revenue: number;
          order_count: number;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

// Convenience type aliases
export type Customer = Database['public']['Tables']['customers']['Row'];
export type Order = Database['public']['Tables']['orders']['Row'];
export type Subscription = Database['public']['Tables']['subscriptions']['Row'];
export type SubscriptionOrder = Database['public']['Tables']['subscription_orders']['Row'];
export type RegoCache = Database['public']['Tables']['rego_cache']['Row'];
export type VehicleOverride = Database['public']['Tables']['vehicle_overrides']['Row'];
export type SiteSetting = Database['public']['Tables']['site_settings']['Row'];
export type Payable = Database['public']['Tables']['payables']['Row'];
export type Payment = Database['public']['Tables']['payments']['Row'];
export type PaymentRefund = Database['public']['Tables']['payment_refunds']['Row'];

// Insert types
export type CustomerInsert = Database['public']['Tables']['customers']['Insert'];
export type OrderInsert = Database['public']['Tables']['orders']['Insert'];
export type SubscriptionInsert = Database['public']['Tables']['subscriptions']['Insert'];
export type PayableInsert = Database['public']['Tables']['payables']['Insert'];
export type PaymentInsert = Database['public']['Tables']['payments']['Insert'];

// Update types
export type CustomerUpdate = Database['public']['Tables']['customers']['Update'];
export type OrderUpdate = Database['public']['Tables']['orders']['Update'];
export type SubscriptionUpdate = Database['public']['Tables']['subscriptions']['Update'];
export type PayableUpdate = Database['public']['Tables']['payables']['Update'];

// Applicant types
export type Applicant = Database['public']['Tables']['applicants']['Row'];
export type ApplicantInsert = Database['public']['Tables']['applicants']['Insert'];
export type ApplicantUpdate = Database['public']['Tables']['applicants']['Update'];

// Profile types
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

// Employee / Crew types
export type Employee = Database['public']['Tables']['employees']['Row'];
export type EmployeeInsert = Database['public']['Tables']['employees']['Insert'];
export type EmployeeUpdate = Database['public']['Tables']['employees']['Update'];

export type JobAssignment = Database['public']['Tables']['job_assignments']['Row'];
export type JobAssignmentInsert = Database['public']['Tables']['job_assignments']['Insert'];
export type JobAssignmentUpdate = Database['public']['Tables']['job_assignments']['Update'];

export type ChecklistTemplate = Database['public']['Tables']['checklist_templates']['Row'];
export type ChecklistTemplateInsert = Database['public']['Tables']['checklist_templates']['Insert'];
export type ChecklistTemplateUpdate = Database['public']['Tables']['checklist_templates']['Update'];

export type JobCompletion = Database['public']['Tables']['job_completions']['Row'];
export type JobCompletionInsert = Database['public']['Tables']['job_completions']['Insert'];

export type EmployeeDocument = Database['public']['Tables']['employee_documents']['Row'];
export type EmployeeDocumentInsert = Database['public']['Tables']['employee_documents']['Insert'];
export type EmployeeDocumentUpdate = Database['public']['Tables']['employee_documents']['Update'];

export type EmployeeOnboarding = Database['public']['Tables']['employee_onboarding']['Row'];
export type EmployeeOnboardingInsert = Database['public']['Tables']['employee_onboarding']['Insert'];
export type EmployeeOnboardingUpdate = Database['public']['Tables']['employee_onboarding']['Update'];

// Audit Log types
export type AuditLog = Database['public']['Tables']['audit_log']['Row'];
export type AuditLogInsert = Database['public']['Tables']['audit_log']['Insert'];

// Quote types
export type Quote = Database['public']['Tables']['quotes']['Row'];
export type QuoteInsert = Database['public']['Tables']['quotes']['Insert'];
export type QuoteUpdate = Database['public']['Tables']['quotes']['Update'];

// Rating types
export type Rating = Database['public']['Tables']['ratings']['Row'];
export type RatingInsert = Database['public']['Tables']['ratings']['Insert'];
