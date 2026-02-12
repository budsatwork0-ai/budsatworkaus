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
          base_price: number;
          discount_percent: number;
          final_price: number;
          scheduled_date: string | null;
          scheduled_time: string | null;
          status: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
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
          base_price: number;
          discount_percent?: number;
          final_price: number;
          scheduled_date?: string | null;
          scheduled_time?: string | null;
          status?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
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
          base_price?: number;
          discount_percent?: number;
          final_price?: number;
          scheduled_date?: string | null;
          scheduled_time?: string | null;
          status?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
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

// Insert types
export type CustomerInsert = Database['public']['Tables']['customers']['Insert'];
export type OrderInsert = Database['public']['Tables']['orders']['Insert'];
export type SubscriptionInsert = Database['public']['Tables']['subscriptions']['Insert'];
export type PayableInsert = Database['public']['Tables']['payables']['Insert'];

// Update types
export type CustomerUpdate = Database['public']['Tables']['customers']['Update'];
export type OrderUpdate = Database['public']['Tables']['orders']['Update'];
export type SubscriptionUpdate = Database['public']['Tables']['subscriptions']['Update'];
export type PayableUpdate = Database['public']['Tables']['payables']['Update'];
