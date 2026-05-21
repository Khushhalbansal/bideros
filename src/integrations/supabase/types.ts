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
      auction_state: {
        Row: {
          current_bid: number | null
          current_player_id: string | null
          leading_team_id: string | null
          phase: Database["public"]["Enums"]["auction_phase"]
          tournament_id: string
          updated_at: string
        }
        Insert: {
          current_bid?: number | null
          current_player_id?: string | null
          leading_team_id?: string | null
          phase?: Database["public"]["Enums"]["auction_phase"]
          tournament_id: string
          updated_at?: string
        }
        Update: {
          current_bid?: number | null
          current_player_id?: string | null
          leading_team_id?: string | null
          phase?: Database["public"]["Enums"]["auction_phase"]
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auction_state_current_player_id_fkey"
            columns: ["current_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_state_leading_team_id_fkey"
            columns: ["leading_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_state_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: true
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      bids: {
        Row: {
          amount: number
          bidder_user_id: string | null
          created_at: string
          id: string
          player_id: string
          team_id: string
          tournament_id: string
        }
        Insert: {
          amount: number
          bidder_user_id?: string | null
          created_at?: string
          id?: string
          player_id: string
          team_id: string
          tournament_id: string
        }
        Update: {
          amount?: number
          bidder_user_id?: string | null
          created_at?: string
          id?: string
          player_id?: string
          team_id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bids_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          base_price: number
          category: Database["public"]["Enums"]["player_category"]
          created_at: string
          id: string
          name: string
          photo_url: string | null
          role: string | null
          sold_price: number | null
          sold_to_team_id: string | null
          stats: Json | null
          status: Database["public"]["Enums"]["player_status"]
          tournament_id: string
        }
        Insert: {
          base_price?: number
          category?: Database["public"]["Enums"]["player_category"]
          created_at?: string
          id?: string
          name: string
          photo_url?: string | null
          role?: string | null
          sold_price?: number | null
          sold_to_team_id?: string | null
          stats?: Json | null
          status?: Database["public"]["Enums"]["player_status"]
          tournament_id: string
        }
        Update: {
          base_price?: number
          category?: Database["public"]["Enums"]["player_category"]
          created_at?: string
          id?: string
          name?: string
          photo_url?: string | null
          role?: string | null
          sold_price?: number | null
          sold_to_team_id?: string | null
          stats?: Json | null
          status?: Database["public"]["Enums"]["player_status"]
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_sold_to_team_id_fkey"
            columns: ["sold_to_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
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
      teams: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          owner_email: string | null
          owner_user_id: string | null
          purse_remaining: number
          tournament_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          owner_email?: string | null
          owner_user_id?: string | null
          purse_remaining: number
          tournament_id: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          owner_email?: string | null
          owner_user_id?: string | null
          purse_remaining?: number
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          admin_id: string
          bid_increment: number
          created_at: string
          id: string
          name: string
          purse_amount: number
          spectator_slug: string
          squad_size: number
          status: Database["public"]["Enums"]["tournament_status"]
        }
        Insert: {
          admin_id: string
          bid_increment?: number
          created_at?: string
          id?: string
          name: string
          purse_amount?: number
          spectator_slug?: string
          squad_size?: number
          status?: Database["public"]["Enums"]["tournament_status"]
        }
        Update: {
          admin_id?: string
          bid_increment?: number
          created_at?: string
          id?: string
          name?: string
          purse_amount?: number
          spectator_slug?: string
          squad_size?: number
          status?: Database["public"]["Enums"]["tournament_status"]
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
      place_bid: {
        Args: { p_amount: number; p_team: string; p_tournament: string }
        Returns: Json
      }
      sell_current_player: { Args: { p_tournament: string }; Returns: Json }
    }
    Enums: {
      app_role: "super_admin" | "tournament_admin" | "team_owner"
      auction_phase: "idle" | "live" | "sold_animation"
      player_category: "iconic" | "normal"
      player_status: "available" | "sold" | "unsold"
      tournament_status: "setup" | "live" | "paused" | "ended"
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
      app_role: ["super_admin", "tournament_admin", "team_owner"],
      auction_phase: ["idle", "live", "sold_animation"],
      player_category: ["iconic", "normal"],
      player_status: ["available", "sold", "unsold"],
      tournament_status: ["setup", "live", "paused", "ended"],
    },
  },
} as const
