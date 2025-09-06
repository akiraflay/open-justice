"use client"

import React, { RefObject, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { Plus, X, Send, Mic, RefreshCw, Undo } from "lucide-react"

interface UploadedFile {
  id: string
  name: string
  type: string
  size: string
  uploadedAt: Date
  isTranscribing?: boolean
  transcriptionProgress?: number
}

interface ExtractedQuery {
  id: string
  text: string
  questionNumber: number
}

interface QueryInput {
  id: string
  text: string
}

interface BottomBarProps {
  uploadedFiles: UploadedFile[]
  queryState: "input" | "extracted"
  queryInputs: QueryInput[]
  extractedQueries: ExtractedQuery[]
  queryMode: "auto" | "manual"
  isExtractingQueries: boolean
  recordingState: "idle" | "recording" | "processing"
  fileInputRef: RefObject<HTMLInputElement>
  textareaRef?: RefObject<HTMLTextAreaElement>
  favoritesModalOpen: boolean
  
  // Swap state for extracted queries
  swappingQueries?: Set<string>
  swappedQueries?: Set<string>
  previousQueries?: Map<string, string>
  
  // Swap state for manual inputs
  swappingInputs?: Set<string>
  swappedInputs?: Set<string>
  previousInputs?: Map<string, string>
  
  // Handlers
  onRemoveFile: (fileId: string) => void
  onAddFile: () => void
  onUpdateQueryInput: (inputId: string, text: string) => void
  onRemoveQueryInput: (inputId: string) => void
  onAddQueryInput?: () => void
  onUpdateExtractedQuery: (queryId: string, text: string) => void
  onRemoveExtractedQuery: (queryId: string) => void
  onAddExtractedQuery: () => void
  onSubmitQuery: () => void
  onSubmitExtractedQueries: () => void
  onCancelExtraction: () => void
  onKeyDown: (e: React.KeyboardEvent, inputId: string) => void
  onSetQueryMode: (mode: "auto" | "manual") => void
  onSetFavoritesModalOpen: (open: boolean) => void
  onVoiceInput: () => void
  onSwapQuery?: (queryId: string) => void
  onUndoSwap?: (queryId: string) => void
  onSwapInputQuery?: (inputId: string) => void
  onUndoInputSwap?: (inputId: string) => void
}

export function BottomBar({
  uploadedFiles,
  queryState,
  queryInputs,
  extractedQueries,
  queryMode,
  isExtractingQueries,
  recordingState,
  fileInputRef,
  textareaRef,
  swappingQueries = new Set(),
  swappedQueries = new Set(),
  previousQueries = new Map(),
  swappingInputs = new Set(),
  swappedInputs = new Set(),
  previousInputs = new Map(),
  onRemoveFile,
  onAddFile,
  onUpdateQueryInput,
  onRemoveQueryInput,
  onAddQueryInput,
  onUpdateExtractedQuery,
  onRemoveExtractedQuery,
  onAddExtractedQuery,
  onSubmitQuery,
  onSubmitExtractedQueries,
  onCancelExtraction,
  onKeyDown,
  onSetQueryMode,
  onSetFavoritesModalOpen,
  onVoiceInput,
  onSwapQuery,
  onUndoSwap,
  onSwapInputQuery,
  onUndoInputSwap,
}: BottomBarProps) {
  const [visibleQuestionCount, setVisibleQuestionCount] = useState(1)

  useEffect(() => {
    if (isExtractingQueries) {
      setVisibleQuestionCount(1)
      const timer = setInterval(() => {
        setVisibleQuestionCount(prev => prev < 4 ? prev + 1 : prev)
      }, 400)
      return () => clearInterval(timer)
    } else if (extractedQueries.length > 0) {
      // Reset for smooth transition when showing actual queries
      setVisibleQuestionCount(extractedQueries.length)
    }
  }, [isExtractingQueries, extractedQueries.length])

  const isTranscribableFile = (fileType: string) => {
    return fileType === "audio" || fileType === "video"
  }

  const getFileIcon = (type: string, isTranscribing?: boolean) => {
    switch (type) {
      case "pdf":
        return <span className="text-xs">📄</span>
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
        return <span className="text-xs">🎵</span>
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
        return <span className="text-xs">🎬</span>
      case "image":
        return <span className="text-xs">🖼️</span>
      default:
        return <span className="text-xs">📄</span>
    }
  }

  return (
    <div 
      className="flex-shrink-0 bg-background/80 backdrop-blur-lg shadow-lg"
      role="region"
      aria-label="Query input area"
    >
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
                        ? "bg-slate-600/60 hover:bg-slate-600/70 text-slate-200 backdrop-blur-sm"
                        : "bg-slate-500/40 hover:bg-slate-500/50 text-slate-300 backdrop-blur-sm"
                      : "bg-muted/40 hover:bg-muted/60 backdrop-blur-sm"
                  }`}
                >
                  {getFileIcon(file.type, file.isTranscribing)}
                  <span className="max-w-[80px] truncate">{file.name}</span>
                  <span className="text-muted-foreground/70 text-xs">{file.size}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveFile(file.id)}
                    className="h-3 w-3 p-0 text-muted-foreground/60 hover:text-destructive ml-0.5"
                  >
                    <X className="h-2 w-2" />
                  </Button>
                </Badge>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={onAddFile}
                className="h-5 px-1.5 text-xs text-muted-foreground hover:text-foreground border border-dashed border-muted-foreground/30 rounded-md backdrop-blur-sm bg-background/30 interactive-scale focus-ring"
              >
                <Plus className="h-2.5 w-2.5 mr-0.5" />
                Add
              </Button>
            </div>
          </div>

          {queryState === "extracted" ? (
            <div className="bg-card/90 backdrop-blur-md border border-border/50 rounded-xl shadow-lg interactive-lift">
              <div className="p-3">
                <div className="mb-3">
                  <h3 className="text-hierarchy-4 mb-1" id="extracted-questions-heading">Extracted Questions</h3>
                  <p className="text-caption" role="description">
                    Review and edit the questions extracted from your input:
                  </p>
                </div>

                <div 
                  className="space-y-1 mb-3 transition-all duration-300"
                  role="list"
                  aria-labelledby="extracted-questions-heading"
                >
                  {isExtractingQueries ? (
                    <>
                      {[1, 2, 3, 4].slice(0, visibleQuestionCount).map((index) => (
                        <div 
                          key={`skeleton-${index}`} 
                          className="relative"
                          style={{
                            animation: `fadeIn 0.3s ease-in-out ${(index - 1) * 0.1}s both`,
                            opacity: 1
                          }}
                        >
                          <div className="flex items-start gap-2">
                            <div className="text-xs text-muted-foreground/30 pt-1 min-w-0 flex-shrink-0">
                              Question {index}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="min-h-[40px] rounded-md bg-muted/30 relative overflow-hidden">
                                <div className="p-2 space-y-2">
                                  <div className="h-3 bg-muted/50 rounded w-full skeleton"></div>
                                  <div className="h-3 bg-muted/50 rounded w-4/5 skeleton"></div>
                                </div>
                              </div>
                            </div>
                            <div className="h-6 w-6 bg-muted/20 rounded"></div>
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    extractedQueries.slice(0, visibleQuestionCount).map((query) => (
                      <div 
                        key={query.id} 
                        className="relative"
                        style={{
                          animation: `fadeIn 0.3s ease-in-out`,
                          opacity: 1
                        }}
                      >
                        <div className="flex items-start gap-2">
                          <div className="text-xs text-muted-foreground pt-1 min-w-0 flex-shrink-0">
                            Question {query.questionNumber}
                          </div>
                          <div className="flex-1 min-w-0">
                            {swappingQueries.has(query.id) ? (
                              // Show skeleton while swapping
                              <div className="min-h-[40px] rounded-md bg-muted/30 animate-pulse">
                                <div className="p-2 space-y-2">
                                  <div className="h-3 bg-muted/50 rounded w-full"></div>
                                  <div className="h-3 bg-muted/50 rounded w-4/5"></div>
                                </div>
                              </div>
                            ) : (
                              <Textarea
                                value={query.text}
                                onChange={(e) => onUpdateExtractedQuery(query.id, e.target.value)}
                                className="min-h-[40px] max-h-[80px] resize-none text-xs border-border/50 focus-visible:ring-1 focus-visible:ring-ring bg-background/60 backdrop-blur-sm"
                                rows={2}
                              />
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {swappedQueries.has(query.id) && previousQueries.has(query.id) ? (
                              // Show undo and retry buttons after swap
                              <>
                                <Button
                                  onClick={() => onUndoSwap?.(query.id)}
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-muted-foreground/60 hover:text-muted-foreground"
                                  title="Undo swap"
                                  disabled={swappingQueries.has(query.id)}
                                >
                                  <Undo className="h-3 w-3" />
                                </Button>
                                <Button
                                  onClick={() => onSwapQuery?.(query.id)}
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-muted-foreground/60 hover:text-muted-foreground"
                                  title="Generate another"
                                  disabled={swappingQueries.has(query.id)}
                                >
                                  <RefreshCw className="h-3 w-3" />
                                </Button>
                              </>
                            ) : (
                              // Show swap button initially
                              <Button
                                onClick={() => onSwapQuery?.(query.id)}
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-muted-foreground/60 hover:text-muted-foreground"
                                title="Swap query"
                                disabled={swappingQueries.has(query.id)}
                              >
                                <RefreshCw className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              onClick={() => onRemoveExtractedQuery(query.id)}
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-muted-foreground/60 hover:text-destructive flex-shrink-0"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div className="flex gap-2">
                    <Button
                      onClick={onAddExtractedQuery}
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 bg-transparent interactive-scale focus-ring"
                      disabled={isExtractingQueries}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add question
                    </Button>
                    <Button
                      onClick={() => onSetFavoritesModalOpen(true)}
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 bg-transparent interactive-scale focus-ring"
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
                    <Button onClick={onCancelExtraction} variant="ghost" size="sm" className="text-xs h-7 interactive-scale focus-ring">
                      Cancel
                    </Button>
                    <Button
                      onClick={onSubmitExtractedQueries}
                      disabled={isExtractingQueries || !extractedQueries.some((q) => q.text.trim())}
                      className="text-xs h-7 bg-primary hover:bg-primary/90 interactive-glow focus-ring"
                      size="sm"
                    >
                      {isExtractingQueries ? "Extracting..." : "Submit request"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-card/90 backdrop-blur-md border border-border/50 rounded-xl shadow-lg interactive-lift">
              <div className="p-3">
                <div className="space-y-2">
                  <ScrollArea className={queryInputs.length > 1 ? "max-h-[100px] w-full" : ""}>
                    <div className="space-y-2 pr-2">
                      {queryInputs.map((input, index) => (
                        <div key={input.id} className="flex gap-2 items-start group">
                          <div className="flex-1 min-w-0 relative">
                            {swappingInputs.has(input.id) ? (
                              // Show loading while swapping in manual mode (no skeleton, just disabled)
                              <Textarea
                                value={input.text}
                                disabled
                                className={`min-h-[36px] max-h-[72px] resize-none shadow-none text-xs opacity-50 ${
                                  queryInputs.length === 1
                                    ? "border-0 bg-transparent p-0"
                                    : `border border-border/50 rounded-md bg-background/60 backdrop-blur-sm p-2`
                                }`}
                                rows={1}
                              />
                            ) : (
                              <Textarea
                                ref={index === 0 ? textareaRef : undefined}
                                value={input.text}
                                onChange={(e) => onUpdateQueryInput(input.id, e.target.value)}
                                onKeyDown={(e) => onKeyDown(e, input.id)}
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
                                    : `border border-border/50 rounded-md bg-background/60 backdrop-blur-sm p-2`
                                }`}
                                rows={1}
                              />
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {/* Show swap/undo buttons for manual mode */}
                            {queryMode === "manual" && input.text.trim() && (
                              <>
                                {swappedInputs.has(input.id) && previousInputs.has(input.id) ? (
                                  // Show undo and retry buttons after swap
                                  <>
                                    <Button
                                      onClick={() => onUndoInputSwap?.(input.id)}
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-muted-foreground/60 hover:text-muted-foreground"
                                      title="Undo swap"
                                      disabled={swappingInputs.has(input.id)}
                                    >
                                      <Undo className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      onClick={() => onSwapInputQuery?.(input.id)}
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-muted-foreground/60 hover:text-muted-foreground"
                                      title="Generate another"
                                      disabled={swappingInputs.has(input.id)}
                                    >
                                      <RefreshCw className="h-3 w-3" />
                                    </Button>
                                  </>
                                ) : (
                                  // Show swap button initially
                                  <Button
                                    onClick={() => onSwapInputQuery?.(input.id)}
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-muted-foreground/60 hover:text-muted-foreground"
                                    title="Swap query"
                                    disabled={swappingInputs.has(input.id)}
                                  >
                                    <RefreshCw className="h-3 w-3" />
                                  </Button>
                                )}
                              </>
                            )}
                            {/* Remove button for multiple queries */}
                            {queryInputs.length > 1 && (
                              <Button
                                onClick={() => onRemoveQueryInput(input.id)}
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-muted-foreground/60 hover:text-destructive"
                                title="Remove query"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                            {/* Voice input for first query */}
                            {index === 0 && queryInputs.length === 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={onVoiceInput}
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
                                onClick={onSubmitQuery}
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
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => onSetQueryMode(queryMode === "auto" ? "manual" : "auto")}
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
                    {/* Add query button for manual mode */}
                    {queryMode === "manual" && (
                      <Button
                        onClick={onAddQueryInput}
                        variant="outline"
                        size="sm"
                        className="h-5 px-2 text-xs bg-transparent border-muted-foreground/30 hover:bg-muted/50"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add query
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}