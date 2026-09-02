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
      account_actions: {
        Row: {
          action: Database["public"]["Enums"]["account_action"]
          actor_id: string | null
          actor_name: string
          created_at: string
          details: Json | null
          id: string
          notified: boolean
          reason: string
          target_id: string
          target_name: string
        }
        Insert: {
          action: Database["public"]["Enums"]["account_action"]
          actor_id?: string | null
          actor_name: string
          created_at?: string
          details?: Json | null
          id?: string
          notified?: boolean
          reason: string
          target_id: string
          target_name: string
        }
        Update: {
          action?: Database["public"]["Enums"]["account_action"]
          actor_id?: string | null
          actor_name?: string
          created_at?: string
          details?: Json | null
          id?: string
          notified?: boolean
          reason?: string
          target_id?: string
          target_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_actions_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_actions_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          description: string
          key: string
          updated_at: string
          value: number
        }
        Insert: {
          description: string
          key: string
          updated_at?: string
          value: number
        }
        Update: {
          description?: string
          key?: string
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      diary_entries: {
        Row: {
          created_at: string
          film_id: string
          has_spoilers: boolean
          id: string
          import_batch_id: string | null
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
          has_spoilers?: boolean
          id?: string
          import_batch_id?: string | null
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
          has_spoilers?: boolean
          id?: string
          import_batch_id?: string | null
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
            foreignKeyName: "diary_entries_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
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
      favourites: {
        Row: {
          film_id: string
          position: number
          user_id: string
        }
        Insert: {
          film_id: string
          position: number
          user_id: string
        }
        Update: {
          film_id?: string
          position?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favourites_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["wikidata_id"]
          },
          {
            foreignKeyName: "favourites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          locked_at: string | null
          locked_by: string | null
          locked_reason: string | null
          message_count: number
          viewer_count: number
        }
        Insert: {
          film_id: string
          is_active?: boolean
          is_locked?: boolean
          last_activity_at?: string | null
          locked_at?: string | null
          locked_by?: string | null
          locked_reason?: string | null
          message_count?: number
          viewer_count?: number
        }
        Update: {
          film_id?: string
          is_active?: boolean
          is_locked?: boolean
          last_activity_at?: string | null
          locked_at?: string | null
          locked_by?: string | null
          locked_reason?: string | null
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
          {
            foreignKeyName: "film_threads_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      films: {
        Row: {
          created_at: string | null
          edited_at: string | null
          edited_by: string | null
          fsk: number | null
          fsk_note: string | null
          imdb_id: string | null
          manual_fields: string[]
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
          created_at?: string | null
          edited_at?: string | null
          edited_by?: string | null
          fsk?: number | null
          fsk_note?: string | null
          imdb_id?: string | null
          manual_fields?: string[]
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
          created_at?: string | null
          edited_at?: string | null
          edited_by?: string | null
          fsk?: number | null
          fsk_note?: string | null
          imdb_id?: string | null
          manual_fields?: string[]
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
        Relationships: [
          {
            foreignKeyName: "films_edited_by_fkey"
            columns: ["edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          category_id: string | null
          is_category: boolean
          label_de: string | null
          label_en: string | null
          wikidata_id: string
        }
        Insert: {
          category_id?: string | null
          is_category?: boolean
          label_de?: string | null
          label_en?: string | null
          wikidata_id: string
        }
        Update: {
          category_id?: string | null
          is_category?: boolean
          label_de?: string | null
          label_en?: string | null
          wikidata_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "genres_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "genres"
            referencedColumns: ["wikidata_id"]
          },
        ]
      }
      import_batches: {
        Row: {
          completed_at: string | null
          created_at: string
          error: string | null
          failed_items: number
          films_known: number
          films_new: number
          id: string
          processed_items: number
          source: Database["public"]["Enums"]["import_source"]
          started_at: string | null
          status: Database["public"]["Enums"]["import_status"]
          successful_items: number
          total_items: number
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          failed_items?: number
          films_known?: number
          films_new?: number
          id?: string
          processed_items?: number
          source?: Database["public"]["Enums"]["import_source"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["import_status"]
          successful_items?: number
          total_items?: number
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          failed_items?: number
          films_known?: number
          films_new?: number
          id?: string
          processed_items?: number
          source?: Database["public"]["Enums"]["import_source"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["import_status"]
          successful_items?: number
          total_items?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      import_items: {
        Row: {
          batch_id: string
          error_code: string | null
          film_id: string | null
          has_spoilers: boolean
          id: string
          kind: Database["public"]["Enums"]["import_item_kind"]
          ord: number | null
          processed_at: string | null
          rating: number | null
          raw_title: string
          raw_year: number | null
          review: string | null
          source_uri: string | null
          status: Database["public"]["Enums"]["import_item_status"]
          watched_on: string | null
        }
        Insert: {
          batch_id: string
          error_code?: string | null
          film_id?: string | null
          has_spoilers?: boolean
          id?: string
          kind: Database["public"]["Enums"]["import_item_kind"]
          ord?: number | null
          processed_at?: string | null
          rating?: number | null
          raw_title: string
          raw_year?: number | null
          review?: string | null
          source_uri?: string | null
          status?: Database["public"]["Enums"]["import_item_status"]
          watched_on?: string | null
        }
        Update: {
          batch_id?: string
          error_code?: string | null
          film_id?: string | null
          has_spoilers?: boolean
          id?: string
          kind?: Database["public"]["Enums"]["import_item_kind"]
          ord?: number | null
          processed_at?: string | null
          rating?: number | null
          raw_title?: string
          raw_year?: number | null
          review?: string | null
          source_uri?: string | null
          status?: Database["public"]["Enums"]["import_item_status"]
          watched_on?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_items_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["wikidata_id"]
          },
        ]
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
      list_items: {
        Row: {
          film_id: string
          list_id: string
          note: string | null
          ord: number
        }
        Insert: {
          film_id: string
          list_id: string
          note?: string | null
          ord?: number
        }
        Update: {
          film_id?: string
          list_id?: string
          note?: string | null
          ord?: number
        }
        Relationships: [
          {
            foreignKeyName: "list_items_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["wikidata_id"]
          },
          {
            foreignKeyName: "list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      lists: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      moderators: {
        Row: {
          added_at: string
          user_id: string
        }
        Insert: {
          added_at?: string
          user_id: string
        }
        Update: {
          added_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderators_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          banner_path: string | null
          bio: string | null
          closed_at: string | null
          closed_reason: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          username: string
          watchlist_public: boolean
        }
        Insert: {
          avatar_path?: string | null
          banner_path?: string | null
          bio?: string | null
          closed_at?: string | null
          closed_reason?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
          username: string
          watchlist_public?: boolean
        }
        Update: {
          avatar_path?: string | null
          banner_path?: string | null
          bio?: string | null
          closed_at?: string | null
          closed_reason?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          username?: string
          watchlist_public?: boolean
        }
        Relationships: []
      }
      recommendations: {
        Row: {
          created_at: string
          dismissed_at: string | null
          film_id: string
          from_user: string
          id: string
          note: string | null
          to_user: string
        }
        Insert: {
          created_at?: string
          dismissed_at?: string | null
          film_id: string
          from_user: string
          id?: string
          note?: string | null
          to_user: string
        }
        Update: {
          created_at?: string
          dismissed_at?: string | null
          film_id?: string
          from_user?: string
          id?: string
          note?: string | null
          to_user?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["wikidata_id"]
          },
          {
            foreignKeyName: "recommendations_from_user_fkey"
            columns: ["from_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_to_user_fkey"
            columns: ["to_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      report_images: {
        Row: {
          added_at: string
          path: string
          report_id: string
        }
        Insert: {
          added_at?: string
          path: string
          report_id: string
        }
        Update: {
          added_at?: string
          path?: string
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_images_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          body: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision: string | null
          id: string
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_email: string | null
          reporter_id: string | null
          status: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_kind: Database["public"]["Enums"]["report_target"]
        }
        Insert: {
          body?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          id?: string
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_email?: string | null
          reporter_id?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_kind: Database["public"]["Enums"]["report_target"]
        }
        Update: {
          body?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          id?: string
          reason?: Database["public"]["Enums"]["report_reason"]
          reporter_email?: string | null
          reporter_id?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id?: string
          target_kind?: Database["public"]["Enums"]["report_target"]
        }
        Relationships: [
          {
            foreignKeyName: "reports_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      taste_votes: {
        Row: {
          created_at: string
          film_id: string
          user_id: string
          verdict: Database["public"]["Enums"]["taste_verdict"]
        }
        Insert: {
          created_at?: string
          film_id: string
          user_id: string
          verdict: Database["public"]["Enums"]["taste_verdict"]
        }
        Update: {
          created_at?: string
          film_id?: string
          user_id?: string
          verdict?: Database["public"]["Enums"]["taste_verdict"]
        }
        Relationships: [
          {
            foreignKeyName: "taste_votes_film_id_fkey"
            columns: ["film_id"]
            isOneToOne: false
            referencedRelation: "films"
            referencedColumns: ["wikidata_id"]
          },
          {
            foreignKeyName: "taste_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          priority: Database["public"]["Enums"]["watchlist_priority"]
          user_id: string
        }
        Insert: {
          added_at?: string
          film_id: string
          is_hidden?: boolean
          priority?: Database["public"]["Enums"]["watchlist_priority"]
          user_id: string
        }
        Update: {
          added_at?: string
          film_id?: string
          is_hidden?: boolean
          priority?: Database["public"]["Enums"]["watchlist_priority"]
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
      watchlist_group_films: {
        Row: {
          film_id: string
          group_id: string
          user_id: string
        }
        Insert: {
          film_id: string
          group_id: string
          user_id: string
        }
        Update: {
          film_id?: string
          group_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_group_film_is_on_the_list"
            columns: ["user_id", "film_id"]
            isOneToOne: false
            referencedRelation: "watchlist"
            referencedColumns: ["user_id", "film_id"]
          },
          {
            foreignKeyName: "watchlist_group_film_same_owner"
            columns: ["group_id", "user_id"]
            isOneToOne: false
            referencedRelation: "watchlist_groups"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      watchlist_groups: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_groups_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      film_categories: {
        Row: {
          category_id: string | null
          film_id: string | null
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
            foreignKeyName: "genres_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "genres"
            referencedColumns: ["wikidata_id"]
          },
        ]
      }
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
      admin_films: {
        Args: {
          absteigend?: boolean
          seite?: number
          sortieren?: string
          such?: string
        }
        Returns: {
          avg_rating: number
          edited_at: string
          entries: number
          fsk: number
          gesamt: number
          manual: number
          poster_source: string
          poster_url: string
          ratings: number
          release_year: number
          runtime_min: number
          title: string
          wikidata_id: string
        }[]
      }
      admin_overview: {
        Args: never
        Returns: {
          active_7d: number
          dormant: number
          entries: number
          entries_7d: number
          films: number
          films_7d: number
          lists: number
          members: number
          members_7d: number
          open_reports: number
          open_threads: number
          reviews: number
        }[]
      }
      admin_users: {
        Args: {
          absteigend?: boolean
          seite?: number
          sortieren?: string
          such?: string
        }
        Returns: {
          avatar_path: string
          closed_at: string
          created_at: string
          display_name: string
          entries: number
          gesamt: number
          lists: number
          ratings: number
          reviews: number
          username: string
        }[]
      }
      are_friends: { Args: { a: string; b: string }; Returns: boolean }
      blocked_by: { Args: { wer: string }; Returns: boolean }
      blocks_me: { Args: { autor: string }; Returns: boolean }
      claim_lazy_creation: {
        Args: { per_minute?: number; search_term: string }
        Returns: boolean
      }
      diary_for_me: {
        Args: never
        Returns: {
          created_at: string
          film_id: string
          genre_ids: string[]
          genre_labels: string[]
          has_spoilers: boolean
          id: string
          is_rewatch: boolean
          poster_source: string
          poster_url: string
          rating: number
          release_year: number
          review: string
          runtime_min: number
          title_de: string
          title_original: string
          visibility: Database["public"]["Enums"]["entry_visibility"]
          watched_on: string
        }[]
      }
      diary_summary: {
        Args: never
        Returns: {
          average: number
          entries: number
          films: number
          this_year: number
        }[]
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
      films_for_me: {
        Args: { max_results?: number }
        Returns: {
          poster_source: string
          poster_url: string
          release_year: number
          title_de: string
          title_original: string
          weight: number
          wikidata_id: string
        }[]
      }
      following_feed: {
        Args: { before_at?: string; before_id?: string; max_results?: number }
        Returns: {
          avatar_path: string
          created_at: string
          film_id: string
          has_spoilers: boolean
          id: string
          is_rewatch: boolean
          poster_source: string
          poster_url: string
          rating: number
          release_year: number
          review: string
          title_de: string
          title_original: string
          username: string
          watched_on: string
        }[]
      }
      friends_for_recommendation: {
        Args: { film: string }
        Returns: {
          already_sent: boolean
          avatar_path: string
          id: string
          username: string
        }[]
      }
      genre_tiles: {
        Args: { max_results?: number }
        Returns: {
          films: number
          genre_id: string
          label: string
        }[]
      }
      is_moderator: { Args: never; Returns: boolean }
      list_films: {
        Args: { list: string }
        Returns: {
          film_id: string
          note: string
          ord: number
          poster_source: string
          poster_url: string
          release_year: number
          title_de: string
          title_original: string
        }[]
      }
      list_is_mine: { Args: { list: string }; Returns: boolean }
      list_is_readable: { Args: { list: string }; Returns: boolean }
      lists_of: {
        Args: { profile: string }
        Returns: {
          description: string
          films: number
          id: string
          is_public: boolean
          posters: string[]
          title: string
          updated_at: string
        }[]
      }
      match_import_titles: {
        Args: { rows: Json }
        Returns: {
          certainty: string
          film_id: string
          idx: number
        }[]
      }
      my_facet_ratings: {
        Args: { film: string }
        Returns: {
          facet: Database["public"]["Enums"]["facet_kind"]
          score: number
        }[]
      }
      my_friends: { Args: never; Returns: string[] }
      normalise_title: { Args: { "": string }; Returns: string }
      profile_decades: {
        Args: { profile: string }
        Returns: {
          decade: number
          films: number
        }[]
      }
      profile_directors: {
        Args: { max_results?: number; profile: string }
        Returns: {
          films: number
          name: string
        }[]
      }
      profile_favourites: {
        Args: { profile: string }
        Returns: {
          poster_source: string
          poster_url: string
          release_year: number
          slot: number
          title_de: string
          title_original: string
          wikidata_id: string
        }[]
      }
      profile_genres: {
        Args: { max_results?: number; profile: string }
        Returns: {
          films: number
          genre_id: string
          label: string
        }[]
      }
      profile_overview: {
        Args: { name: string }
        Returns: {
          avatar_path: string
          banner_path: string
          bio: string
          blocked_me: boolean
          created_at: string
          display_name: string
          followers: number
          following: number
          follows_me: boolean
          i_blocked: boolean
          i_follow: boolean
          id: string
          is_me: boolean
          username: string
          watchlist_public: boolean
        }[]
      }
      profile_rating_spread: {
        Args: { profile: string }
        Returns: {
          films: number
          rating: number
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
      profile_years: {
        Args: { profile: string }
        Returns: {
          films: number
          year: number
        }[]
      }
      prune_lazy_creation_attempts: { Args: never; Returns: undefined }
      recommendations_for_me: {
        Args: { max_results?: number }
        Returns: {
          film_id: string
          first_friend: string
          friend_rating: number
          friends: number
          note: string
          poster_source: string
          poster_url: string
          recommended_at: string
          release_year: number
          title_de: string
          title_original: string
        }[]
      }
      refresh_film_facet_averages: { Args: never; Returns: undefined }
      report_accepts_uploads: { Args: { report: string }; Returns: boolean }
      resolve_import_item: {
        Args: { film: string; item: string }
        Returns: boolean
      }
      search_films: {
        Args: { in_year?: number; max_results?: number; query: string }
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
      skip_import_item: { Args: { item: string }; Returns: boolean }
      swap_favourites: { Args: { a: number; b: number }; Returns: undefined }
      taste_deck: {
        Args: { wanted?: number }
        Returns: {
          category_label: string
          film_id: string
          poster_source: string
          poster_url: string
          release_year: number
          title_de: string
          title_original: string
        }[]
      }
      taste_readiness: {
        Args: never
        Returns: {
          categories_covered: number
          label: string
          observations: number
          rated: number
          readiness: number
          votes: number
        }[]
      }
      unmatched_imports: {
        Args: { max_results?: number }
        Returns: {
          batch_id: string
          id: string
          kind: Database["public"]["Enums"]["import_item_kind"]
          rating: number
          raw_title: string
          raw_year: number
          status: Database["public"]["Enums"]["import_item_status"]
          watched_on: string
        }[]
      }
      username_available: { Args: { candidate: string }; Returns: boolean }
      watchlist_for_me: {
        Args: never
        Returns: {
          added_at: string
          average: number
          film_id: string
          first_friend: string
          friend_name: string
          friend_rating: number
          friends_seen: number
          genre_ids: string[]
          genre_labels: string[]
          group_ids: string[]
          poster_source: string
          poster_url: string
          priority: Database["public"]["Enums"]["watchlist_priority"]
          recommenders: number
          release_year: number
          runtime_min: number
          title_de: string
          title_original: string
          votes: number
        }[]
      }
      watchlist_groups_for_me: {
        Args: never
        Returns: {
          films: number
          id: string
          name: string
        }[]
      }
      watchlist_is_public: { Args: { profile: string }; Returns: boolean }
      weekly_top_films: {
        Args: { max_results?: number }
        Returns: {
          average: number
          place: number
          poster_source: string
          poster_url: string
          ratings: number
          release_year: number
          score: number
          title_de: string
          title_original: string
          wikidata_id: string
        }[]
      }
    }
    Enums: {
      account_action:
        | "password_reset"
        | "username_reset"
        | "email_change"
        | "account_closed"
        | "account_restored"
        | "content_removed"
        | "note"
      entry_visibility: "public" | "friends" | "private"
      facet_kind:
        | "acting"
        | "story"
        | "directing"
        | "cinematography"
        | "sound"
        | "production_design"
        | "pacing"
      import_item_kind: "watched" | "diary" | "watchlist" | "like"
      import_item_status:
        | "pending"
        | "matched"
        | "created"
        | "imported"
        | "needs_review"
        | "skipped"
        | "failed"
      import_source: "letterboxd"
      import_status:
        | "uploaded"
        | "analyzing"
        | "ready"
        | "importing"
        | "completed"
        | "completed_with_errors"
        | "failed"
        | "cancelled"
      report_reason:
        | "spoiler"
        | "harassment"
        | "hate"
        | "sexual"
        | "violence"
        | "spam"
        | "illegal"
        | "other"
      report_status: "open" | "in_progress" | "resolved" | "rejected"
      report_target: "message" | "review" | "profile" | "list" | "other"
      taste_verdict: "like" | "dislike" | "unsure"
      watchlist_priority: "next" | "normal" | "someday"
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
      account_action: [
        "password_reset",
        "username_reset",
        "email_change",
        "account_closed",
        "account_restored",
        "content_removed",
        "note",
      ],
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
      import_item_kind: ["watched", "diary", "watchlist", "like"],
      import_item_status: [
        "pending",
        "matched",
        "created",
        "imported",
        "needs_review",
        "skipped",
        "failed",
      ],
      import_source: ["letterboxd"],
      import_status: [
        "uploaded",
        "analyzing",
        "ready",
        "importing",
        "completed",
        "completed_with_errors",
        "failed",
        "cancelled",
      ],
      report_reason: [
        "spoiler",
        "harassment",
        "hate",
        "sexual",
        "violence",
        "spam",
        "illegal",
        "other",
      ],
      report_status: ["open", "in_progress", "resolved", "rejected"],
      report_target: ["message", "review", "profile", "list", "other"],
      taste_verdict: ["like", "dislike", "unsure"],
      watchlist_priority: ["next", "normal", "someday"],
    },
  },
} as const
