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
import { 
  extractQueries as extractQueriesAPI, 
  uploadFile as uploadFileAPI,
  getSession,
  deleteFile as deleteFileAPI,
  processQuery,
  streamQuery,
  generateCombinedAnalysis as generateCombinedAnalysisAPI
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
    status: "pending" | "processing" | "anti-hallucination" | "completed"
    progress: number
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
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const [processingSourceIds, setProcessingSourceIds] = useState<Set<string>>(new Set())
  const [favoritesModalOpen, setFavoritesModalOpen] = useState(false)
  const [isExtractingQueries, setIsExtractingQueries] = useState(false)

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
      
      // Map the API response to our ExtractedQuery format
      return result.queries.map((query, index) => ({
        id: Math.random().toString(36).substr(2, 9),
        text: query.text,
        questionNumber: index + 1,
      }))
    } catch (error) {
      console.error('Error extracting queries:', error)
      toast({
        title: "Error",
        description: "Failed to extract queries. Please try again.",
        variant: "destructive",
      })
      return []
    }
  }

  const ProcessingBar: React.FC<{ progress: number; status: string; message?: string; attempt?: string }> = ({ progress, status, message, attempt }) => {
    if (status === "pending") return (
      <div className="flex items-center gap-2 ml-auto">
        <span className="text-xs text-muted-foreground">Queued for analysis...</span>
      </div>
    )
    
    if (status === "completed" && !attempt) return null

    return (
      <div className="flex items-center gap-2 ml-auto">
        <div className="flex flex-col items-end">
          {message && (
            <span className="text-xs text-muted-foreground mb-1">{message}</span>
          )}
          <div className="flex items-center gap-2">
            {attempt && (
              <span className="text-xs font-mono text-primary">{attempt}</span>
            )}
            <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all duration-300 ease-out" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs text-muted-foreground font-mono min-w-[32px]">{progress}%</span>
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
    const text = "Welcome back, Counselor Gupta"
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
      if (queryInputs.length < 2) {
        const newInput: QueryInput = {
          id: Math.random().toString(36).substr(2, 9),
          text: "",
        }
        setQueryInputs((prev) => [...prev, newInput])
        setQueryMode("manual")
      }
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
                    summary: result.is_verified 
                      ? `✓ Verified with ${(result.confidence * 100).toFixed(0)}% confidence`
                      : undefined,
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

    setQueryState("input")
    setExtractedQueries([])
    setQueryInputs([{ id: Math.random().toString(36).substr(2, 9), text: "" }])
    setQueryMode("auto")
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
                    summary: result.is_verified 
                      ? `✓ Verified with ${(result.confidence * 100).toFixed(0)}% confidence`
                      : undefined,
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
      if (queryInputs.length === 2) {
        setQueryMode("auto")
      }
    }
  }

  const updateExtractedQuery = (queryId: string, text: string) => {
    setExtractedQueries((prev) => prev.map((q) => (q.id === queryId ? { ...q, text } : q)))
  }

  const removeExtractedQuery = (queryId: string) => {
    setExtractedQueries((prev) => prev.filter((q) => q.id !== queryId))
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

      <div className="flex-1 flex flex-col overflow-hidden">
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

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden">
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
              <div className="flex-1 flex flex-col overflow-hidden">
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
                  <ScrollArea className="flex-1">
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
                                <div className="flex items-center gap-2 mb-2">
                                  <Search className="h-4 w-4 text-primary" />
                                  <h3 className="text-sm font-semibold">{query.text}</h3>
                                </div>

                                <div className="space-y-1.5">
                                  {query.fileResults?.map((fileResult) => (
                                    <Card key={fileResult.fileId} className="p-2.5">
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
                                          <ProcessingBar progress={fileResult.progress} status={fileResult.status} message={fileResult.message} attempt={fileResult.attempt} />
                                        </div>
                                      </div>
                                    </Card>
                                  ))}
                                </div>
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

                        const totalQueries = eligibleSources.reduce((sum, source) => sum + source.queries.length, 0)
                        const totalFiles = eligibleSources.length

                        // Only show combined analysis if there are multiple queries OR multiple files
                        if (totalQueries <= 1 && totalFiles <= 1) return null

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
                                    : `Generate Combined Analysis for ${sourceData.fileName}`}
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

            <div className="flex-shrink-0">
              <div className="p-2.5">
                <div className="max-w-4xl mx-auto">
                      <div className="mb-1.5">
                        <div className="flex flex-wrap gap-1">
                          {uploadedFiles.map((file) => (
                            <Badge
                              key={file.id}
                              variant="secondary"
                              className={`flex items-center gap-1 px-1.5 py-0.5 text-xs transition-colors ${
                                isTranscribableFile(file.type)
                                  ? file.isTranscribing
                                    ? "bg-slate-600/70 hover:bg-slate-600/80 text-slate-200"
                                    : "bg-slate-500/50 hover:bg-slate-500/60 text-slate-300"
                                  : "bg-muted/50 hover:bg-muted/70"
                              }`}
                            >
                              {getFileIcon(file.type, file.isTranscribing, file.transcriptionProgress)}
                              <span className="max-w-[80px] truncate">{file.name}</span>
                              <span className="text-muted-foreground/70 text-xs">{file.size}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeFile(file.id)}
                                className="h-3 w-3 p-0 text-muted-foreground/60 hover:text-destructive ml-0.5"
                              >
                                <X className="h-2 w-2" />
                              </Button>
                            </Badge>
                          ))}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            className="h-5 px-1.5 text-xs text-muted-foreground hover:text-foreground border border-dashed border-muted-foreground/30 rounded-md"
                          >
                            <Plus className="h-2.5 w-2.5 mr-0.5" />
                            Add
                          </Button>
                        </div>
                      </div>

                      {queryState === "extracted" ? (
                        <div className="bg-card/95 backdrop-blur-sm border border-border rounded-xl shadow-sm">
                          <div className="p-3">
                            <div className="mb-3">
                              <h3 className="text-sm font-semibold mb-1">Extracted Questions</h3>
                              <p className="text-xs text-muted-foreground">
                                Review and edit the questions extracted from your input:
                              </p>
                            </div>

                            <div className="space-y-1 mb-3">
                              {isExtractingQueries ? (
                                // Skeleton loading animation
                                <>
                                  {[1, 2, 3, 4].map((index) => (
                                    <div key={`skeleton-${index}`} className="relative animate-pulse">
                                      <div className="flex items-start gap-2">
                                        <div className="text-xs text-muted-foreground/30 pt-1 min-w-0 flex-shrink-0">
                                          Question {index}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="min-h-[40px] rounded-md bg-muted/30">
                                            <div className="p-2 space-y-2">
                                              <div className="h-3 bg-muted/50 rounded w-full"></div>
                                              <div className="h-3 bg-muted/50 rounded w-4/5"></div>
                                            </div>
                                          </div>
                                        </div>
                                        <div className="h-6 w-6 bg-muted/20 rounded"></div>
                                      </div>
                                    </div>
                                  ))}
                                </>
                              ) : (
                                // Actual extracted queries
                                extractedQueries.map((query) => (
                                  <div key={query.id} className="relative">
                                    <div className="flex items-start gap-2">
                                      <div className="text-xs text-muted-foreground pt-1 min-w-0 flex-shrink-0">
                                        Question {query.questionNumber}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <Textarea
                                          value={query.text}
                                          onChange={(e) => updateExtractedQuery(query.id, e.target.value)}
                                          className="min-h-[40px] max-h-[80px] resize-none text-xs border-border/50 focus-visible:ring-1 focus-visible:ring-ring bg-background/50"
                                          rows={2}
                                        />
                                      </div>
                                      <Button
                                        onClick={() => removeExtractedQuery(query.id)}
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 text-muted-foreground/60 hover:text-muted-foreground flex-shrink-0"
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-border">
                              <div className="flex gap-2">
                                <Button
                                  onClick={addExtractedQuery}
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-7 bg-transparent"
                                  disabled={isExtractingQueries}
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add question
                                </Button>
                                <Button
                                  onClick={() => setFavoritesModalOpen(true)}
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-7 bg-transparent"
                                  disabled={isExtractingQueries}
                                >
                                  <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                                    />
                                  </svg>
                                  Add from favorites
                                </Button>
                              </div>
                              <div className="flex gap-2">
                                <Button onClick={cancelExtraction} variant="ghost" size="sm" className="text-xs h-7">
                                  Cancel
                                </Button>
                                <Button
                                  onClick={submitExtractedQueries}
                                  disabled={isExtractingQueries || !extractedQueries.some((q) => q.text.trim())}
                                  className="text-xs h-7 bg-primary hover:bg-primary/90"
                                  size="sm"
                                >
                                  {isExtractingQueries ? "Extracting..." : "Submit request"}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-card/95 backdrop-blur-sm border border-border rounded-xl shadow-sm">
                          <div className="p-3">
                            <div className="space-y-2">
                              <ScrollArea className={queryInputs.length > 1 ? "max-h-[100px] w-full" : ""}>
                                <div className="space-y-2 pr-2">
                                  {queryInputs.map((input, index) => (
                                    <div key={input.id} className="flex gap-2 items-start group">
                                      <div className="flex-1 min-w-0 relative">
                                        <Textarea
                                          ref={index === 0 ? textareaRef : undefined}
                                          value={input.text}
                                          onChange={(e) => updateQueryInput(input.id, e.target.value)}
                                          onKeyDown={(e) => handleKeyDown(e, input.id)}
                                          placeholder={
                                            index === 0
                                              ? queryMode === "auto"
                                                ? "Describe what you want to analyze in your case files..."
                                                : "Ask a question about your case files..."
                                              : `Query ${index + 1}...`
                                          }
                                          className={`min-h-[36px] max-h-[72px] resize-none shadow-none focus-visible:ring-1 focus-visible:ring-ring text-xs ${
                                            queryInputs.length === 1
                                              ? "border-0 bg-transparent p-0 placeholder:text-muted-foreground focus-visible:ring-0"
                                              : `border border-border rounded-md bg-background p-2 ${queryInputs.length > 1 ? "pr-8" : ""}`
                                          }`}
                                          rows={1}
                                        />
                                        {queryInputs.length > 1 && (
                                          <Button
                                            onClick={() => removeQueryInput(input.id)}
                                            variant="ghost"
                                            size="sm"
                                            className="absolute right-1.5 top-1/2 -translate-y-1/2 h-5 w-5 p-0 text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/80 opacity-70 group-hover:opacity-100 transition-all duration-200"
                                          >
                                            <X className="h-2.5 w-2.5" />
                                          </Button>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1.5 flex-shrink-0">
                                        {index === 0 && queryInputs.length === 1 && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleVoiceInput}
                                            disabled={recordingState === "processing"}
                                            className={`h-7 w-7 p-0 transition-all duration-300 ease-in-out ${
                                              recordingState === "recording"
                                                ? "text-red-500 bg-red-50/50 hover:bg-red-100/50 scale-105"
                                                : recordingState === "processing"
                                                  ? "text-blue-500 bg-blue-50/50"
                                                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50 hover:scale-105"
                                            }`}
                                            title={
                                              recordingState === "recording"
                                                ? "Click to stop recording"
                                                : recordingState === "processing"
                                                  ? "Processing voice input..."
                                                  : "Click to start voice input"
                                            }
                                          >
                                            {recordingState === "processing" ? (
                                              <div className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                              <Mic
                                                className={`h-3.5 w-3.5 transition-transform duration-200 ${
                                                  recordingState === "recording" ? "animate-pulse scale-110" : ""
                                                }`}
                                              />
                                            )}
                                          </Button>
                                        )}
                                        {((queryInputs.length === 1 && index === 0) ||
                                          (queryInputs.length > 1 && index === queryInputs.length - 1)) && (
                                          <Button
                                            onClick={() => handleSubmitQuery()}
                                            disabled={!queryInputs.some((input) => input.text.trim())}
                                            className="h-8 px-3 bg-white hover:bg-gray-50 text-black border border-gray-300 shadow-sm text-xs"
                                            size="sm"
                                          >
                                            <Send className="h-3.5 w-3.5 stroke-black" />
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </ScrollArea>
                            </div>

                            <div className="mt-1.5 pt-1.5 border-t border-border">
                              <div className="flex items-center gap-2">
                                <Button
                                  onClick={() => setQueryMode(queryMode === "auto" ? "manual" : "auto")}
                                  variant="outline"
                                  size="sm"
                                  className="h-5 px-2 text-xs bg-transparent border-muted-foreground/30 hover:bg-muted/50"
                                >
                                  {queryMode === "auto" ? "Auto" : "Manual"}
                                </Button>
                                <p className="text-xs text-muted-foreground">
                                  {queryMode === "auto"
                                    ? "Press Enter to submit, Shift + Enter for manual mode"
                                    : "Press Shift + Enter for new query, Enter to submit"}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                </div>

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
          </div>
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
