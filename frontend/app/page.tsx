"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import Sidebar from "@/components/sidebar"
import { FavoritesModal } from "@/components/favorites-modal"
import { BottomBar } from "@/components/bottom-bar"
import { 
  extractQueries as extractQueriesAPI, 
  uploadFile as uploadFileAPI,
  getSession,
  deleteFile as deleteFileAPI,
  processQuery,
  streamQuery,
  generateCombinedAnalysis as generateCombinedAnalysisAPI,
  swapQuery
} from "@/lib/api"
import {
  Upload,
  Send,
  FileText,
  Video,
  Music,
  ImageIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Search,
  Plus,
  X,
  Mic,
  BarChart3,
} from "lucide-react"

interface UploadedFile {
  id: string
  name: string
  type: string
  size: string
  uploadedAt: Date
  isTranscribing?: boolean
  transcriptionProgress?: number
}

interface Query {
  id: string
  text: string
  status: "pending" | "processing" | "completed"
  sessionId: string
  fileResults?: Array<{
    fileId: string
    fileName: string
    result: string
    status: "pending" | "processing" | "anti-hallucination" | "retrying" | "failed" | "completed"
    progress: number
    message?: string
    attempt?: string
  }>
  summary?: string
  combinedAnalysisRequested: boolean
  combinedAnalysisProgress: number
}

interface QueryInput {
  id: string
  text: string
}

interface ExtractedQuery {
  id: string
  text: string
  questionNumber: number
}

type QueryMode = "auto" | "manual"
type QueryState = "input" | "extracted" | "submitted"

type RecordingState = "idle" | "recording" | "processing"

const LegalCaseAnalysis = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [queries, setQueries] = useState<Query[]>([])
  const [queryInputs, setQueryInputs] = useState<QueryInput[]>([
    { id: Math.random().toString(36).substr(2, 9), text: "" },
  ])
  const [queryMode, setQueryMode] = useState<QueryMode>("auto")
  const [queryState, setQueryState] = useState<QueryState>("input")
  const [extractedQueries, setExtractedQueries] = useState<ExtractedQuery[]>([])
  const [displayedText, setDisplayedText] = useState("")
  const [recordingState, setRecordingState] = useState<RecordingState>("idle")
  const [swappingQueries, setSwappingQueries] = useState<Set<string>>(new Set())
  const [swappedQueries, setSwappedQueries] = useState<Set<string>>(new Set())
  const [previousQueries, setPreviousQueries] = useState<Map<string, string>>(new Map())
  const [userContext, setUserContext] = useState<string>("")
  // Manual mode swap states
  const [swappingInputs, setSwappingInputs] = useState<Set<string>>(new Set())
  const [swappedInputs, setSwappedInputs] = useState<Set<string>>(new Set())
  const [previousInputs, setPreviousInputs] = useState<Map<string, string>>(new Map())
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const [processingSourceIds, setProcessingSourceIds] = useState<Set<string>>(new Set())
  const [favoritesModalOpen, setFavoritesModalOpen] = useState(false)
  const [isExtractingQueries, setIsExtractingQueries] = useState(false)
  const [expandedQueries, setExpandedQueries] = useState<Set<string>>(new Set())

  const removeFile = async (fileId: string) => {
    try {
      // Call backend to delete the file
      const response = await deleteFileAPI(fileId)
      
      if (response.success) {
        // Only remove from UI after successful backend deletion
        setUploadedFiles((prev) => prev.filter((file) => file.id !== fileId))
        
        toast({
          title: "File removed",
          description: "The file has been deleted successfully.",
        })
      } else {
        throw new Error(response.error || "Deletion failed")
      }
    } catch (error) {
      console.error('File deletion error:', error)
      toast({
        title: "Deletion failed",
        description: "Failed to delete the file. Please try again.",
        variant: "destructive",
      })
    }
  }

  const extractQueries = async (text: string): Promise<ExtractedQuery[]> => {
    try {
      // Call the real API to extract queries using AI
      const result = await extractQueriesAPI(text)
      
      // Check if we got real queries (not mock data)
      if (result.queries && result.queries.length > 0) {
        // Success toast when API returns queries
        toast({
          title: "Queries Extracted",
          description: `Successfully extracted ${result.queries.length} queries using AI analysis.`,
        })
      }
      
      // Map the API response to our ExtractedQuery format
      return result.queries.map((query, index) => ({
        id: Math.random().toString(36).substr(2, 9),
        text: query.text,
        questionNumber: index + 1,
      }))
    } catch (error) {
      console.error('Error extracting queries:', error)
      toast({
        title: "API Connection Error",
        description: "Failed to connect to AI service. Using fallback mode.",
        variant: "destructive",
      })
      
      // Return mock queries as fallback
      const mockQueries = [
        "What are the key facts presented in the case?",
        "What evidence is available or needs to be collected to support the claims or defenses in the case?",
        "How does the liability of the parties involved in the case get determined based on the presented facts and evidence?",
      ]
      
      return mockQueries.slice(0, Math.floor(Math.random() * 2) + 2).map((query, index) => ({
        id: Math.random().toString(36).substr(2, 9),
        text: query,
        questionNumber: index + 1,
      }))
    }
  }

  const ProcessingBar: React.FC<{ progress: number; status: string; message?: string; attempt?: string; isRetrying?: boolean }> = ({ progress, status, message, attempt, isRetrying }) => {
    if (status === "pending") return (
      <div className="flex items-center gap-2 ml-auto">
        <span className="text-xs text-muted-foreground">Queued for analysis...</span>
      </div>
    )
    
    if (status === "completed" && !isRetrying) return null

    // Determine if we're in hallucination detection/retry mode
    const isHallucinationMode = status === "anti-hallucination" || status === "retrying" || (attempt && attempt !== "1/3")
    
    // For normal flow, show smooth progress (0-66% for generation, 66-100% for verification)
    // For hallucination retries, show stepped progress with attempt counter
    const displayProgress = isHallucinationMode ? progress : (
      status === "verifying" ? Math.min(66 + (progress / 100 * 34), 100) : 
      Math.min(progress * 0.66, 66)
    )

    return (
      <div className="flex items-center gap-2 ml-auto">
        <div className="flex flex-col items-end">
          {message && (
            <span className={`text-xs mb-1 ${isHallucinationMode ? 'text-amber-600' : 'text-muted-foreground'}`}>
              {message}
            </span>
          )}
          <div className="flex items-center gap-2">
            {isHallucinationMode && attempt && (
              <span className="text-xs font-mono text-amber-600">{attempt}</span>
            )}
            <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ease-out ${
                  isHallucinationMode ? 'bg-amber-500' : 'bg-primary'
                }`} 
                style={{ width: `${displayProgress}%` }} 
              />
            </div>
            <span className={`text-xs font-mono min-w-[32px] ${
              isHallucinationMode ? 'text-amber-600' : 'text-muted-foreground'
            }`}>
              {Math.round(displayProgress)}%
            </span>
          </div>
        </div>
      </div>
    )
  }

  const CombinedAnalysisBar: React.FC<{ progress: number }> = ({ progress }) => {
    return (
      <div className="flex items-center gap-2">
        <div className="w-24 h-1 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all duration-300 ease-out" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-xs text-muted-foreground font-mono min-w-[32px]">{progress}%</span>
      </div>
    )
  }

  const isTranscribableFile = (fileType: string) => {
    return fileType === "audio" || fileType === "video"
  }

  const getFileIcon = (type: string, isTranscribing?: boolean, progress?: number) => {
    switch (type) {
      case "pdf":
        return <FileText className="h-4 w-4" />
      case "audio":
        if (isTranscribing) {
          return (
            <div className="relative h-4 w-4">
              <div className="absolute inset-0 animate-spin">
                <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
              </div>
            </div>
          )
        }
        return <Music className="h-4 w-4" />
      case "video":
        if (isTranscribing) {
          return (
            <div className="relative h-4 w-4">
              <div className="absolute inset-0 animate-spin">
                <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
              </div>
            </div>
          )
        }
        return <Video className="h-4 w-4" />
      case "image":
        return <ImageIcon className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  useEffect(() => {
    const text = "Welcome to OpenJustice, Counselor Lindquist"
    let index = 0

    const timer = setInterval(() => {
      if (index <= text.length) {
        setDisplayedText(text.slice(0, index))
        index++
      } else {
        clearInterval(timer)
      }
    }, 80)

    return () => clearInterval(timer)
  }, [])

  // Initialize all queries as expanded on mount
  useEffect(() => {
    const allQueryIds = queries.map(q => q.id)
    setExpandedQueries(new Set(allQueryIds))
  }, [queries])

  // Load session on mount
  useEffect(() => {
    const loadSession = async () => {
      try {
        const session = await getSession()
        
        if (session.files && session.files.length > 0) {
          // Map session files to component state format
          const formattedFiles: UploadedFile[] = session.files.map(file => ({
            id: file.id,
            name: file.name,
            type: file.type || 'document',
            size: file.size,
            uploadedAt: new Date(file.uploadedAt),
            isTranscribing: false,
            transcriptionProgress: undefined
          }))
          setUploadedFiles(formattedFiles)
          
          toast({
            title: "Session restored",
            description: `Loaded ${formattedFiles.length} file(s) from previous session.`,
          })
        }
        
        if (session.queries && session.queries.length > 0) {
          // Restore queries from session
          setQueries(session.queries)
        }
      } catch (error) {
        console.error('Failed to load session:', error)
        // Silent fail - user can still use the app
      }
    }
    
    loadSession()
  }, [])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    for (const file of Array.from(files)) {
      const isDuplicate = uploadedFiles.some(
        (existingFile) =>
          existingFile.name === file.name && existingFile.size === `${(file.size / 1024 / 1024).toFixed(1)} MB`,
      )

      if (isDuplicate) {
        toast({
          title: "Duplicate File",
          description: "This file has already been uploaded.",
          variant: "destructive",
        })
        continue
      }

      let fileType = "document"
      const extension = file.name.split(".").pop()?.toLowerCase()

      if (extension === "pdf") {
        fileType = "pdf"
      } else if (["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(extension || "")) {
        fileType = "image"
      } else if (["mp4", "avi", "webm", "mpv", "ogg"].includes(extension || "")) {
        fileType = "video"
      } else if (["wav", "mp3", "flac", "aiff", "aac"].includes(extension || "")) {
        fileType = "audio"
      }

      try {
        // Upload file to backend
        const response = await uploadFileAPI(file)
        
        if (response.success && response.file) {
          const newFile: UploadedFile = {
            id: response.file.id,
            name: response.file.name,
            size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
            type: fileType,
            uploadedAt: new Date(response.file.uploadedAt),
            isTranscribing: isTranscribableFile(fileType),
            transcriptionProgress: isTranscribableFile(fileType) ? 0 : undefined,
          }

          setUploadedFiles((prev) => [...prev, newFile])

          // Keep mock transcription animation for now
          if (isTranscribableFile(fileType)) {
            let progress = 0
            const transcriptionTimer = setInterval(() => {
              progress += Math.random() * 15 + 5

              if (progress >= 100) {
                progress = 100
                clearInterval(transcriptionTimer)

                setUploadedFiles((prev) =>
                  prev.map((f) => (f.id === newFile.id ? { ...f, isTranscribing: false, transcriptionProgress: 100 } : f)),
                )
              } else {
                setUploadedFiles((prev) =>
                  prev.map((f) => (f.id === newFile.id ? { ...f, transcriptionProgress: progress } : f)),
                )
              }
            }, 200)
          }

          toast({
            title: "File uploaded",
            description: `${file.name} has been uploaded successfully.`,
          })
        } else {
          throw new Error(response.error || "Upload failed")
        }
      } catch (error) {
        console.error('Upload error:', error)
        toast({
          title: "Upload failed",
          description: `Failed to upload ${file.name}. Please try again.`,
          variant: "destructive",
        })
      }
    }

    event.target.value = ""
  }

  const handleKeyDown = (e: React.KeyboardEvent, inputId: string) => {
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault()
      // Remove the 2-query limit for manual mode
      const newInput: QueryInput = {
        id: Math.random().toString(36).substr(2, 9),
        text: "",
      }
      setQueryInputs((prev) => [...prev, newInput])
      setQueryMode("manual")
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmitQuery(inputId)
    }
  }

  const handleSubmitQuery = async (inputId?: string) => {
    if (queryState === "input") {
      if (queryMode === "auto" && queryInputs.length === 1) {
        const inputText = queryInputs[0].text.trim()
        if (inputText) {
          // Store user context for swap functionality
          setUserContext(inputText)
          
          // Show loading state while extracting
          setQueryState("extracted")
          setExtractedQueries([])
          setIsExtractingQueries(true)
          
          const extracted = await extractQueries(inputText)
          setIsExtractingQueries(false)
          
          if (extracted.length > 0) {
            setExtractedQueries(extracted)
            setQueryState("extracted")
          } else {
            // If extraction failed, go back to input state
            setQueryState("input")
          }
        }
        return
      } else {
        submitQueries()
      }
    } else if (queryState === "extracted") {
      submitExtractedQueries()
    }
  }

  const generateCombinedAnalysis = (queryId: string) => {
    setQueries((prevQueries) =>
      prevQueries.map((q) =>
        q.id === queryId ? { ...q, combinedAnalysisRequested: true, combinedAnalysisProgress: 0 } : q,
      ),
    )

    let progress = 0
    const progressInterval = setInterval(() => {
      progress += Math.random() * 15 + 5
      if (progress >= 100) {
        progress = 100
        clearInterval(progressInterval)

        setTimeout(() => {
          setQueries((prevQueries) =>
            prevQueries.map((q) =>
              q.id === queryId
                ? {
                    ...q,
                    combinedAnalysisProgress: 100,
                    summary: `Summary: Cross-referencing all ${uploadedFiles.length} files reveals consistent patterns and ${Math.floor(Math.random() * 3) + 2} key legal precedents relevant to your query.`,
                  }
                : q,
            ),
          )
        }, 500)
      } else {
        setQueries((prevQueries) =>
          prevQueries.map((q) => (q.id === queryId ? { ...q, combinedAnalysisProgress: Math.min(progress, 100) } : q)),
        )
      }
    }, 200)
  }

  const submitExtractedQueries = async () => {
    const validQueries = extractedQueries.filter((q) => q.text.trim())
    if (validQueries.length === 0 || uploadedFiles.length === 0) return

    const sessionId = Date.now().toString()
    
    // Reset UI state immediately to show normal bottom bar
    setQueryState("input")
    setExtractedQueries([])
    setQueryInputs([{ id: Math.random().toString(36).substr(2, 9), text: "" }])
    setQueryMode("auto")

    // Process all extracted queries in parallel
    const queryPromises = validQueries.map(async (extractedQuery) => {
      const queryId = Math.random().toString(36).substr(2, 9)
      const queryText = extractedQuery.text.trim()
      
      const newQuery: Query = {
        id: queryId,
        text: queryText,
        status: "processing",
        sessionId,
        combinedAnalysisRequested: false,
        combinedAnalysisProgress: 0,
        fileResults: uploadedFiles.map((file) => ({
          fileId: file.id,
          fileName: file.name,
          result: "",
          status: "pending" as const,
          progress: 0,
        })),
      }
      
      setQueries((prev) => [...prev, newQuery])
      
      // Accumulate streamed text
      let accumulatedText = ""
      
      // Use streaming API
      return streamQuery(
        queryText,
        // onProgress callback with enhanced status handling
        (progress, status, message, attempt) => {
          // Show toast for hallucination detection
          if (status === 'retrying' && message && message.includes('Low confidence')) {
            const attemptNumber = attempt ? attempt.split('/')[0] : '1'
            toast({
              title: "Hallucination detected",
              description: `Rerunning query (Attempt ${attemptNumber})`,
              className: "bg-amber-50 border-amber-200",
            })
          }
          
          setQueries((prevQueries) =>
            prevQueries.map((q) =>
              q.id === queryId
                ? {
                    ...q,
                    fileResults: q.fileResults?.map((fr) => ({
                      ...fr,
                      status: status === 'verifying' ? 'anti-hallucination' as const :
                              status === 'retrying' ? 'retrying' as const :
                              status === 'failed' ? 'failed' as const :
                              status === 'completed' ? 'completed' as const : 
                              'processing' as const,
                      progress: progress,
                      message: message,
                      attempt: attempt,
                    })),
                  }
                : q,
            ),
          )
        },
        // onText callback - accumulate streamed text
        (text) => {
          accumulatedText += text
          setQueries((prevQueries) =>
            prevQueries.map((q) =>
              q.id === queryId
                ? {
                    ...q,
                    fileResults: q.fileResults?.map((fr) => ({
                      ...fr,
                      result: accumulatedText,
                    })),
                  }
                : q,
            ),
          )
        },
        // onComplete callback
        (result) => {
          setQueries((prevQueries) =>
            prevQueries.map((q) =>
              q.id === queryId
                ? {
                    ...q,
                    status: "completed" as const,
                    fileResults: q.fileResults?.map((fr) => ({
                      ...fr,
                      status: "completed" as const,
                      progress: 100,
                      result: result.final_text || accumulatedText,
                    })),
                  }
                : q,
            ),
          )
        },
        // onError callback
        (error) => {
          console.error('Query processing error:', error)
          setQueries((prevQueries) =>
            prevQueries.map((q) =>
              q.id === queryId
                ? {
                    ...q,
                    status: "completed" as const,
                    fileResults: q.fileResults?.map((fr) => ({
                      ...fr,
                      status: "completed" as const,
                      progress: 100,
                      result: `Error: ${error}`,
                    })),
                  }
                : q,
            ),
          )
        }
      )
    })
    
    // Wait for all queries to complete
    await Promise.all(queryPromises)
    
    toast({
      title: "All queries processed",
      description: `Completed ${validQueries.length} queries with verification.`,
    })
  }

  const submitQueries = async () => {
    const queriesToSubmit = queryInputs.filter((input) => input.text.trim())
    if (queriesToSubmit.length === 0 || uploadedFiles.length === 0) return

    const sessionId = Date.now().toString()

    // Process all queries in parallel
    const queryPromises = queriesToSubmit.map(async (targetInput) => {
      const queryId = Math.random().toString(36).substr(2, 9)
      const queryText = targetInput.text.trim()
      
      const newQuery: Query = {
        id: queryId,
        text: queryText,
        status: "processing",
        sessionId,
        combinedAnalysisRequested: false,
        combinedAnalysisProgress: 0,
        fileResults: uploadedFiles.map((file) => ({
          fileId: file.id,
          fileName: file.name,
          result: "",
          status: "pending" as const,
          progress: 0,
        })),
      }
      
      setQueries((prev) => [...prev, newQuery])
      
      // Accumulate streamed text
      let accumulatedText = ""
      
      // Use streaming API
      return streamQuery(
        queryText,
        // onProgress callback with enhanced status handling
        (progress, status, message, attempt) => {
          // Show toast for hallucination detection
          if (status === 'retrying' && message && message.includes('Low confidence')) {
            const attemptNumber = attempt ? attempt.split('/')[0] : '1'
            toast({
              title: "Hallucination detected",
              description: `Rerunning query (Attempt ${attemptNumber})`,
              className: "bg-amber-50 border-amber-200",
            })
          }
          
          setQueries((prevQueries) =>
            prevQueries.map((q) =>
              q.id === queryId
                ? {
                    ...q,
                    fileResults: q.fileResults?.map((fr) => ({
                      ...fr,
                      status: status === 'verifying' ? 'anti-hallucination' as const :
                              status === 'retrying' ? 'retrying' as const :
                              status === 'failed' ? 'failed' as const :
                              status === 'completed' ? 'completed' as const : 
                              'processing' as const,
                      progress: progress,
                      message: message,
                      attempt: attempt,
                    })),
                  }
                : q,
            ),
          )
        },
        // onText callback - accumulate streamed text
        (text) => {
          accumulatedText += text
          setQueries((prevQueries) =>
            prevQueries.map((q) =>
              q.id === queryId
                ? {
                    ...q,
                    fileResults: q.fileResults?.map((fr) => ({
                      ...fr,
                      result: accumulatedText,
                    })),
                  }
                : q,
            ),
          )
        },
        // onComplete callback
        (result) => {
          setQueries((prevQueries) =>
            prevQueries.map((q) =>
              q.id === queryId
                ? {
                    ...q,
                    status: "completed" as const,
                    fileResults: q.fileResults?.map((fr) => ({
                      ...fr,
                      status: "completed" as const,
                      progress: 100,
                      result: result.final_text || accumulatedText,
                    })),
                  }
                : q,
            ),
          )
          
          toast({
            title: "Query processed",
            description: `Analysis complete with ${(result.confidence * 100).toFixed(0)}% confidence.`,
          })
        },
        // onError callback
        (error) => {
          console.error('Query processing error:', error)
          setQueries((prevQueries) =>
            prevQueries.map((q) =>
              q.id === queryId
                ? {
                    ...q,
                    status: "completed" as const,
                    fileResults: q.fileResults?.map((fr) => ({
                      ...fr,
                      status: "completed" as const,
                      progress: 100,
                      result: `Error: ${error}`,
                    })),
                  }
                : q,
            ),
          )
          
          toast({
            title: "Processing failed",
            description: error,
            variant: "destructive",
          })
        }
      )
    })
    
    // Wait for all queries to complete
    await Promise.all(queryPromises)

    setQueryInputs([{ id: Math.random().toString(36).substr(2, 9), text: "" }])
    setQueryMode("auto")
  }

  const updateQueryInput = (inputId: string, text: string) => {
    setQueryInputs((prev) => prev.map((input) => (input.id === inputId ? { ...input, text } : input)))
  }

  const removeQueryInput = (inputId: string) => {
    if (queryInputs.length > 1) {
      setQueryInputs((prev) => prev.filter((input) => input.id !== inputId))
      // Remove auto mode switch when going back to 1 query
    }
  }
  
  const addQueryInput = () => {
    const newInput: QueryInput = {
      id: Math.random().toString(36).substr(2, 9),
      text: "",
    }
    setQueryInputs((prev) => [...prev, newInput])
    setQueryMode("manual")
  }
  
  const handleSwapInputQuery = async (inputId: string) => {
    const input = queryInputs.find(q => q.id === inputId)
    if (!input || !input.text.trim()) return
    
    // Store previous text for undo
    setPreviousInputs(prev => new Map(prev).set(inputId, input.text))
    
    // Mark as swapping
    setSwappingInputs(prev => new Set(prev).add(inputId))
    
    try {
      // Get all current query texts except the one being swapped
      const existingQueries = queryInputs
        .filter(q => q.id !== inputId && q.text.trim())
        .map(q => q.text)
      
      // Use the first non-empty query as context if no userContext is set
      const context = userContext || queryInputs.find(q => q.text.trim())?.text || "legal document analysis"
      
      // Call API to get replacement
      const result = await swapQuery(input.text, context, existingQueries)
      
      if (result.success && result.query) {
        // Update the input with new text
        setQueryInputs(prev => 
          prev.map(q => q.id === inputId ? { ...q, text: result.query } : q)
        )
        
        // Mark as swapped
        setSwappedInputs(prev => new Set(prev).add(inputId))
        
        toast({
          title: "Query swapped",
          description: "Generated a new question successfully.",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate replacement query. Please try again.",
        variant: "destructive",
      })
    } finally {
      // Remove from swapping state
      setSwappingInputs(prev => {
        const newSet = new Set(prev)
        newSet.delete(inputId)
        return newSet
      })
    }
  }
  
  const handleUndoInputSwap = (inputId: string) => {
    const previousText = previousInputs.get(inputId)
    if (!previousText) return
    
    // Restore previous text
    setQueryInputs(prev => 
      prev.map(q => q.id === inputId ? { ...q, text: previousText } : q)
    )
    
    // Remove from swapped state and previous inputs
    setSwappedInputs(prev => {
      const newSet = new Set(prev)
      newSet.delete(inputId)
      return newSet
    })
    setPreviousInputs(prev => {
      const newMap = new Map(prev)
      newMap.delete(inputId)
      return newMap
    })
    
    toast({
      title: "Query restored",
      description: "Reverted to the original question.",
    })
  }

  const updateExtractedQuery = (queryId: string, text: string) => {
    setExtractedQueries((prev) => prev.map((q) => (q.id === queryId ? { ...q, text } : q)))
  }

  const removeExtractedQuery = (queryId: string) => {
    setExtractedQueries((prev) => prev.filter((q) => q.id !== queryId))
  }

  const handleSwapQuery = async (queryId: string) => {
    const query = extractedQueries.find(q => q.id === queryId)
    if (!query) return
    
    // Store previous query text for undo
    setPreviousQueries(prev => new Map(prev).set(queryId, query.text))
    
    // Mark as swapping
    setSwappingQueries(prev => new Set(prev).add(queryId))
    
    try {
      // Get all current query texts except the one being swapped
      const existingQueries = extractedQueries
        .filter(q => q.id !== queryId)
        .map(q => q.text)
      
      // Call API to get replacement
      const result = await swapQuery(query.text, userContext, existingQueries)
      
      if (result.success && result.query) {
        // Update the query with new text
        setExtractedQueries(prev => 
          prev.map(q => q.id === queryId ? { ...q, text: result.query } : q)
        )
        
        // Mark as swapped
        setSwappedQueries(prev => new Set(prev).add(queryId))
        
        toast({
          title: "Query swapped",
          description: "Generated a new question successfully.",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate replacement query. Please try again.",
        variant: "destructive",
      })
    } finally {
      // Remove from swapping state
      setSwappingQueries(prev => {
        const newSet = new Set(prev)
        newSet.delete(queryId)
        return newSet
      })
    }
  }
  
  const handleUndoSwap = (queryId: string) => {
    const previousText = previousQueries.get(queryId)
    if (!previousText) return
    
    // Restore previous text
    setExtractedQueries(prev => 
      prev.map(q => q.id === queryId ? { ...q, text: previousText } : q)
    )
    
    // Remove from swapped state and previous queries
    setSwappedQueries(prev => {
      const newSet = new Set(prev)
      newSet.delete(queryId)
      return newSet
    })
    setPreviousQueries(prev => {
      const newMap = new Map(prev)
      newMap.delete(queryId)
      return newMap
    })
    
    toast({
      title: "Query restored",
      description: "Reverted to the original question.",
    })
  }

  const handleSelectFromFavorites = (query: string) => {
    const newQuery: ExtractedQuery = {
      id: Math.random().toString(36).substr(2, 9),
      text: query,
      questionNumber: extractedQueries.length + 1,
    }
    setExtractedQueries((prev) => [...prev, newQuery])
  }

  const cancelExtraction = () => {
    setQueryState("input")
    setExtractedQueries([])
    setIsExtractingQueries(false)
  }

  const handleNewChat = () => {
    setUploadedFiles([])
    setQueries([])
    setQueryInputs([{ id: Math.random().toString(36).substr(2, 9), text: "" }])
    setQueryMode("auto")
    setQueryState("input")
    setExtractedQueries([])
  }

  const getSourceAnalysisData = () => {
    const sourceMap = new Map<
      string,
      {
        fileName: string
        fileId: string
        queries: Query[]
        allCompleted: boolean
        hasAnalysis: boolean
      }
    >()

    queries.forEach((query) => {
      query.fileResults?.forEach((fileResult) => {
        const key = fileResult.fileId
        if (!sourceMap.has(key)) {
          sourceMap.set(key, {
            fileName: fileResult.fileName,
            fileId: fileResult.fileId,
            queries: [],
            allCompleted: false,
            hasAnalysis: false,
          })
        }
        const sourceData = sourceMap.get(key)!
        sourceData.queries.push(query)

        const allQueriesCompleted = sourceData.queries.every(
          (q) => q.fileResults?.find((fr) => fr.fileId === key)?.status === "completed",
        )
        sourceData.allCompleted = allQueriesCompleted

        sourceData.hasAnalysis = sourceData.queries.some((q) => q.summary)
      })
    })

    return Array.from(sourceMap.values())
  }

  const generateSourceCombinedAnalysis = async (fileId: string) => {
    const sourceData = getSourceAnalysisData().find((s) => s.fileId === fileId)
    if (!sourceData) return

    setProcessingSourceIds((prev) => new Set([...prev, fileId]))

    const firstQuery = sourceData.queries[0]
    if (firstQuery) {
      setQueries((prevQueries) =>
        prevQueries.map((q) =>
          q.id === firstQuery.id ? { ...q, combinedAnalysisRequested: true, combinedAnalysisProgress: 20 } : q,
        ),
      )

      try {
        // Call real API for combined analysis
        const response = await generateCombinedAnalysisAPI(fileId)
        
        if (response.success) {
          setQueries((prevQueries) =>
            prevQueries.map((q) =>
              q.id === firstQuery.id
                ? {
                    ...q,
                    combinedAnalysisProgress: 100,
                    summary: response.analysis,
                  }
                : q,
            ),
          )
          
          toast({
            title: "Combined Analysis Complete",
            description: `Generated comprehensive analysis for ${response.file_name} covering ${response.query_count} queries.`,
          })
        } else {
          throw new Error(response.error || "Analysis failed")
        }
      } catch (error) {
        console.error('Combined analysis error:', error)
        setQueries((prevQueries) =>
          prevQueries.map((q) =>
            q.id === firstQuery.id
              ? {
                  ...q,
                  combinedAnalysisProgress: 0,
                  combinedAnalysisRequested: false,
                  summary: `Error: Failed to generate combined analysis. ${error instanceof Error ? error.message : 'Unknown error'}`,
                }
              : q,
          ),
        )
        
        toast({
          title: "Analysis Failed",
          description: "Failed to generate combined analysis. Please try again.",
          variant: "destructive",
        })
      } finally {
        setProcessingSourceIds((prev) => {
          const newSet = new Set(prev)
          newSet.delete(fileId)
          return newSet
        })
      }
    }
  }

  const generateAllCombinedAnalysis = () => {
    const eligibleSources = getSourceAnalysisData().filter(
      (sourceData) => sourceData.allCompleted && !sourceData.hasAnalysis && !processingSourceIds.has(sourceData.fileId),
    )

    eligibleSources.forEach((sourceData) => {
      generateSourceCombinedAnalysis(sourceData.fileId)
    })
  }

  const addExtractedQuery = () => {
    const newQuery: ExtractedQuery = {
      id: Math.random().toString(36).substr(2, 9),
      text: "",
      questionNumber: extractedQueries.length + 1,
    }
    setExtractedQueries((prev) => [...prev, newQuery])
  }

  const handleVoiceInput = async () => {
    if (recordingState === "recording") {
      setRecordingState("processing")

      // Simulate processing time with reduced duration for better UX
      setTimeout(() => {
        const mockTranscriptions = [
          "What are the key legal precedents in this case?",
          "Analyze the evidence presented in the discovery documents",
          "What are the potential defenses available to the defendant?",
          "Summarize the main arguments from both parties",
          "What damages are being sought in this lawsuit?",
        ]

        const randomTranscription = mockTranscriptions[Math.floor(Math.random() * mockTranscriptions.length)]
        updateQueryInput(queryInputs[0].id, randomTranscription)

        if (queryMode === "auto") {
          setTimeout(() => {
            handleSubmitQuery()
          }, 300)
        }

        setRecordingState("idle")
      }, 1500) // Reduced processing time from 2000ms to 1500ms
    } else {
      setRecordingState("recording")
    }
  }

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar sidebarOpen={sidebarOpen} onNewChat={handleNewChat} />

      <div className="flex-1 flex flex-col">
        <div className="h-12 flex items-center justify-between px-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-muted-foreground hover:text-foreground"
            >
              {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
            <h1 className="text-lg font-semibold text-balance">{displayedText}</h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Files
          </Button>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          {uploadedFiles.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-8">
                <Card
                  className="w-full max-w-md p-8 text-center border-dashed border-2 hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="mb-4">
                    <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Upload Case Files</h3>
                    <p className="text-muted-foreground text-sm text-pretty">
                      Upload files (PDFs, audio, video) to begin analysis.
                    </p>
                    <p className="text-muted-foreground text-sm text-pretty mt-1">
                      All files are processed locally for security.
                    </p>
                  </div>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation()
                      fileInputRef.current?.click()
                    }}
                    className="w-full h-12 text-base font-medium bg-primary hover:bg-primary/90 border-0"
                    size="lg"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Select Files
                  </Button>
                </Card>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,audio/*,video/*,image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col">
                {queries.length === 0 ? (
                  <div className="flex-1 flex items-start justify-center pt-16 p-8">
                    <div className="text-center max-w-md">
                      <Search className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Ready to Analyze</h3>
                      <p className="text-muted-foreground text-sm text-pretty">
                        Your files have been uploaded. Ask questions about your case files using the query box below.
                      </p>
                    </div>
                  </div>
                ) : (
                  <ScrollArea className="h-full w-full">
                    <div className="max-w-4xl mx-auto space-y-4 p-3 pb-6">
                      {(() => {
                        const groupedQueries = queries.reduce(
                          (acc, query) => {
                            if (!acc[query.sessionId]) {
                              acc[query.sessionId] = []
                            }
                            acc[query.sessionId].push(query)
                            return acc
                          },
                          {} as Record<string, Query[]>,
                        )

                        const sessionIds = Object.keys(groupedQueries).sort()

                        return sessionIds.map((sessionId, sessionIndex) => (
                          <div key={sessionId}>
                            {sessionIndex > 0 && (
                              <div className="flex items-center gap-3 my-6">
                                <div className="flex-1 h-px bg-border"></div>
                                <div className="text-xs text-muted-foreground bg-background px-2">
                                  {new Date(Number.parseInt(sessionId)).toLocaleString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    hour: "numeric",
                                    minute: "2-digit",
                                    hour12: true,
                                  })}
                                </div>
                                <div className="flex-1 h-px bg-border"></div>
                              </div>
                            )}

                            {groupedQueries[sessionId].map((query) => (
                              <div key={query.id} className="space-y-2.5 mb-4">
                                <div 
                                  className="flex items-center gap-2 mb-2 cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() => {
                                    const newExpanded = new Set(expandedQueries)
                                    if (newExpanded.has(query.id)) {
                                      newExpanded.delete(query.id)
                                    } else {
                                      newExpanded.add(query.id)
                                    }
                                    setExpandedQueries(newExpanded)
                                  }}
                                >
                                  <Search className="h-4 w-4 text-primary" />
                                  <h3 className="text-sm font-semibold flex-1">{query.text}</h3>
                                  {expandedQueries.has(query.id) ? (
                                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>

                                {expandedQueries.has(query.id) && (
                                  <div className="space-y-1.5">
                                  {query.fileResults?.map((fileResult) => (
                                    <Card 
                                      key={fileResult.fileId} 
                                      className={`p-2.5 transition-colors duration-300 ${
                                        fileResult.status === "anti-hallucination" || fileResult.status === "retrying" 
                                          ? "bg-amber-50 border-amber-200" 
                                          : ""
                                      }`}
                                    >
                                      <div className="flex items-start gap-2">
                                        {getFileIcon(
                                          uploadedFiles.find((f) => f.id === fileResult.fileId)?.type || "document",
                                          uploadedFiles.find((f) => f.id === fileResult.fileId)?.isTranscribing,
                                          uploadedFiles.find((f) => f.id === fileResult.fileId)?.transcriptionProgress,
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-0.5">
                                            <h4 className="font-medium text-xs truncate">{fileResult.fileName}</h4>
                                            <Badge variant="outline" className="text-xs px-1 py-0">
                                              {uploadedFiles.find((f) => f.id === fileResult.fileId)?.size}
                                            </Badge>
                                          </div>

                                          {fileResult.status === "pending" && (
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                              <div className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-pulse"></div>
                                              <span className="text-xs">Queued for analysis...</span>
                                            </div>
                                          )}

                                          {fileResult.status === "processing" && (
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                              <div className="flex gap-0.5">
                                                <div className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce"></div>
                                                <div
                                                  className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce"
                                                  style={{ animationDelay: "0.1s" }}
                                                ></div>
                                                <div
                                                  className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce"
                                                  style={{ animationDelay: "0.2s" }}
                                                ></div>
                                              </div>
                                              <span className="text-xs">Analyzing document...</span>
                                            </div>
                                          )}

                                          {fileResult.status === "anti-hallucination" && (
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                              <div className="flex gap-0.5">
                                                <div className="w-1.5 h-1.5 bg-orange-500/60 rounded-full animate-pulse"></div>
                                                <div
                                                  className="w-1.5 h-1.5 bg-orange-500/60 rounded-full animate-pulse"
                                                  style={{ animationDelay: "0.2s" }}
                                                ></div>
                                              </div>
                                              <span className="text-xs">Verifying accuracy...</span>
                                            </div>
                                          )}

                                          {fileResult.status === "completed" && (
                                            <p className="text-xs text-muted-foreground leading-relaxed">
                                              {fileResult.result}
                                            </p>
                                          )}
                                        </div>

                                        <div className="flex-shrink-0">
                                          <ProcessingBar 
                                            progress={fileResult.progress} 
                                            status={fileResult.status} 
                                            message={fileResult.message} 
                                            attempt={fileResult.attempt} 
                                            isRetrying={fileResult.status === "retrying" || fileResult.status === "anti-hallucination"}
                                          />
                                        </div>
                                      </div>
                                    </Card>
                                  ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ))
                      })()}

                      {getSourceAnalysisData().map((sourceData) => (
                        <div key={sourceData.fileId}>
                          {sourceData.queries.some((q) => q.combinedAnalysisRequested || q.summary) && (
                            <Card className="p-2.5 bg-primary/5 border-primary/20 mt-2.5">
                              <div className="flex items-start gap-2">
                                <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between mb-0.5">
                                    <h4 className="font-medium text-xs text-primary">
                                      Combined Analysis - {sourceData.fileName}
                                    </h4>
                                    {sourceData.queries.some((q) => q.combinedAnalysisRequested && !q.summary) && (
                                      <CombinedAnalysisBar
                                        progress={
                                          sourceData.queries.find((q) => q.combinedAnalysisRequested)
                                            ?.combinedAnalysisProgress || 0
                                        }
                                      />
                                    )}
                                  </div>
                                  {sourceData.queries.find((q) => q.summary)?.summary ? (
                                    <p className="text-xs leading-relaxed">
                                      {sourceData.queries.find((q) => q.summary)?.summary}
                                    </p>
                                  ) : (
                                    <p className="text-xs text-muted-foreground">
                                      Generating comprehensive analysis...
                                    </p>
                                  )}
                                </div>
                              </div>
                            </Card>
                          )}
                        </div>
                      ))}

                      {(() => {
                        const eligibleSources = getSourceAnalysisData().filter(
                          (sourceData) => sourceData.allCompleted && !sourceData.hasAnalysis,
                        )

                        if (eligibleSources.length === 0) return null

                        return (
                          <div className="flex flex-wrap justify-center gap-2 pt-3">
                            {eligibleSources.length > 1 && (
                              <Button
                                onClick={generateAllCombinedAnalysis}
                                variant="default"
                                size="sm"
                                className="text-xs h-7 bg-primary hover:bg-primary/90 text-primary-foreground"
                                disabled={eligibleSources.every((source) => processingSourceIds.has(source.fileId))}
                              >
                                <BarChart3 className="h-3 w-3 mr-1" />
                                Generate All Combined Analysis
                              </Button>
                            )}
                            {eligibleSources.map((sourceData) => {
                              const isProcessing = processingSourceIds.has(sourceData.fileId)
                              return (
                                <Button
                                  key={sourceData.fileId}
                                  onClick={() => generateSourceCombinedAnalysis(sourceData.fileId)}
                                  variant="outline"
                                  size="sm"
                                  className={`text-xs h-7 ${
                                    isProcessing
                                      ? "bg-primary/10 border-primary text-primary"
                                      : "bg-transparent border-primary/30 hover:bg-primary/5 text-primary"
                                  }`}
                                  disabled={isProcessing}
                                >
                                  <BarChart3 className="h-3 w-3 mr-1" />
                                  {isProcessing
                                    ? "Processing..."
                                    : `Combined Analysis: ${sourceData.fileName}`}
                                </Button>
                              )
                            })}
                          </div>
                        )
                      })()}
                    </div>
                  </ScrollArea>
                )}
            </div>
          )}

          <BottomBar
            uploadedFiles={uploadedFiles}
            queryState={queryState}
            queryInputs={queryInputs}
            extractedQueries={extractedQueries}
            queryMode={queryMode}
            isExtractingQueries={isExtractingQueries}
            recordingState={recordingState}
            fileInputRef={fileInputRef}
            textareaRef={textareaRef}
            favoritesModalOpen={favoritesModalOpen}
            swappingQueries={swappingQueries}
            swappedQueries={swappedQueries}
            previousQueries={previousQueries}
            swappingInputs={swappingInputs}
            swappedInputs={swappedInputs}
            previousInputs={previousInputs}
            onRemoveFile={removeFile}
            onAddFile={() => fileInputRef.current?.click()}
            onUpdateQueryInput={updateQueryInput}
            onRemoveQueryInput={removeQueryInput}
            onAddQueryInput={addQueryInput}
            onUpdateExtractedQuery={updateExtractedQuery}
            onRemoveExtractedQuery={removeExtractedQuery}
            onAddExtractedQuery={addExtractedQuery}
            onSubmitQuery={handleSubmitQuery}
            onSubmitExtractedQueries={submitExtractedQueries}
            onCancelExtraction={cancelExtraction}
            onKeyDown={handleKeyDown}
            onSetQueryMode={setQueryMode}
            onSetFavoritesModalOpen={setFavoritesModalOpen}
            onVoiceInput={handleVoiceInput}
            onSwapQuery={handleSwapQuery}
            onUndoSwap={handleUndoSwap}
            onSwapInputQuery={handleSwapInputQuery}
            onUndoInputSwap={handleUndoInputSwap}
          />

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,audio/*,video/*,image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </div>
      <FavoritesModal
        isOpen={favoritesModalOpen}
        onClose={() => setFavoritesModalOpen(false)}
        onSelectQuery={handleSelectFromFavorites}
        currentQuery={extractedQueries.length > 0 ? extractedQueries[extractedQueries.length - 1]?.text : ""}
      />
    </div>
  )
}

export default LegalCaseAnalysis
