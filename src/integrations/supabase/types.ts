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
      performance_records: {
        Row: {
          break_end: string | null
          break_start: string | null
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
          created_at: string
          deleted_at: string | null
          full_name: string
          hourly_rate: number | null
          iban: string | null
          id: string
          is_vat_payer: boolean
          signature_url: string | null
          swift_bic: string | null
          updated_at: string
          user_id: string
          vat_number: string | null
        }
        Insert: {
          billing_address?: string | null
          company_name?: string | null
          created_at?: string
          deleted_at?: string | null
          full_name: string
          hourly_rate?: number | null
          iban?: string | null
          id?: string
          is_vat_payer?: boolean
          signature_url?: string | null
          swift_bic?: string | null
          updated_at?: string
          user_id: string
          vat_number?: string | null
        }
        Update: {
          billing_address?: string | null
          company_name?: string | null
          created_at?: string
          deleted_at?: string | null
          full_name?: string
          hourly_rate?: number | null
          iban?: string | null
          id?: string
          is_vat_payer?: boolean
          signature_url?: string | null
          swift_bic?: string | null
          updated_at?: string
          user_id?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          client: string
          created_at: string
          deleted_at: string | null
          id: string
          is_active: boolean
          location: string | null
          name: string
          updated_at: string
        }
        Insert: {
          client: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          client?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
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
    }
    Enums: {
      app_role: "monter" | "manager" | "admin" | "accountant"
      closing_status: "open" | "submitted" | "approved" | "locked"
      record_status:
        | "draft"
        | "submitted"
        | "approved"
        | "rejected"
        | "returned"
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
      app_role: ["monter", "manager", "admin", "accountant"],
      closing_status: ["open", "submitted", "approved", "locked"],
      record_status: ["draft", "submitted", "approved", "rejected", "returned"],
    },
  },
} as const
