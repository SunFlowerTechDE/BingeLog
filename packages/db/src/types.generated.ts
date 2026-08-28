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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      diary_entries: {
        Row: {
          created_at: string
          film_id: string
          id: string
          is_rewatch: boolean
          rating: number | null
          review: string | null
          updated_at: string
          user_id: string
          visibility: Database["public"]["Enums"]["entry_visibility"]
          watched_on: string | null
        }
        Insert: {
          created_at?: string
          film_id: string
          id?: string
          is_rewatch?: boolean
          rating?: number | null
          review?: string | null
          updated_at?: string
          user_id: string
          visibility?: Database["public"]["Enums"]["entry_visibility"]
          watched_on?: string | null
        }
        Update: {
          created_at?: string
          film_id?: string
          id?: string
          is_rewatch?: boolean
          rating?: number | null
          review?: string | null
          updated_at?: string
          user_id?: string
          visibility?: Database["public"]["Enums"]["entry_visibility"]
          watched_on?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diary_entries_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["wikidata_id"]
          },
          {
            foreignKeyName: "diary_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      entry_facet_ratings: {
        Row: {
          entry_id: string
          facet: Database["public"]["Enums"]["facet_kind"]
          score: number
        }
        Insert: {
          entry_id: string
          facet: Database["public"]["Enums"]["facet_kind"]
          score: number
        }
        Update: {
          entry_id?: string
          facet?: Database["public"]["Enums"]["facet_kind"]
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "entry_facet_ratings_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "diary_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      film_credits: {
        Row: {
          film_id: string
          ord: number | null
          person_id: string
          role: string
        }
        Insert: {
          film_id: string
          ord?: number | null
          person_id: string
          role: string
        }
        Update: {
          film_id?: string
          ord?: number | null
          person_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "film_credits_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["wikidata_id"]
          },
          {
            foreignKeyName: "film_credits_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["wikidata_id"]
          },
        ]
      }
      film_genres: {
        Row: {
          film_id: string
          genre_id: string
        }
        Insert: {
          film_id: string
          genre_id: string
        }
        Update: {
          film_id?: string
          genre_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "film_genres_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["wikidata_id"]
          },
          {
            foreignKeyName: "film_genres_genre_id_fkey"
            columns: ["genre_id"]
            isOneToOne: false
            referencedRelation: "genres"
            referencedColumns: ["wikidata_id"]
          },
        ]
      }
      film_threads: {
        Row: {
          film_id: string
          is_active: boolean
          is_locked: boolean
          last_activity_at: string | null
          message_count: number
          viewer_count: number
        }
        Insert: {
          film_id: string
          is_active?: boolean
          is_locked?: boolean
          last_activity_at?: string | null
          message_count?: number
          viewer_count?: number
        }
        Update: {
          film_id?: string
          is_active?: boolean
          is_locked?: boolean
          last_activity_at?: string | null
          message_count?: number
          viewer_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "film_threads_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: true
            referencedRelation: "films"
            referencedColumns: ["wikidata_id"]
          },
        ]
      }
      films: {
        Row: {
          imdb_id: string | null
          poster_source: string | null
          poster_url: string | null
          release_year: number | null
          runtime_min: number | null
          sitelink_count: number
          synopsis_de: string | null
          title_de: string | null
          title_en: string | null
          title_original: string
          tvdb_id: number | null
          updated_at: string
          wikidata_id: string
        }
        Insert: {
          imdb_id?: string | null
          poster_source?: string | null
          poster_url?: string | null
          release_year?: number | null
          runtime_min?: number | null
          sitelink_count?: number
          synopsis_de?: string | null
          title_de?: string | null
          title_en?: string | null
          title_original: string
          tvdb_id?: number | null
          updated_at?: string
          wikidata_id: string
        }
        Update: {
          imdb_id?: string | null
          poster_source?: string | null
          poster_url?: string | null
          release_year?: number | null
          runtime_min?: number | null
          sitelink_count?: number
          synopsis_de?: string | null
          title_de?: string | null
          title_en?: string | null
          title_original?: string
          tvdb_id?: number | null
          updated_at?: string
          wikidata_id?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          followee_id: string
          follower_id: string
        }
        Insert: {
          created_at?: string
          followee_id: string
          follower_id: string
        }
        Update: {
          created_at?: string
          followee_id?: string
          follower_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_followee_id_fkey"
            columns: ["followee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      genres: {
        Row: {
          label_de: string | null
          label_en: string | null
          wikidata_id: string
        }
        Insert: {
          label_de?: string | null
          label_en?: string | null
          wikidata_id: string
        }
        Update: {
          label_de?: string | null
          label_en?: string | null
          wikidata_id?: string
        }
        Relationships: []
      }
      lazy_creation_attempts: {
        Row: {
          created_at: string
          found: number
          id: number
          term: string
        }
        Insert: {
          created_at?: string
          found?: number
          id?: never
          term: string
        }
        Update: {
          created_at?: string
          found?: number
          id?: never
          term?: string
        }
        Relationships: []
      }
      people: {
        Row: {
          name: string
          sitelink_count: number
          wikidata_id: string
        }
        Insert: {
          name: string
          sitelink_count?: number
          wikidata_id: string
        }
        Update: {
          name?: string
          sitelink_count?: number
          wikidata_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_path: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          username: string
          watchlist_public: boolean
        }
        Insert: {
          avatar_path?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
          username: string
          watchlist_public?: boolean
        }
        Update: {
          avatar_path?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          username?: string
          watchlist_public?: boolean
        }
        Relationships: []
      }
      reserved_usernames: {
        Row: {
          reason: string
          username: string
        }
        Insert: {
          reason: string
          username: string
        }
        Update: {
          reason?: string
          username?: string
        }
        Relationships: []
      }
      staging_credits: {
        Row: {
          film_id: string | null
          ord: number | null
          person_id: string | null
          role: string | null
        }
        Insert: {
          film_id?: string | null
          ord?: number | null
          person_id?: string | null
          role?: string | null
        }
        Update: {
          film_id?: string | null
          ord?: number | null
          person_id?: string | null
          role?: string | null
        }
        Relationships: []
      }
      staging_film_genres: {
        Row: {
          film_id: string | null
          genre_id: string | null
        }
        Insert: {
          film_id?: string | null
          genre_id?: string | null
        }
        Update: {
          film_id?: string | null
          genre_id?: string | null
        }
        Relationships: []
      }
      staging_films: {
        Row: {
          imdb_id: string | null
          release_year: number | null
          runtime_min: number | null
          sitelink_count: number | null
          title_de: string | null
          title_en: string | null
          title_original: string | null
          wikidata_id: string
        }
        Insert: {
          imdb_id?: string | null
          release_year?: number | null
          runtime_min?: number | null
          sitelink_count?: number | null
          title_de?: string | null
          title_en?: string | null
          title_original?: string | null
          wikidata_id: string
        }
        Update: {
          imdb_id?: string | null
          release_year?: number | null
          runtime_min?: number | null
          sitelink_count?: number | null
          title_de?: string | null
          title_en?: string | null
          title_original?: string | null
          wikidata_id?: string
        }
        Relationships: []
      }
      staging_genres: {
        Row: {
          label_de: string | null
          label_en: string | null
          wikidata_id: string
        }
        Insert: {
          label_de?: string | null
          label_en?: string | null
          wikidata_id: string
        }
        Update: {
          label_de?: string | null
          label_en?: string | null
          wikidata_id?: string
        }
        Relationships: []
      }
      staging_people: {
        Row: {
          name: string | null
          sitelink_count: number | null
          wikidata_id: string
        }
        Insert: {
          name?: string | null
          sitelink_count?: number | null
          wikidata_id: string
        }
        Update: {
          name?: string | null
          sitelink_count?: number | null
          wikidata_id?: string
        }
        Relationships: []
      }
      thread_messages: {
        Row: {
          body: string
          created_at: string
          edited_at: string | null
          film_id: string
          id: string
          is_removed: boolean
          parent_id: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          edited_at?: string | null
          film_id: string
          id?: string
          is_removed?: boolean
          parent_id?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          edited_at?: string | null
          film_id?: string
          id?: string
          is_removed?: boolean
          parent_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_messages_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["wikidata_id"]
          },
          {
            foreignKeyName: "thread_messages_parent_id_film_id_fkey"
            columns: ["parent_id", "film_id"]
            isOneToOne: false
            referencedRelation: "thread_messages"
            referencedColumns: ["id", "film_id"]
          },
          {
            foreignKeyName: "thread_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlist: {
        Row: {
          added_at: string
          film_id: string
          is_hidden: boolean
          user_id: string
        }
        Insert: {
          added_at?: string
          film_id: string
          is_hidden?: boolean
          user_id: string
        }
        Update: {
          added_at?: string
          film_id?: string
          is_hidden?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["wikidata_id"]
          },
          {
            foreignKeyName: "watchlist_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      film_facet_averages: {
        Row: {
          avg_score: number | null
          facet: Database["public"]["Enums"]["facet_kind"] | null
          film_id: string | null
          vote_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "diary_entries_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["wikidata_id"]
          },
        ]
      }
    }
    Functions: {
      are_friends: { Args: { a: string; b: string }; Returns: boolean }
      claim_lazy_creation: {
        Args: { per_minute?: number; search_term: string }
        Returns: boolean
      }
      film_rating_summary: {
        Args: { film: string }
        Returns: {
          average: number
          votes: number
        }[]
      }
      film_search_text: {
        Args: { title_de: string; title_en: string; title_original: string }
        Returns: string
      }
      my_facet_ratings: {
        Args: { film: string }
        Returns: {
          facet: Database["public"]["Enums"]["facet_kind"]
          score: number
        }[]
      }
      my_friends: { Args: never; Returns: string[] }
      profile_genres: {
        Args: { max_results?: number; profile: string }
        Returns: {
          films: number
          label: string
        }[]
      }
      profile_stats: {
        Args: { profile: string }
        Returns: {
          average: number
          films: number
          first_seen: string
          ratings: number
          reviews: number
        }[]
      }
      prune_lazy_creation_attempts: { Args: never; Returns: undefined }
      refresh_film_facet_averages: { Args: never; Returns: undefined }
      search_films: {
        Args: { max_results?: number; query: string }
        Returns: {
          director: string
          poster_source: string
          poster_url: string
          release_year: number
          runtime_min: number
          score: number
          sitelink_count: number
          title_de: string
          title_en: string
          title_original: string
          wikidata_id: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      username_available: { Args: { candidate: string }; Returns: boolean }
      watchlist_is_public: { Args: { profile: string }; Returns: boolean }
    }
    Enums: {
      entry_visibility: "public" | "friends" | "private"
      facet_kind:
        | "acting"
        | "story"
        | "directing"
        | "cinematography"
        | "sound"
        | "production_design"
        | "pacing"
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
      entry_visibility: ["public", "friends", "private"],
      facet_kind: [
        "acting",
        "story",
        "directing",
        "cinematography",
        "sound",
        "production_design",
        "pacing",
      ],
    },
  },
} as const
