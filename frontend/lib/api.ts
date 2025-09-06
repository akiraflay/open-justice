/**
 * API Client for OpenJustice Backend
 */

import type { 
  ExtractQueriesResponse, 
  UploadFileResponse, 
  ProcessQueryResponse, 
  SessionData,
  ExtractedQuery
} from './types'

// Helper function to handle API responses
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Network error' }))
    // Preserve the full error structure for better frontend error handling
    throw new Error(JSON.stringify(error))
  }
  return response.json()
}

// Helper function to make fetch requests with error handling
async function fetchWithRetry(url: string, options: RequestInit, retries = 1) {
  try {
    const response = await fetch(url, options)
    return response
  } catch (error) {
    if (retries > 0) {
      console.log(`Retrying API call to ${url}...`)
      await new Promise(resolve => setTimeout(resolve, 1000))
      return fetchWithRetry(url, options, retries - 1)
    }
    throw error
  }
}

// Session API
export async function getSession(): Promise<SessionData> {
  const response = await fetch('/api/session', {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  })
  return handleResponse<SessionData>(response)
}

// File Upload API
export async function uploadFile(file: File): Promise<UploadFileResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch('/api/upload', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  })
  
  return handleResponse<UploadFileResponse>(response)
}

// List uploaded files
export async function listFiles() {
  const response = await fetch('/api/files', {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  })
  return handleResponse(response)
}

// Delete a file
export async function deleteFile(fileId: string) {
  const response = await fetch(`/api/files/${fileId}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  })
  return handleResponse(response)
}

// Extract queries from user input using AI
export async function extractQueries(text: string): Promise<ExtractQueriesResponse> {
  const response = await fetchWithRetry(
    '/api/extract-queries',
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    },
    2
  )
  
  return handleResponse<ExtractQueriesResponse>(response)
}

// Swap a query with a contextually similar replacement
export async function swapQuery(
  originalQuery: string,
  userContext: string,
  existingQueries: string[]
): Promise<{ success: boolean; query: string }> {
  const response = await fetchWithRetry(
    '/api/swap-query',
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        original_query: originalQuery,
        user_context: userContext,
        existing_queries: existingQueries
      }),
    },
    2
  )
  
  return handleResponse<{ success: boolean; query: string }>(response)
}

// Process a query against documents
export async function processQuery(queryText: string): Promise<ProcessQueryResponse> {
  const response = await fetchWithRetry(
    '/api/query',
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: queryText }),
    },
    2
  )
  
  return handleResponse<ProcessQueryResponse>(response)
}

// Stream query processing with real-time updates using fetch API with streaming
export async function streamQuery(
  queryText: string, 
  onProgress: (progress: number, status: string, message?: string, attempt?: string) => void,
  onText: (text: string) => void,
  onComplete: (result: any) => void,
  onError: (error: string) => void
) {
  try {
    const response = await fetch('/api/query/stream', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: queryText })
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No reader available')
    }
    
    const decoder = new TextDecoder()
    let buffer = ''
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6)
          if (dataStr.trim()) {
            try {
              const data = JSON.parse(dataStr)
              
              if (data.progress) {
                onProgress(data.progress, data.status || '', data.message || '', data.attempt || '')
              }
              
              if (data.text) {
                onText(data.text)
              }
              
              if (data.done) {
                onComplete({
                  final_text: data.final_text,
                  confidence: data.confidence,
                  is_verified: data.is_verified
                })
              }
              
              if (data.error) {
                onError(data.error)
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e)
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Streaming error:', error)
    onError(error instanceof Error ? error.message : 'Streaming failed')
  }
}

// Process multiple queries in batch
export async function processQueries(queries: string[]): Promise<ProcessQueryResponse[]> {
  const promises = queries.map(queryText => processQuery(queryText))
  return Promise.all(promises)
}

// Get query status
export async function getQueryStatus(queryId: string) {
  const response = await fetch(`/api/query/${queryId}`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  })
  return handleResponse(response)
}

// Generate combined analysis for a document
export async function generateCombinedAnalysis(fileId: string, queries: any[] = []) {
  const response = await fetch('/api/combined-analysis', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ 
      file_id: fileId,
      queries: queries
    })
  })
  return handleResponse(response)
}

// Clear session
export async function clearSession() {
  const response = await fetch('/api/session', {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  })
  return handleResponse(response)
}

// Mock functions for when backend is not available
export const mockApi = {
  extractQueries: async (text: string): Promise<ExtractedQuery[]> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const mockQueries = [
      "What are the key facts surrounding the incident in question?",
      "What evidence supports the defendant's claims in this case?",
      "Are there any procedural issues that could affect the outcome?",
      "What precedents are most relevant to this legal matter?",
      "What are the potential defenses available to the client?",
    ]
    
    // Return 2-4 random queries
    const numQueries = Math.floor(Math.random() * 3) + 2
    return mockQueries.slice(0, numQueries).map((query, index) => ({
      id: Math.random().toString(36).substr(2, 9),
      text: query,
      questionNumber: index + 1,
      category: ["Facts", "Evidence", "Procedure", "Precedents", "Defense"][index]
    }))
  },
  
  uploadFile: async (file: File): Promise<UploadFileResponse> => {
    await new Promise(resolve => setTimeout(resolve, 500))
    
    return {
      success: true,
      file: {
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        type: file.type.includes('pdf') ? 'pdf' : 'document',
        size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
        uploadedAt: new Date()
      }
    }
  },
  
  processQuery: async (queryText: string): Promise<ProcessQueryResponse> => {
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    return {
      success: true,
      query_id: Math.random().toString(36).substr(2, 9),
      result: `Analysis complete for: "${queryText}". Found relevant information across multiple documents.`
    }
  }
}