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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          admin_email: string | null
          admin_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          target_email: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_email?: string | null
          admin_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          target_email?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_email?: string | null
          admin_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          target_email?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      admin_emails: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      analyses: {
        Row: {
          blueprint_data: Json | null
          created_at: string
          id: string
          idea: string
          idea_hash: string | null
          overall_score: number | null
          report_data: Json | null
          signal_strength: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          blueprint_data?: Json | null
          created_at?: string
          id?: string
          idea: string
          idea_hash?: string | null
          overall_score?: number | null
          report_data?: Json | null
          signal_strength?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          blueprint_data?: Json | null
          created_at?: string
          id?: string
          idea?: string
          idea_hash?: string | null
          overall_score?: number | null
          report_data?: Json | null
          signal_strength?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string | null
          event_name: string
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_name: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_name?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      contact_log: {
        Row: {
          contact_type: string
          created_at: string
          id: string
          notes: string | null
          outcome: string | null
          property_id: string
          user_id: string
        }
        Insert: {
          contact_type: string
          created_at?: string
          id?: string
          notes?: string | null
          outcome?: string | null
          property_id: string
          user_id: string
        }
        Update: {
          contact_type?: string
          created_at?: string
          id?: string
          notes?: string | null
          outcome?: string | null
          property_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_log_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      credits_log: {
        Row: {
          amount: number
          analysis_id: string | null
          created_at: string
          id: string
          property_id: string | null
          reason: string
          user_id: string
        }
        Insert: {
          amount: number
          analysis_id?: string | null
          created_at?: string
          id?: string
          property_id?: string | null
          reason: string
          user_id: string
        }
        Update: {
          amount?: number
          analysis_id?: string | null
          created_at?: string
          id?: string
          property_id?: string | null
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credits_log_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credits_log_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      feedback: {
        Row: {
          admin_notes: string | null
          category: string
          created_at: string
          id: string
          message: string
          status: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          category?: string
          created_at?: string
          id?: string
          message: string
          status?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          category?: string
          created_at?: string
          id?: string
          message?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      live_feed_snapshots: {
        Row: {
          created_at: string
          data_payload: Json
          id: string
          section_name: string
        }
        Insert: {
          created_at?: string
          data_payload?: Json
          id?: string
          section_name: string
        }
        Update: {
          created_at?: string
          data_payload?: Json
          id?: string
          section_name?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          title: string
          user_id: string
          watchlist_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          title: string
          user_id: string
          watchlist_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          title?: string
          user_id?: string
          watchlist_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_watchlist_id_fkey"
            columns: ["watchlist_id"]
            isOneToOne: false
            referencedRelation: "watchlist"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_contacts: {
        Row: {
          created_at: string
          emails: Json | null
          id: string
          mailing_address: Json | null
          owner_name: string | null
          phones: Json | null
          property_id: string
          skip_trace_source: string | null
          traced_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          emails?: Json | null
          id?: string
          mailing_address?: Json | null
          owner_name?: string | null
          phones?: Json | null
          property_id: string
          skip_trace_source?: string | null
          traced_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          emails?: Json | null
          id?: string
          mailing_address?: Json | null
          owner_name?: string | null
          phones?: Json | null
          property_id?: string
          skip_trace_source?: string | null
          traced_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_contacts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_deals: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          priority: string
          property_id: string
          stage: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          priority?: string
          property_id: string
          stage?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          priority?: string
          property_id?: string
          stage?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_deals_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          credits: number
          display_name: string | null
          email: string | null
          id: string
          suspended: boolean | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          credits?: number
          display_name?: string | null
          email?: string | null
          id: string
          suspended?: boolean | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          credits?: number
          display_name?: string | null
          email?: string | null
          id?: string
          suspended?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string | null
          attom_id: string | null
          baths: number | null
          beds: number | null
          city: string | null
          created_at: string
          deal_score: number | null
          deal_verdict: string | null
          distress_details: Json | null
          distress_types: string[] | null
          equity_pct: number | null
          estimated_value: number | null
          id: string
          last_sale_date: string | null
          last_sale_price: number | null
          property_type: string | null
          report_data: Json | null
          search_batch_id: string | null
          search_filters: Json | null
          sqft: number | null
          state: string | null
          status: string
          updated_at: string
          user_id: string
          zip: string | null
        }
        Insert: {
          address?: string | null
          attom_id?: string | null
          baths?: number | null
          beds?: number | null
          city?: string | null
          created_at?: string
          deal_score?: number | null
          deal_verdict?: string | null
          distress_details?: Json | null
          distress_types?: string[] | null
          equity_pct?: number | null
          estimated_value?: number | null
          id?: string
          last_sale_date?: string | null
          last_sale_price?: number | null
          property_type?: string | null
          report_data?: Json | null
          search_batch_id?: string | null
          search_filters?: Json | null
          sqft?: number | null
          state?: string | null
          status?: string
          updated_at?: string
          user_id: string
          zip?: string | null
        }
        Update: {
          address?: string | null
          attom_id?: string | null
          baths?: number | null
          beds?: number | null
          city?: string | null
          created_at?: string
          deal_score?: number | null
          deal_verdict?: string | null
          distress_details?: Json | null
          distress_types?: string[] | null
          equity_pct?: number | null
          estimated_value?: number | null
          id?: string
          last_sale_date?: string | null
          last_sale_price?: number | null
          property_type?: string | null
          report_data?: Json | null
          search_batch_id?: string | null
          search_filters?: Json | null
          sqft?: number | null
          state?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          zip?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          approved: boolean
          body: string
          created_at: string
          display_name: string | null
          id: string
          rating: number
          title: string
          user_id: string
        }
        Insert: {
          approved?: boolean
          body: string
          created_at?: string
          display_name?: string | null
          id?: string
          rating?: number
          title: string
          user_id: string
        }
        Update: {
          approved?: boolean
          body?: string
          created_at?: string
          display_name?: string | null
          id?: string
          rating?: number
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_searches: {
        Row: {
          created_at: string
          filters: Json
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string | null
          current_period_end: string | null
          id: string
          plan: string | null
          status: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_period_end?: string | null
          id?: string
          plan?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_period_end?: string | null
          id?: string
          plan?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          email_notifications: boolean
          id: string
          updated_at: string
          user_id: string
          watchlist_alerts: boolean
          weekly_digest: boolean
        }
        Insert: {
          created_at?: string
          email_notifications?: boolean
          id?: string
          updated_at?: string
          user_id: string
          watchlist_alerts?: boolean
          weekly_digest?: boolean
        }
        Update: {
          created_at?: string
          email_notifications?: boolean
          id?: string
          updated_at?: string
          user_id?: string
          watchlist_alerts?: boolean
          weekly_digest?: boolean
        }
        Relationships: []
      }
      watchlist: {
        Row: {
          analysis_id: string
          created_at: string
          current_score: number | null
          id: string
          idea: string
          last_analyzed_at: string | null
          notes: string | null
          previous_score: number | null
          score_change: number | null
          user_id: string
        }
        Insert: {
          analysis_id: string
          created_at?: string
          current_score?: number | null
          id?: string
          idea: string
          last_analyzed_at?: string | null
          notes?: string | null
          previous_score?: number | null
          score_change?: number | null
          user_id: string
        }
        Update: {
          analysis_id?: string
          created_at?: string
          current_score?: number | null
          id?: string
          idea?: string
          last_analyzed_at?: string | null
          notes?: string | null
          previous_score?: number | null
          score_change?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      x_api_cache: {
        Row: {
          action: string
          cache_key: string
          created_at: string
          data: Json
          expires_at: string
          id: string
        }
        Insert: {
          action?: string
          cache_key: string
          created_at?: string
          data?: Json
          expires_at?: string
          id?: string
        }
        Update: {
          action?: string
          cache_key?: string
          created_at?: string
          data?: Json
          expires_at?: string
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      analyses_count_last_hour: { Args: { _user_id: string }; Returns: number }
      deduct_credit: { Args: { analysis_id?: string }; Returns: boolean }
      deduct_credit_for_property: {
        Args: { p_property_id: string }
        Returns: boolean
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
