"use client"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  MessageSquare,
  Plus,
  Scale,
  ChevronDown,
  Settings,
  HelpCircle,
  Info,
  LogOut,
  User,
  Briefcase,
} from "lucide-react"

interface Chat {
  id: string
  name: string
  lastActivity: Date
  fileCount: number
  isPinned?: boolean
}

interface SidebarProps {
  sidebarOpen: boolean
  onNewChat: () => void
}

export default function Sidebar({ sidebarOpen, onNewChat }: SidebarProps) {
  const [recentChats] = useState<Chat[]>([
    {
      id: "1",
      name: "State v. Johnson - DUI Defense",
      lastActivity: new Date(2024, 2, 15),
      fileCount: 8,
      isPinned: true,
    },
    {
      id: "2",
      name: "People v. Martinez - Drug Possession",
      lastActivity: new Date(2024, 2, 14),
      fileCount: 12,
    },
    {
      id: "3",
      name: "State v. Williams - Assault & Battery",
      lastActivity: new Date(2024, 2, 13),
      fileCount: 5,
    },
    {
      id: "4",
      name: "People v. Davis - Grand Theft Auto",
      lastActivity: new Date(2024, 2, 12),
      fileCount: 15,
    },
    {
      id: "5",
      name: "State v. Brown - Domestic Violence",
      lastActivity: new Date(2024, 2, 11),
      fileCount: 22,
    },
    {
      id: "6",
      name: "In re: Minor Thompson - Juvenile Court",
      lastActivity: new Date(2024, 2, 10),
      fileCount: 7,
    },
    {
      id: "7",
      name: "Commonwealth v. Lee - Burglary 2nd",
      lastActivity: new Date(2024, 2, 9),
      fileCount: 18,
    },
  ])
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  return (
    <div
      className={`${sidebarOpen ? "w-60" : "w-12"} transition-all duration-300 bg-sidebar border-r border-sidebar-border flex-shrink-0 flex flex-col`}
    >
      {/* Header Section */}
      <div className="h-12 px-3 border-b border-sidebar-border flex items-center">
        <div className="flex items-center gap-3">
          {sidebarOpen ? (
            <>
              <Scale className="h-5 w-5 text-primary flex-shrink-0" />
              <h1 className="font-semibold text-lg text-sidebar-foreground">OpenJustice</h1>
            </>
          ) : (
            <div className="flex justify-center w-full">
              <Scale className="h-5 w-5 text-primary" />
            </div>
          )}
        </div>
      </div>

      {/* Navigation Section - All buttons with consistent spacing */}
      <div className="px-3 py-3 space-y-2">
        {sidebarOpen ? (
          <>
            <Button
              variant="ghost"
              className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent h-8 px-0"
              onClick={onNewChat}
            >
              <Plus className="h-4 w-4 mr-2 text-purple-400" />
              <span className="text-xs font-medium text-purple-400">New Chat</span>
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent h-8"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              <span className="text-xs">Chats</span>
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent h-8"
            >
              <Briefcase className="h-4 w-4 mr-2" />
              <span className="text-xs">Cases</span>
            </Button>
          </>
        ) : (
          <>
            <div className="flex justify-center">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-sidebar-accent" onClick={onNewChat}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex justify-center">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-sidebar-foreground hover:bg-sidebar-accent">
                <MessageSquare className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex justify-center">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-sidebar-foreground hover:bg-sidebar-accent">
                <Briefcase className="h-3 w-3" />
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 px-3">
        <ScrollArea className="h-full">
          <div className="space-y-4">
            {/* Pinned Section */}
            {recentChats.filter((chat) => chat.isPinned).length > 0 && sidebarOpen && (
              <div>
                <h3 className="text-xs font-medium text-sidebar-foreground/60 mb-2 px-1">Pinned</h3>
                <div className="space-y-0.5">
                  {recentChats
                    .filter((chat) => chat.isPinned)
                    .map((chat) => (
                      <div
                        key={chat.id}
                        className="py-1.5 px-2 rounded-md cursor-pointer hover:bg-sidebar-accent/50 transition-colors group"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0 max-w-[180px]">
                            <h4 className="text-xs text-sidebar-foreground/80 font-normal overflow-hidden text-ellipsis whitespace-nowrap leading-relaxed">
                              {chat.name}
                            </h4>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Recent Section */}
            {sidebarOpen && (
              <div>
                <h3 className="text-xs font-medium text-sidebar-foreground/60 mb-2 px-1">Recents</h3>
                <div className="space-y-0.5">
                  {recentChats
                    .filter((chat) => !chat.isPinned)
                    .map((chat) => (
                      <div
                        key={chat.id}
                        className="py-1.5 px-2 rounded-md cursor-pointer hover:bg-sidebar-accent/50 transition-colors group"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0 max-w-[180px]">
                            <h4 className="text-xs text-sidebar-foreground/80 font-normal overflow-hidden text-ellipsis whitespace-nowrap leading-relaxed">
                              {chat.name}
                            </h4>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* User Profile */}
      <div className="px-3 pb-3 relative" ref={dropdownRef}>
        {dropdownOpen && sidebarOpen && (
          <div className="absolute bottom-full left-3 right-3 mb-2 bg-sidebar border border-sidebar-border rounded-md shadow-lg py-1 z-50">
            <Button
              variant="ghost"
              className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent h-8 px-3 text-sm"
              onClick={() => setDropdownOpen(false)}
            >
              <User className="h-4 w-4 mr-3" />
              Profile Settings
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent h-8 px-3 text-sm"
              onClick={() => setDropdownOpen(false)}
            >
              <Settings className="h-4 w-4 mr-3" />
              Case Preferences
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent h-8 px-3 text-sm"
              onClick={() => setDropdownOpen(false)}
            >
              <HelpCircle className="h-4 w-4 mr-3" />
              Help & Support
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent h-8 px-3 text-sm"
              onClick={() => setDropdownOpen(false)}
            >
              <Info className="h-4 w-4 mr-3" />
              About OpenJustice
            </Button>
            <div className="border-t border-sidebar-border my-1" />
            <Button
              variant="ghost"
              className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent h-8 px-3 text-sm"
              onClick={() => setDropdownOpen(false)}
            >
              <LogOut className="h-4 w-4 mr-3" />
              Sign Out
            </Button>
          </div>
        )}

        <Button
          variant="ghost"
          className="w-full h-10 p-2 text-sidebar-foreground hover:bg-sidebar-accent flex items-center justify-center"
          onClick={() => setDropdownOpen(!dropdownOpen)}
        >
          {sidebarOpen ? (
            <div className="flex items-center gap-3 w-full">
              <div className="h-6 w-6 rounded-full bg-transparent flex items-center justify-center text-sidebar-foreground/60 text-xs font-medium flex-shrink-0">
                SL
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-medium text-sidebar-foreground/80 leading-tight">Stefanie Lindquist</p>
                <p className="text-xs text-sidebar-foreground/50 leading-tight">WashULaw</p>
              </div>
              <ChevronDown
                className={`h-3 w-3 text-sidebar-foreground/60 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
              />
            </div>
          ) : (
            <div className="h-6 w-6 rounded-full bg-transparent flex items-center justify-center text-sidebar-foreground/60 text-xs font-medium">
              SL
            </div>
          )}
        </Button>
      </div>
    </div>
  )
}
