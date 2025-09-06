"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, X } from "lucide-react"

interface FavoriteQuery {
  id: string
  title: string
  query: string
  category: string
  createdAt: string
}

interface FavoritesModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectQuery: (query: string) => void
  currentQuery?: string
}

// Mock favorite queries data
const mockFavorites: FavoriteQuery[] = [
  {
    id: "1",
    title: "Key Facts Analysis",
    query: "What are the key facts surrounding the incident in question?",
    category: "Evidence",
    createdAt: "2024-01-15",
  },
  {
    id: "2",
    title: "Defendant's Claims Support",
    query: "What evidence supports the defendant's claims in this case?",
    category: "Evidence",
    createdAt: "2024-01-14",
  },
  {
    id: "3",
    title: "Procedural Issues Check",
    query: "Are there any procedural issues that could affect the outcome?",
    category: "Procedure",
    createdAt: "2024-01-13",
  },
  {
    id: "4",
    title: "Relevant Precedents",
    query: "What precedents are most relevant to this legal matter?",
    category: "Precedents",
    createdAt: "2024-01-12",
  },
  {
    id: "5",
    title: "Liability Assessment",
    query: "What is the likelihood of establishing liability in this case?",
    category: "Analysis",
    createdAt: "2024-01-11",
  },
  {
    id: "6",
    title: "Damages Calculation",
    query: "What damages could potentially be awarded if successful?",
    category: "Analysis",
    createdAt: "2024-01-10",
  },
]

const categories = ["Evidence", "Procedure", "Precedents", "Analysis"]

export function FavoritesModal({ isOpen, onClose, onSelectQuery, currentQuery = "" }: FavoritesModalProps) {
  const [activeTab, setActiveTab] = useState<'browse' | 'add'>('browse')
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("")
  const [newFavoriteTitle, setNewFavoriteTitle] = useState("")
  const [newFavoriteCategory, setNewFavoriteCategory] = useState("Evidence")
  const [favorites, setFavorites] = useState<FavoriteQuery[]>(mockFavorites)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const filteredFavorites = favorites.filter((fav) => {
    const matchesSearch =
      fav.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fav.query.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === "" || fav.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const handleSelectQuery = (query: string) => {
    onSelectQuery(query)
    onClose()
  }

  const handleAddToFavorites = () => {
    if (!newFavoriteTitle.trim() || !currentQuery.trim()) return

    const newFavorite: FavoriteQuery = {
      id: Date.now().toString(),
      title: newFavoriteTitle.trim(),
      query: currentQuery,
      category: newFavoriteCategory,
      createdAt: new Date().toISOString().split("T")[0],
    }

    setFavorites((prev) => [newFavorite, ...prev])
    setNewFavoriteTitle("")
    setNewFavoriteCategory("Evidence")
    setActiveTab('browse')
  }

  const handleDeleteFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setFavorites((prev) => prev.filter((fav) => fav.id !== id))
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0 gap-0 border-border/50">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-base font-normal">Favorite Queries</DialogTitle>
        </DialogHeader>

        {/* Minimal Tab Navigation */}
        <div className="flex px-6 pb-4 gap-6 border-b border-border/30">
          <button
            onClick={() => setActiveTab('browse')}
            className={`pb-2 text-sm transition-all ${
              activeTab === 'browse'
                ? 'text-foreground border-b-2 border-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Browse
          </button>
          <button
            onClick={() => setActiveTab('add')}
            className={`pb-2 text-sm transition-all ${
              activeTab === 'add'
                ? 'text-foreground border-b-2 border-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Add New
          </button>
        </div>

        <div className="px-6 py-4">
          {activeTab === 'browse' ? (
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                <Input
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 text-sm border-border/50 focus:border-border"
                />
              </div>

              {/* Minimal Category Pills */}
              <div className="flex gap-3 text-xs">
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(selectedCategory === category ? "" : category)}
                    className={`transition-colors ${
                      selectedCategory === category
                        ? 'text-foreground font-medium'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>

              {/* Simplified Favorites List */}
              <ScrollArea className="h-[380px] -mx-6 px-6">
                <div className="space-y-1">
                  {filteredFavorites.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <p className="text-sm">No favorites found</p>
                    </div>
                  ) : (
                    filteredFavorites.map((favorite) => (
                      <div
                        key={favorite.id}
                        onClick={() => handleSelectQuery(favorite.query)}
                        onMouseEnter={() => setHoveredId(favorite.id)}
                        onMouseLeave={() => setHoveredId(null)}
                        className="py-3 px-3 -mx-3 rounded cursor-pointer transition-colors hover:bg-muted/50 group relative"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <h4 className="text-sm font-normal text-foreground">
                                {favorite.title}
                              </h4>
                              <span className="text-xs px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                                {favorite.category}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {favorite.query}
                            </p>
                          </div>
                          {hoveredId === favorite.id && (
                            <button
                              onClick={(e) => handleDeleteFavorite(favorite.id, e)}
                              className="ml-2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="space-y-5 py-2">
              {currentQuery ? (
                <>
                  <div>
                    <Label className="text-xs text-muted-foreground font-normal">Current Query</Label>
                    <p className="text-sm mt-2 text-foreground/90">{currentQuery}</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Input
                        id="favorite-title"
                        placeholder="Title"
                        value={newFavoriteTitle}
                        onChange={(e) => setNewFavoriteTitle(e.target.value)}
                        className="h-9 text-sm border-0 border-b rounded-none px-0 focus-visible:ring-0 focus-visible:border-b-foreground"
                      />
                    </div>

                    <div>
                      <select
                        id="favorite-category"
                        value={newFavoriteCategory}
                        onChange={(e) => setNewFavoriteCategory(e.target.value)}
                        className="w-full h-9 text-sm border-0 border-b border-border/50 bg-transparent px-0 focus:outline-none focus:border-foreground cursor-pointer"
                      >
                        {categories.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </div>

                    <Button
                      onClick={handleAddToFavorites}
                      disabled={!newFavoriteTitle.trim()}
                      className="w-full h-9 text-sm font-normal"
                    >
                      Add to Favorites
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-sm">Enter a query to add it to favorites</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-border/30">
          <Button 
            variant="ghost" 
            onClick={onClose}
            className="h-8 text-sm font-normal"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}