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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      accommodation_assignments: {
        Row: {
          accommodation_id: string
          check_in: string
          check_out: string | null
          created_at: string
          deleted_at: string | null
          id: string
          note: string | null
          price_per_night: number
          project_id: string | null
          total_cost: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accommodation_id: string
          check_in: string
          check_out?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          note?: string | null
          price_per_night: number
          project_id?: string | null
          total_cost?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accommodation_id?: string
          check_in?: string
          check_out?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          note?: string | null
          price_per_night?: number
          project_id?: string | null
          total_cost?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accommodation_assignments_accommodation_id_fkey"
            columns: ["accommodation_id"]
            isOneToOne: false
            referencedRelation: "accommodations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accommodation_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      accommodations: {
        Row: {
          address: string
          contact: string | null
          created_at: string
          default_price_per_night: number
          deleted_at: string | null
          id: string
          is_active: boolean
          lat: number | null
          lng: number | null
          name: string
          updated_at: string
        }
        Insert: {
          address: string
          contact?: string | null
          created_at?: string
          default_price_per_night?: number
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          name: string
          updated_at?: string
        }
        Update: {
          address?: string
          contact?: string | null
          created_at?: string
          default_price_per_night?: number
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      advances: {
        Row: {
          amount: number
          created_at: string
          date: string
          deleted_at: string | null
          id: string
          note: string | null
          updated_at: string
          used_in_invoice_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          date?: string
          deleted_at?: string | null
          id?: string
          note?: string | null
          updated_at?: string
          used_in_invoice_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          deleted_at?: string | null
          id?: string
          note?: string | null
          updated_at?: string
          used_in_invoice_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "advances_used_in_invoice_id_fkey"
            columns: ["used_in_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_reads: {
        Row: {
          announcement_id: string
          id: string
          read_at: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          id?: string
          read_at?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          message: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          message: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          message?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          advance_deduction: number | null
          created_at: string
          deleted_at: string | null
          delivery_date: string
          due_date: string
          hourly_rate: number
          id: string
          invoice_number: string
          is_accounted: boolean
          is_locked: boolean
          is_reverse_charge: boolean
          issue_date: string
          locked_at: string | null
          locked_by: string | null
          paid_at: string | null
          project_id: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_confirmed_at: string | null
          tax_confirmed_by: string | null
          tax_payment_status:
            | Database["public"]["Enums"]["tax_payment_status"]
            | null
          tax_verified_at: string | null
          tax_verified_by: string | null
          total_amount: number
          total_hours: number
          transaction_tax_amount: number | null
          transaction_tax_rate: number | null
          updated_at: string
          user_id: string
          vat_amount: number
          week_closing_id: string | null
        }
        Insert: {
          advance_deduction?: number | null
          created_at?: string
          deleted_at?: string | null
          delivery_date?: string
          due_date: string
          hourly_rate?: number
          id?: string
          invoice_number: string
          is_accounted?: boolean
          is_locked?: boolean
          is_reverse_charge?: boolean
          issue_date?: string
          locked_at?: string | null
          locked_by?: string | null
          paid_at?: string | null
          project_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_confirmed_at?: string | null
          tax_confirmed_by?: string | null
          tax_payment_status?:
            | Database["public"]["Enums"]["tax_payment_status"]
            | null
          tax_verified_at?: string | null
          tax_verified_by?: string | null
          total_amount?: number
          total_hours?: number
          transaction_tax_amount?: number | null
          transaction_tax_rate?: number | null
          updated_at?: string
          user_id: string
          vat_amount?: number
          week_closing_id?: string | null
        }
        Update: {
          advance_deduction?: number | null
          created_at?: string
          deleted_at?: string | null
          delivery_date?: string
          due_date?: string
          hourly_rate?: number
          id?: string
          invoice_number?: string
          is_accounted?: boolean
          is_locked?: boolean
          is_reverse_charge?: boolean
          issue_date?: string
          locked_at?: string | null
          locked_by?: string | null
          paid_at?: string | null
          project_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_confirmed_at?: string | null
          tax_confirmed_by?: string | null
          tax_payment_status?:
            | Database["public"]["Enums"]["tax_payment_status"]
            | null
          tax_verified_at?: string | null
          tax_verified_by?: string | null
          total_amount?: number
          total_hours?: number
          transaction_tax_amount?: number | null
          transaction_tax_rate?: number | null
          updated_at?: string
          user_id?: string
          vat_amount?: number
          week_closing_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_week_closing_id_fkey"
            columns: ["week_closing_id"]
            isOneToOne: false
            referencedRelation: "weekly_closings"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_records: {
        Row: {
          break_end: string | null
          break_start: string | null
          break2_end: string | null
          break2_start: string | null
          created_at: string
          date: string
          deleted_at: string | null
          id: string
          note: string | null
          project_id: string
          status: Database["public"]["Enums"]["record_status"]
          time_from: string
          time_to: string
          total_hours: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          break_end?: string | null
          break_start?: string | null
          break2_end?: string | null
          break2_start?: string | null
          created_at?: string
          date: string
          deleted_at?: string | null
          id?: string
          note?: string | null
          project_id: string
          status?: Database["public"]["Enums"]["record_status"]
          time_from: string
          time_to: string
          total_hours?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          break_end?: string | null
          break_start?: string | null
          break2_end?: string | null
          break2_start?: string | null
          created_at?: string
          date?: string
          deleted_at?: string | null
          id?: string
          note?: string | null
          project_id?: string
          status?: Database["public"]["Enums"]["record_status"]
          time_from?: string
          time_to?: string
          total_hours?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_records_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          billing_address: string | null
          company_name: string | null
          contract_number: string | null
          created_at: string
          deleted_at: string | null
          dic: string | null
          fixed_wage: number | null
          full_name: string
          hourly_rate: number | null
          iban: string | null
          ico: string | null
          id: string
          is_active: boolean
          is_vat_payer: boolean
          parent_user_id: string | null
          signature_url: string | null
          swift_bic: string | null
          updated_at: string
          user_id: string
          vat_number: string | null
        }
        Insert: {
          billing_address?: string | null
          company_name?: string | null
          contract_number?: string | null
          created_at?: string
          deleted_at?: string | null
          dic?: string | null
          fixed_wage?: number | null
          full_name: string
          hourly_rate?: number | null
          iban?: string | null
          ico?: string | null
          id?: string
          is_active?: boolean
          is_vat_payer?: boolean
          parent_user_id?: string | null
          signature_url?: string | null
          swift_bic?: string | null
          updated_at?: string
          user_id: string
          vat_number?: string | null
        }
        Update: {
          billing_address?: string | null
          company_name?: string | null
          contract_number?: string | null
          created_at?: string
          deleted_at?: string | null
          dic?: string | null
          fixed_wage?: number | null
          full_name?: string
          hourly_rate?: number | null
          iban?: string | null
          ico?: string | null
          id?: string
          is_active?: boolean
          is_vat_payer?: boolean
          parent_user_id?: string | null
          signature_url?: string | null
          swift_bic?: string | null
          updated_at?: string
          user_id?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      project_assignments: {
        Row: {
          created_at: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          address: string | null
          client: string
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          location: string | null
          name: string
          standard_hours: number | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          client: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          name: string
          standard_hours?: number | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          client?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          name?: string
          standard_hours?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      sanctions: {
        Row: {
          admin_id: string
          amount: number | null
          created_at: string
          deleted_at: string | null
          hours_deducted: number | null
          id: string
          invoice_id: string | null
          reason: string
          sanction_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_id: string
          amount?: number | null
          created_at?: string
          deleted_at?: string | null
          hours_deducted?: number | null
          id?: string
          invoice_id?: string | null
          reason: string
          sanction_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_id?: string
          amount?: number | null
          created_at?: string
          deleted_at?: string | null
          hours_deducted?: number | null
          id?: string
          invoice_id?: string | null
          reason?: string
          sanction_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sanctions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      weekly_closings: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          calendar_week: number
          created_at: string
          deleted_at: string | null
          id: string
          return_comment: string | null
          status: Database["public"]["Enums"]["closing_status"]
          submitted_at: string | null
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          calendar_week: number
          created_at?: string
          deleted_at?: string | null
          id?: string
          return_comment?: string | null
          status?: Database["public"]["Enums"]["closing_status"]
          submitted_at?: string | null
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          calendar_week?: number
          created_at?: string
          deleted_at?: string | null
          id?: string
          return_comment?: string | null
          status?: Database["public"]["Enums"]["closing_status"]
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_team_profiles_safe: {
        Args: { target_user_ids?: string[] }
        Returns: {
          company_name: string
          full_name: string
          id: string
          is_active: boolean
          user_id: string
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_director: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "monter" | "manager" | "admin" | "accountant" | "director"
      closing_status: "open" | "submitted" | "approved" | "returned" | "locked"
      invoice_status: "pending" | "due_soon" | "overdue" | "paid" | "void"
      record_status:
        | "draft"
        | "submitted"
        | "approved"
        | "rejected"
        | "returned"
      tax_payment_status: "pending" | "confirmed" | "verified"
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
      app_role: ["monter", "manager", "admin", "accountant", "director"],
      closing_status: ["open", "submitted", "approved", "returned", "locked"],
      invoice_status: ["pending", "due_soon", "overdue", "paid", "void"],
      record_status: ["draft", "submitted", "approved", "rejected", "returned"],
      tax_payment_status: ["pending", "confirmed", "verified"],
    },
  },
} as const
