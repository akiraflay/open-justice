/**
 * Type definitions for OpenJustice frontend
 */

export interface UploadedFile {
  id: string
  name: string
  type: string
  size: string
  uploadedAt: Date
  isTranscribing?: boolean
  transcriptionProgress?: number
  path?: string
}

export interface ExtractedQuery {
  id: string
  text: string
  questionNumber: number
  category?: string
}

export interface Query {
  id: string
  text: string
  status: "pending" | "processing" | "completed"
  sessionId: string
  fileResults?: FileResult[]
  summary?: string
  combinedAnalysisRequested: boolean
  combinedAnalysisProgress: number
}

export interface FileResult {
  fileId: string
  fileName: string
  result: string
  status: "pending" | "processing" | "anti-hallucination" | "completed" | "failed" | "retrying"
  progress: number
  message?: string
  attempt?: string
  retryAvailable?: boolean
}

export interface QueryInput {
  id: string
  text: string
}

export interface SessionData {
  session_id: string
  files: UploadedFile[]
  queries: Query[]
}

export interface ExtractQueriesResponse {
  success: boolean
  queries?: ExtractedQuery[]
  error?: string
}

export interface UploadFileResponse {
  success: boolean
  file?: UploadedFile
  error?: string
}

export interface ProcessQueryResponse {
  success: boolean
  query_id?: string
  results?: string
  error?: string
}

export interface ApiError {
  error: string
  details?: string
}