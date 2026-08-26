/* eslint-disable */
/**
 * PLACEHOLDER — replaced by `pnpm db:types` once the Supabase project is
 * linked. Do not edit by hand; edit the migrations instead.
 *
 *   pnpm --filter @binge-log/db types
 */
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
