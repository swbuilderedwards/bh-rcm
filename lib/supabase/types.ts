export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          billing_type: "cvs" | "esi" | "direct"
          client_codes: string[]
          zip_code: string | null
          member_exclusive: boolean
          legacy_pricing: boolean
          delivery_paused: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          billing_type: "cvs" | "esi" | "direct"
          client_codes?: string[]
          zip_code?: string | null
          member_exclusive?: boolean
          legacy_pricing?: boolean
          delivery_paused?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          billing_type?: "cvs" | "esi" | "direct"
          client_codes?: string[]
          zip_code?: string | null
          member_exclusive?: boolean
          legacy_pricing?: boolean
          delivery_paused?: boolean
          created_at?: string
        }
      }
      products: {
        Row: {
          id: string
          name: string
          slug: string
          product_id_legacy: number
          upc: string
          upc_legacy: string | null
          ndc_qualifier: string
          ingredient_cost: number
          dispensing_fee: number
          usual_and_customary_charge: number
          gross_amount_due: number
          days_supply: number
          quantity: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          product_id_legacy: number
          upc: string
          upc_legacy?: string | null
          ndc_qualifier?: string
          ingredient_cost: number
          dispensing_fee: number
          usual_and_customary_charge: number
          gross_amount_due: number
          days_supply?: number
          quantity?: number
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          product_id_legacy?: number
          upc?: string
          upc_legacy?: string | null
          ndc_qualifier?: string
          ingredient_cost?: number
          dispensing_fee?: number
          usual_and_customary_charge?: number
          gross_amount_due?: number
          days_supply?: number
          quantity?: number
          created_at?: string
        }
      }
      patients: {
        Row: {
          id: string
          first_name: string
          last_name: string
          date_of_birth: string
          gender: "M" | "F" | "U" | "X"
          zip_code: string | null
          caremark_id: string | null
          bin_number: string | null
          processor_control_number: string | null
          rx_group: string | null
          group_id: string | null
          carrier_id: string | null
          account_id: string | null
          person_code: string | null
          relationship_code: string | null
          created_at: string
        }
        Insert: {
          id?: string
          first_name: string
          last_name: string
          date_of_birth: string
          gender: "M" | "F" | "U" | "X"
          zip_code?: string | null
          caremark_id?: string | null
          bin_number?: string | null
          processor_control_number?: string | null
          rx_group?: string | null
          group_id?: string | null
          carrier_id?: string | null
          account_id?: string | null
          person_code?: string | null
          relationship_code?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          first_name?: string
          last_name?: string
          date_of_birth?: string
          gender?: "M" | "F" | "U" | "X"
          zip_code?: string | null
          caremark_id?: string | null
          bin_number?: string | null
          processor_control_number?: string | null
          rx_group?: string | null
          group_id?: string | null
          carrier_id?: string | null
          account_id?: string | null
          person_code?: string | null
          relationship_code?: string | null
          created_at?: string
        }
      }
      enrollments: {
        Row: {
          id: string
          patient_id: string
          product_id: string
          organization_id: string
          enrolled_at: string
          billing_point_hit_at: string | null
          reference_number: number | null
          copayment_amount_cents: number | null
          is_billable: boolean
          not_billable_reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          product_id: string
          organization_id: string
          enrolled_at: string
          billing_point_hit_at?: string | null
          reference_number?: number | null
          copayment_amount_cents?: number | null
          is_billable?: boolean
          not_billable_reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          product_id?: string
          organization_id?: string
          enrolled_at?: string
          billing_point_hit_at?: string | null
          reference_number?: number | null
          copayment_amount_cents?: number | null
          is_billable?: boolean
          not_billable_reason?: string | null
          created_at?: string
        }
      }
      batches: {
        Row: {
          id: string
          submitted_at: string | null
          total_claims: number
          paid_count: number
          rejected_count: number
          duplicate_count: number
          request_body: string | null
          response_body: string | null
          created_at: string
        }
        Insert: {
          id?: string
          submitted_at?: string | null
          total_claims?: number
          paid_count?: number
          rejected_count?: number
          duplicate_count?: number
          request_body?: string | null
          response_body?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          submitted_at?: string | null
          total_claims?: number
          paid_count?: number
          rejected_count?: number
          duplicate_count?: number
          request_body?: string | null
          response_body?: string | null
          created_at?: string
        }
      }
      claims: {
        Row: {
          id: string
          enrollment_id: string
          batch_id: string | null
          sequence_number: number
          status: "pending" | "submitted" | "paid" | "rejected" | "duplicate"
          service_date: string | null
          submitted_at: string | null
          responded_at: string | null
          response_status: "P" | "R" | "D" | null
          reject_codes: string[] | null
          reject_descriptions: string[] | null
          settlement_codes: string[] | null
          settlement_descriptions: string[] | null
          settlement_severity_codes: string[] | null
          created_at: string
        }
        Insert: {
          id?: string
          enrollment_id: string
          batch_id?: string | null
          sequence_number?: number
          status?: "pending" | "submitted" | "paid" | "rejected" | "duplicate"
          service_date?: string | null
          submitted_at?: string | null
          responded_at?: string | null
          response_status?: "P" | "R" | "D" | null
          reject_codes?: string[] | null
          reject_descriptions?: string[] | null
          settlement_codes?: string[] | null
          settlement_descriptions?: string[] | null
          settlement_severity_codes?: string[] | null
          created_at?: string
        }
        Update: {
          id?: string
          enrollment_id?: string
          batch_id?: string | null
          sequence_number?: number
          status?: "pending" | "submitted" | "paid" | "rejected" | "duplicate"
          service_date?: string | null
          submitted_at?: string | null
          responded_at?: string | null
          response_status?: "P" | "R" | "D" | null
          reject_codes?: string[] | null
          reject_descriptions?: string[] | null
          settlement_codes?: string[] | null
          settlement_descriptions?: string[] | null
          settlement_severity_codes?: string[] | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Convenience type aliases
export type Organization = Database["public"]["Tables"]["organizations"]["Row"]
export type Product = Database["public"]["Tables"]["products"]["Row"]
export type Patient = Database["public"]["Tables"]["patients"]["Row"]
export type Enrollment = Database["public"]["Tables"]["enrollments"]["Row"]
export type Batch = Database["public"]["Tables"]["batches"]["Row"]
export type Claim = Database["public"]["Tables"]["claims"]["Row"]
