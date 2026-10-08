export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      announcements: {
        Row: {
          author_id: string | null;
          body: string;
          created_at: string;
          id: string;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          author_id?: string | null;
          body: string;
          created_at?: string;
          id?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          author_id?: string | null;
          body?: string;
          created_at?: string;
          id?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "announcements_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          details: NonNullable<Json>;
          id: number;
          target_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          details?: NonNullable<Json>;
          id?: never;
          target_id?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          details?: NonNullable<Json>;
          id?: never;
          target_id?: string | null;
        };
        Relationships: [];
      };
      events: {
        Row: {
          author_id: string | null;
          created_at: string;
          description: string;
          ends_at: string | null;
          finished_at: string | null;
          finished_by: string | null;
          id: string;
          location: string;
          starts_at: string;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          author_id?: string | null;
          created_at?: string;
          description?: string;
          ends_at?: string | null;
          finished_at?: string | null;
          finished_by?: string | null;
          id?: string;
          location?: string;
          starts_at: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          author_id?: string | null;
          created_at?: string;
          description?: string;
          ends_at?: string | null;
          finished_at?: string | null;
          finished_by?: string | null;
          id?: string;
          location?: string;
          starts_at?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "events_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      map_positions: {
        Row: {
          author_id: string | null;
          declared_at: string;
          id: string;
          label: string;
          lat: number;
          lng: number;
        };
        ComputedFields: never;
        Insert: {
          author_id?: string | null;
          declared_at?: string;
          id?: string;
          label?: string;
          lat: number;
          lng: number;
        };
        Update: {
          author_id?: string | null;
          declared_at?: string;
          id?: string;
          label?: string;
          lat?: number;
          lng?: number;
        };
        Relationships: [];
      };
      map_route_versions: {
        Row: {
          author_id: string | null;
          created_at: string;
          id: string;
          point_count: number | null;
          points: Json;
        };
        ComputedFields: never;
        Insert: {
          author_id?: string | null;
          created_at?: string;
          id?: string;
          point_count?: never;
          points: Json;
        };
        Update: {
          author_id?: string | null;
          created_at?: string;
          id?: string;
          point_count?: never;
          points?: Json;
        };
        Relationships: [];
      };
      moderation_actions: {
        Row: {
          created_at: string;
          created_by: string | null;
          expires_at: string | null;
          id: string;
          kind: string;
          reason: string;
          revoked_at: string | null;
          revoked_by: string | null;
          target_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          expires_at?: string | null;
          id?: string;
          kind: string;
          reason: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          target_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          expires_at?: string | null;
          id?: string;
          kind?: string;
          reason?: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          target_id?: string;
        };
        Relationships: [];
      };
      permission_overrides: {
        Row: {
          created_at: string;
          created_by: string | null;
          effect: string;
          permission: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          effect: string;
          permission: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          effect?: string;
          permission?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "permission_overrides_permission_fkey";
            columns: ["permission"];
            isOneToOne: false;
            referencedRelation: "permissions";
            referencedColumns: ["key"];
          },
          {
            foreignKeyName: "permission_overrides_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      permissions: {
        Row: {
          description: string;
          key: string;
        };
        ComputedFields: never;
        Insert: {
          description: string;
          key: string;
        };
        Update: {
          description?: string;
          key?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          id: string;
          pseudo: string;
          role: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          id: string;
          pseudo: string;
          role?: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          id?: string;
          pseudo?: string;
          role?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_role_fkey";
            columns: ["role"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["key"];
          },
        ];
      };
      role_permissions: {
        Row: {
          permission: string;
          role: string;
        };
        ComputedFields: never;
        Insert: {
          permission: string;
          role: string;
        };
        Update: {
          permission?: string;
          role?: string;
        };
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_fkey";
            columns: ["permission"];
            isOneToOne: false;
            referencedRelation: "permissions";
            referencedColumns: ["key"];
          },
          {
            foreignKeyName: "role_permissions_role_fkey";
            columns: ["role"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["key"];
          },
        ];
      };
      roles: {
        Row: {
          key: string;
          label: string;
          rank: number;
        };
        ComputedFields: never;
        Insert: {
          key: string;
          label: string;
          rank: number;
        };
        Update: {
          key?: string;
          label?: string;
          rank?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      assign_role: { Args: { p_role: string; p_target: string }; Returns: undefined };
      ban_user: {
        Args: { p_expires_at?: string; p_reason: string; p_target: string };
        Returns: string;
      };
      custom_access_token_hook: { Args: { event: Json }; Returns: Json };
      declare_map_position: {
        Args: { p_label?: string; p_lat: number; p_lng: number };
        Returns: string;
      };
      effective_permissions: { Args: { p_user_id: string }; Returns: string[] };
      get_permission_epoch: { Args: never; Returns: string };
      has_permission: { Args: { p_permission: string; p_user_id: string }; Returns: boolean };
      is_valid_route: { Args: { p_points: Json }; Returns: boolean };
      is_banned: { Args: { p_user_id: string }; Returns: boolean };
      revoke_sanction: { Args: { p_id: string }; Returns: undefined };
      role_rank: { Args: { p_role: string }; Returns: number };
      save_map_route: { Args: { p_base?: string; p_points: Json }; Returns: string };
      set_event_finished: { Args: { p_finished: boolean; p_id: string }; Returns: undefined };
      set_role_permission: {
        Args: { p_granted: boolean; p_permission: string; p_role: string };
        Returns: undefined;
      };
      set_user_permission: {
        Args: { p_effect: string; p_permission: string; p_target: string };
        Returns: undefined;
      };
      write_audit: {
        Args: { p_action: string; p_details?: Json; p_target: string };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
