"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Search, Star, Plus, Trash2, Heart } from "lucide-react"

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

const categories = ["All", "Evidence", "Procedure", "Precedents", "Analysis"]

export function FavoritesModal({ isOpen, onClose, onSelectQuery, currentQuery = "" }: FavoritesModalProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [newFavoriteTitle, setNewFavoriteTitle] = useState("")
  const [newFavoriteCategory, setNewFavoriteCategory] = useState("Evidence")
  const [favorites, setFavorites] = useState<FavoriteQuery[]>(mockFavorites)

  const filteredFavorites = favorites.filter((fav) => {
    const matchesSearch =
      fav.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fav.query.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === "All" || fav.category === selectedCategory
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
  }

  const handleDeleteFavorite = (id: string) => {
    setFavorites((prev) => prev.filter((fav) => fav.id !== id))
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" />
            Favorite Queries
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
          {/* Browse Favorites Section */}
          <div className="lg:col-span-2 space-y-4">
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-foreground">Browse Favorites</h3>

              {/* Search and Filter */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search favorites..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-input border-border text-foreground"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {categories.map((category) => (
                    <Button
                      key={category}
                      variant={selectedCategory === category ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedCategory(category)}
                      className={
                        selectedCategory === category
                          ? "bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }
                    >
                      {category}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Favorites List */}
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {filteredFavorites.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Star className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No favorites found matching your criteria.</p>
                  </div>
                ) : (
                  filteredFavorites.map((favorite) => (
                    <div
                      key={favorite.id}
                      className="p-4 rounded-lg border border-border bg-card/50 hover:bg-card transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium text-foreground truncate">{favorite.title}</h4>
                            <Badge variant="secondary" className="text-xs bg-secondary/50 text-secondary-foreground">
                              {favorite.category}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{favorite.query}</p>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Added {favorite.createdAt}</span>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                size="sm"
                                onClick={() => handleSelectQuery(favorite.query)}
                                className="bg-primary text-primary-foreground hover:bg-primary/90"
                              >
                                Use Query
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteFavorite(favorite.id)}
                                className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Add to Favorites Section */}
          <div className="space-y-4">
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-foreground">Add to Favorites</h3>

              {currentQuery ? (
                <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-muted/20 border border-border">
                    <Label className="text-sm font-medium text-foreground mb-2 block">Current Query</Label>
                    <p className="text-sm text-muted-foreground line-clamp-3">{currentQuery}</p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="favorite-title" className="text-sm font-medium text-foreground">
                        Favorite Title
                      </Label>
                      <Input
                        id="favorite-title"
                        placeholder="Enter a descriptive title..."
                        value={newFavoriteTitle}
                        onChange={(e) => setNewFavoriteTitle(e.target.value)}
                        className="mt-1 bg-input border-border text-foreground"
                      />
                    </div>

                    <div>
                      <Label htmlFor="favorite-category" className="text-sm font-medium text-foreground">
                        Category
                      </Label>
                      <select
                        id="favorite-category"
                        value={newFavoriteCategory}
                        onChange={(e) => setNewFavoriteCategory(e.target.value)}
                        className="mt-1 w-full px-3 py-2 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        {categories.slice(1).map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </div>

                    <Button
                      onClick={handleAddToFavorites}
                      disabled={!newFavoriteTitle.trim()}
                      className="w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add to Favorites
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Plus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Enter a query to add it to favorites.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <Separator className="bg-border" />

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-border text-foreground hover:bg-muted bg-transparent"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
