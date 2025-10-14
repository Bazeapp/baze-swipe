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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      candidates: {
        Row: {
          assigned_recruiter_id: string | null
          created_at: string
          email: string
          experience_years: number | null
          id: string
          job_id: string | null
          linkedin_url: string | null
          location: string | null
          name: string
          phone: string | null
          photo_url: string | null
          resume_url: string | null
          role: string
          skills: string[] | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_recruiter_id?: string | null
          created_at?: string
          email: string
          experience_years?: number | null
          id?: string
          job_id?: string | null
          linkedin_url?: string | null
          location?: string | null
          name: string
          phone?: string | null
          photo_url?: string | null
          resume_url?: string | null
          role: string
          skills?: string[] | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_recruiter_id?: string | null
          created_at?: string
          email?: string
          experience_years?: number | null
          id?: string
          job_id?: string | null
          linkedin_url?: string | null
          location?: string | null
          name?: string
          phone?: string | null
          photo_url?: string | null
          resume_url?: string | null
          role?: string
          skills?: string[] | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidates_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      decisions: {
        Row: {
          candidate_id: string
          created_at: string
          decision: string
          id: string
          recruiter_id: string
          rejection_reason: string | null
        }
        Insert: {
          candidate_id: string
          created_at?: string
          decision: string
          id?: string
          recruiter_id: string
          rejection_reason?: string | null
        }
        Update: {
          candidate_id?: string
          created_at?: string
          decision?: string
          id?: string
          recruiter_id?: string
          rejection_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "decisions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_recruiter_id_fkey"
            columns: ["recruiter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          created_at: string
          department: string | null
          description: string | null
          id: string
          requirements: string[] | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          description?: string | null
          id?: string
          requirements?: string[] | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          description?: string | null
          id?: string
          requirements?: string[] | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      lavoratori_selezionati: {
        Row: {
          airtable_id: string | null
          anni_esperienza_colf: number | null
          annuncio_luogo_riferimento_pubblico: string | null
          annuncio_nucleo_famigliare: string | null
          annuncio_orario_di_lavoro: string | null
          assigned_recruiter_id: string | null
          chi_sono: string | null
          created_at: string
          descrizione_personale: string | null
          descrizione_ricerca_famiglia: string | null
          email_processo_res_famiglia: string | null
          eta: number | null
          feedback_ai: string | null
          foto_url: string | null
          id: string
          intervista_llm_transcript_history: string | null
          job_id: string | null
          mansioni_richieste: string | null
          mansioni_richieste_transformed_ai: string | null
          nome: string
          processo_res: string | null
          riassunto_esperienze_completo: string | null
          riassunto_profilo_breve: string | null
          stato_processo_res: string | null
          stato_selezione: string | null
          status: string
          travel_time: string | null
          travel_time_flag: string | null
          travel_time_tra_cap: string | null
          updated_at: string
        }
        Insert: {
          airtable_id?: string | null
          anni_esperienza_colf?: number | null
          annuncio_luogo_riferimento_pubblico?: string | null
          annuncio_nucleo_famigliare?: string | null
          annuncio_orario_di_lavoro?: string | null
          assigned_recruiter_id?: string | null
          chi_sono?: string | null
          created_at?: string
          descrizione_personale?: string | null
          descrizione_ricerca_famiglia?: string | null
          email_processo_res_famiglia?: string | null
          eta?: number | null
          feedback_ai?: string | null
          foto_url?: string | null
          id?: string
          intervista_llm_transcript_history?: string | null
          job_id?: string | null
          mansioni_richieste?: string | null
          mansioni_richieste_transformed_ai?: string | null
          nome: string
          processo_res?: string | null
          riassunto_esperienze_completo?: string | null
          riassunto_profilo_breve?: string | null
          stato_processo_res?: string | null
          stato_selezione?: string | null
          status?: string
          travel_time?: string | null
          travel_time_flag?: string | null
          travel_time_tra_cap?: string | null
          updated_at?: string
        }
        Update: {
          airtable_id?: string | null
          anni_esperienza_colf?: number | null
          annuncio_luogo_riferimento_pubblico?: string | null
          annuncio_nucleo_famigliare?: string | null
          annuncio_orario_di_lavoro?: string | null
          assigned_recruiter_id?: string | null
          chi_sono?: string | null
          created_at?: string
          descrizione_personale?: string | null
          descrizione_ricerca_famiglia?: string | null
          email_processo_res_famiglia?: string | null
          eta?: number | null
          feedback_ai?: string | null
          foto_url?: string | null
          id?: string
          intervista_llm_transcript_history?: string | null
          job_id?: string | null
          mansioni_richieste?: string | null
          mansioni_richieste_transformed_ai?: string | null
          nome?: string
          processo_res?: string | null
          riassunto_esperienze_completo?: string | null
          riassunto_profilo_breve?: string | null
          stato_processo_res?: string | null
          stato_selezione?: string | null
          status?: string
          travel_time?: string | null
          travel_time_flag?: string | null
          travel_time_tra_cap?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lavoratori_selezionati_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "recruiter" | "user"
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
      app_role: ["admin", "recruiter", "user"],
    },
  },
} as const
