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
      admin_allowlist: {
        Row: {
          created_at: string | null
          email: string
          id: string
          invited_by: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          invited_by?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          invited_by?: string | null
        }
        Relationships: []
      }
      admin_invite_tokens: {
        Row: {
          created_at: string | null
          created_by: string | null
          email: string
          expires_at: string | null
          id: string
          token: string
          used: boolean | null
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          email: string
          expires_at?: string | null
          id?: string
          token?: string
          used?: boolean | null
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          token?: string
          used?: boolean | null
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      auction_state: {
        Row: {
          current_highest_bid: number | null
          current_highest_team_id: string | null
          current_player_id: string | null
          id: string
          lot_number: number | null
          timer_ends_at: string | null
          tournament_id: string
          updated_at: string | null
        }
        Insert: {
          current_highest_bid?: number | null
          current_highest_team_id?: string | null
          current_player_id?: string | null
          id?: string
          lot_number?: number | null
          timer_ends_at?: string | null
          tournament_id: string
          updated_at?: string | null
        }
        Update: {
          current_highest_bid?: number | null
          current_highest_team_id?: string | null
          current_player_id?: string | null
          id?: string
          lot_number?: number | null
          timer_ends_at?: string | null
          tournament_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auction_state_current_highest_team_id_fkey"
            columns: ["current_highest_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_state_current_player_id_fkey"
            columns: ["current_player_id"]
            isOneToOne: false
            referencedRelation: "players"
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
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string | null
          id: string
          payload: Json | null
          tournament_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string | null
          id?: string
          payload?: Json | null
          tournament_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string | null
          id?: string
          payload?: Json | null
          tournament_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      bid_rate_limit: {
        Row: {
          count: number
          user_id: string
          window_start: string
        }
        Insert: {
          count?: number
          user_id: string
          window_start: string
        }
        Update: {
          count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      bids: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          is_winning: boolean | null
          player_id: string
          sequence_number: number
          team_id: string
          tournament_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          is_winning?: boolean | null
          player_id: string
          sequence_number?: number
          team_id: string
          tournament_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          is_winning?: boolean | null
          player_id?: string
          sequence_number?: number
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
      invite_tokens: {
        Row: {
          created_at: string | null
          email: string | null
          expires_at: string | null
          id: string
          team_id: string
          token: string
          tournament_id: string
          used: boolean | null
          used_by: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          team_id: string
          token?: string
          tournament_id: string
          used?: boolean | null
          used_by?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          team_id?: string
          token?: string
          tournament_id?: string
          used?: boolean | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invite_tokens_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_tokens_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          auction_order: number | null
          base_price: number
          created_at: string | null
          id: string
          name: string
          photo_url: string | null
          role: string | null
          sold_price: number | null
          sold_to_team_id: string | null
          stats: Json | null
          status: string
          tournament_id: string
        }
        Insert: {
          auction_order?: number | null
          base_price?: number
          created_at?: string | null
          id?: string
          name: string
          photo_url?: string | null
          role?: string | null
          sold_price?: number | null
          sold_to_team_id?: string | null
          stats?: Json | null
          status?: string
          tournament_id: string
        }
        Update: {
          auction_order?: number | null
          base_price?: number
          created_at?: string | null
          id?: string
          name?: string
          photo_url?: string | null
          role?: string | null
          sold_price?: number | null
          sold_to_team_id?: string | null
          stats?: Json | null
          status?: string
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
          color: string | null
          created_at: string | null
          id: string
          logo_url: string | null
          name: string
          owner_email: string | null
          owner_id: string | null
          owner_name: string | null
          remaining_purse: number
          tournament_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          owner_email?: string | null
          owner_id?: string | null
          owner_name?: string | null
          remaining_purse: number
          tournament_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_email?: string | null
          owner_id?: string | null
          owner_name?: string | null
          remaining_purse?: number
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
          bid_timer_seconds: number
          created_at: string | null
          id: string
          is_demo: boolean | null
          max_players_per_team: number
          min_bid_increment: number
          name: string
          purse_per_team: number
          starts_at: string | null
          status: string
        }
        Insert: {
          admin_id: string
          bid_timer_seconds?: number
          created_at?: string | null
          id?: string
          is_demo?: boolean | null
          max_players_per_team?: number
          min_bid_increment?: number
          name: string
          purse_per_team?: number
          starts_at?: string | null
          status?: string
        }
        Update: {
          admin_id?: string
          bid_timer_seconds?: number
          created_at?: string | null
          id?: string
          is_demo?: boolean | null
          max_players_per_team?: number
          min_bid_increment?: number
          name?: string
          purse_per_team?: number
          starts_at?: string | null
          status?: string
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
      accept_invite: { Args: { p_token: string }; Returns: Json }
      admin_generate_invite: { Args: { p_team: string }; Returns: Json }
      admin_list_teams: {
        Args: { p_tournament: string }
        Returns: {
          color: string
          created_at: string
          id: string
          logo_url: string
          name: string
          owner_email: string
          owner_id: string
          owner_name: string
          remaining_purse: number
          tournament_id: string
        }[]
      }
      cleanup_old_tournaments: { Args: never; Returns: number }
      close_expired_lots: { Args: never; Returns: number }
      consume_admin_invite: { Args: { p_token: string }; Returns: Json }
      end_auction: { Args: { p_tournament: string }; Returns: Json }
      get_invite_info: { Args: { p_token: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_team_owner: { Args: { _team: string }; Returns: boolean }
      is_tournament_admin: { Args: { _tid: string }; Returns: boolean }
      is_tournament_public: { Args: { _tid: string }; Returns: boolean }
      mark_unsold: { Args: { p_tournament: string }; Returns: Json }
      pause_lot: { Args: { p_tournament: string }; Returns: Json }
      place_bid: {
        Args: {
          p_amount: number
          p_player: string
          p_team: string
          p_tournament: string
        }
        Returns: Json
      }
      resume_lot: {
        Args: { p_seconds?: number; p_tournament: string }
        Returns: Json
      }
      skip_lot: { Args: { p_tournament: string }; Returns: Json }
      start_lot: {
        Args: { p_player: string; p_tournament: string }
        Returns: Json
      }
      undo_last_sale: { Args: { p_tournament: string }; Returns: Json }
      validate_admin_invite: { Args: { p_token: string }; Returns: Json }
    }
    Enums: {
      app_role: "super_admin" | "tournament_admin" | "team_owner"
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
    },
  },
} as const
