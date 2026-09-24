/**
 * Hand-written mirror of the backend's Pydantic schemas, taken from the live
 * /openapi.json. Names match the backend's schema names, and fields keep the backend's
 * snake_case — there is no camelCase mapping layer in either direction. If a backend
 * schema changes, this file changes in the same commit.
 */

/** DiagnosisRead — an ICD-10-CM reference row. */
export interface DiagnosisRead {
  code: string
  description: string
}

/** ConsultationCreate — what the client may send. No id, no created_at. */
export interface ConsultationCreate {
  patient_name: string
  /** Optional in the request; the backend also normalises a blank string to null. */
  notes?: string | null
  /** At least 1, at most 20. */
  diagnosis_codes: string[]
}

/** ConsultationRead — what the backend returns. */
export interface ConsultationRead {
  patient_name: string
  /** Always present in a response, null when the consultation has no notes. */
  notes: string | null
  id: number
  /**
   * ISO-8601 with an explicit UTC offset, which the backend emits as a trailing "Z" —
   * e.g. "2026-09-23T07:34:01Z". Never assume local time; `new Date()` parses it
   * correctly and renders in the viewer's own zone.
   */
  created_at: string
  /** Always ordered by code, on create as well as list. */
  diagnoses: DiagnosisRead[]
}

/** One field-level problem, present on request-validation failures. */
export interface ApiErrorDetail {
  field: string
  message: string
}

/** The single error envelope every backend failure produces. */
export interface ApiErrorEnvelope {
  error: {
    code: string
    message: string
    details?: ApiErrorDetail[]
  }
}

/** Query parameters for GET /diagnoses. */
export interface DiagnosisSearchParams {
  search: string
  limit?: number
}

/** Query parameters for GET /consultations. */
export interface ConsultationListParams {
  patient?: string
  code?: string
  limit?: number
  offset?: number
}

/** DoctorRead — the signed-in doctor, returned by /auth/login, /auth/me. */
export interface DoctorRead {
  id: number
  email: string
}

/** LoginRequest — what the client sends to POST /auth/login. */
export interface LoginRequest {
  email: string
  password: string
}
