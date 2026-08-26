/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * PLACEHOLDER — replaced by `pnpm db:types` once the Supabase project is
 * linked. Do not edit by hand; edit the migrations instead.
 *
 *   pnpm --filter @binge-log/db types
 *
 * The shape is deliberately permissive rather than precise. A placeholder
 * that claims to know the schema makes supabase-js narrow query results
 * to something that is not true, which then shows up as bogus lint
 * findings about impossible null checks. Unknown is the honest answer
 * until the real types are generated.
 */
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface UnknownTable {
  Row: Record<string, any>;
  Insert: Record<string, any>;
  Update: Record<string, any>;
  Relationships: [];
}

export interface Database {
  public: {
    Tables: Record<string, UnknownTable>;
    Views: Record<string, UnknownTable>;
    Functions: Record<string, { Args: Record<string, unknown>; Returns: unknown }>;
    Enums: Record<string, string>;
    CompositeTypes: Record<string, Record<string, unknown>>;
  };
}
