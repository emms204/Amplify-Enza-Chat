"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MessageSquare, Plus, History, LogOut, Moon, Sun, Trash2, MoreVertical, Edit2, Check, X } from "lucide-react"
import { useTheme } from "next-themes"
import { useAuthenticator } from "@aws-amplify/ui-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { updateConversationName } from "@/services/chat_service"
import { useToast } from "@/hooks/use-toast"

// Keep Chat interface for structure, but data will come from props
interface Conversation {
  id: string
  name: string
  createdAt: string
}

interface ChatSidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation?: (id: string, newName: string) => void;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function ChatSidebar({ 
  conversations, 
  activeConversationId, 
  onSelectConversation, 
  onNewChat,
  onDeleteConversation,
  onRenameConversation,
  isLoading,
  error,
  onRetry
}: ChatSidebarProps) {
  const { theme, setTheme } = useTheme()
  const { signOut } = useAuthenticator()
  const { toast } = useToast()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null)
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingConversationId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingConversationId])

  const handleLogout = () => {
    signOut()
  }

  const handleDeleteClick = (conversationId: string, conversationName: string) => {
    setConversationToDelete(conversationId)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = () => {
    if (conversationToDelete) {
      onDeleteConversation(conversationToDelete)
      setConversationToDelete(null)
    }
    setDeleteDialogOpen(false)
  }

  const handleDeleteCancel = () => {
    setConversationToDelete(null)
    setDeleteDialogOpen(false)
  }

  const handleEditClick = (conversationId: string, currentName: string) => {
    setEditingConversationId(conversationId)
    setEditingName(currentName)
    setUpdateError(null)
  }

  const handleDoubleClick = (conversationId: string, currentName: string) => {
    if (!editingConversationId) {
      handleEditClick(conversationId, currentName)
    }
  }

  const handleSaveEdit = async () => {
    if (!editingConversationId || !editingName.trim()) {
      setUpdateError("Name cannot be empty")
      return
    }

    if (editingName.length > 100) {
      setUpdateError("Name must be 100 characters or less")
      return
    }

    setIsUpdating(true)
    setUpdateError(null)

    try {
      await updateConversationName(editingConversationId, editingName.trim())
      
      // Call the parent callback if provided
      if (onRenameConversation) {
        onRenameConversation(editingConversationId, editingName.trim())
      }
      
      // Show success toast
      toast({
        title: "Conversation renamed",
        description: `Successfully renamed to "${editingName.trim()}"`,
      })
      
      setEditingConversationId(null)
      setEditingName("")
    } catch (error: any) {
      console.error('Error updating conversation name:', error)
      setUpdateError(error.message || "Failed to update conversation name")
      
      // Show error toast
      toast({
        title: "Failed to rename conversation",
        description: error.message || "Please try again later",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingConversationId(null)
    setEditingName("")
    setUpdateError(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSaveEdit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancelEdit()
    }
  }

  const conversationToDeleteName = conversations.find(c => c.id === conversationToDelete)?.name || "this conversation"

  return (
    <>
      <Sidebar className="bg-gray-100/60 dark:bg-white/10 backdrop-blur-md border-r border-gray-900/10 dark:border-white/20">
        <SidebarHeader className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="text-xl font-bold text-gray-900 dark:text-white">
                Enza
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="text-gray-900 dark:text-white hover:bg-gray-900/10 dark:hover:bg-white/20"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>

          <Button onClick={onNewChat} className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="h-4 w-4 mr-2" />
            New Chat
          </Button>
        </SidebarHeader>

        <SidebarSeparator className="bg-gray-900/10 dark:bg-white/20" />

        <SidebarContent className="p-2">
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-800 dark:text-white/90 mb-2 px-2">Recent Chats</h3>
            
            {/* Error State */}
            {error && (
              <div className="p-4 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg mb-4">
                <p className="text-red-800 dark:text-red-200 text-sm font-medium mb-2">Failed to load</p>
                <p className="text-red-600 dark:text-red-300 text-xs mb-3">{error}</p>
                {onRetry && (
                  <Button
                    onClick={onRetry}
                    size="sm"
                    variant="outline"
                    className="w-full text-red-700 dark:text-red-300 border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/30"
                  >
                    Try Again
                  </Button>
                )}
              </div>
            )}

            <SidebarMenu>
              {/* Loading State */}
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <SidebarMenuItem key={`skeleton-${i}`}>
                      <div className="flex items-center p-2 space-x-3">
                        <div className="w-4 h-4 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                        <div className="flex-1 space-y-1">
                          <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-2/3"></div>
                        </div>
                      </div>
                    </SidebarMenuItem>
                  ))}
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center p-6 text-gray-600 dark:text-gray-400">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No conversations yet</p>
                  <p className="text-xs">Start your first chat!</p>
                </div>
              ) : (
                conversations.map((convo) => (
                  <SidebarMenuItem key={convo.id}>
                    <div className="flex items-center w-full group">
                      <SidebarMenuButton
                        isActive={activeConversationId === convo.id}
                        onClick={() => editingConversationId !== convo.id && onSelectConversation(convo.id)}
                        onDoubleClick={() => handleDoubleClick(convo.id, convo.name)}
                        className="flex-1 justify-start text-gray-800 dark:text-white/95 hover:bg-gray-900/10 dark:hover:bg-white/20 data-[active=true]:bg-emerald-600/70 data-[active=true]:text-white"
                        disabled={editingConversationId === convo.id}
                      >
                        <MessageSquare className="h-4 w-4 mr-2 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          {editingConversationId === convo.id ? (
                            <div className="flex flex-col gap-1">
                              <Input
                                ref={editInputRef}
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="text-sm p-1 h-6 bg-white dark:bg-gray-700 border-emerald-500"
                                disabled={isUpdating}
                                maxLength={100}
                              />
                              {updateError && (
                                <p className="text-xs text-red-500">{updateError}</p>
                              )}
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={handleSaveEdit}
                                  disabled={isUpdating}
                                  className="h-5 w-5 p-0 text-green-600 hover:text-green-700 hover:bg-green-100"
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={handleCancelEdit}
                                  disabled={isUpdating}
                                  className="h-5 w-5 p-0 text-red-600 hover:text-red-700 hover:bg-red-100"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="truncate text-sm">{convo.name}</div>
                              <div className="text-xs text-gray-600 dark:text-white/75">{new Date(convo.createdAt).toLocaleString()}</div>
                            </>
                          )}
                        </div>
                      </SidebarMenuButton>
                      
                      {editingConversationId !== convo.id && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity ml-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={() => handleEditClick(convo.id, convo.name)}
                              className="text-blue-600 dark:text-blue-400 focus:text-blue-600 focus:bg-blue-50 dark:focus:bg-blue-900/20"
                            >
                              <Edit2 className="h-4 w-4 mr-2" />
                              Rename conversation
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteClick(convo.id, convo.name)}
                              className="text-red-600 dark:text-red-400 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete conversation
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-800 dark:text-white/90 mb-2 px-2">History</h3>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton className="text-gray-800 dark:text-white/95 hover:bg-gray-900/10 dark:hover:bg-white/20">
                  <History className="h-4 w-4 mr-2" />
                  View All Conversations
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </div>
        </SidebarContent>

        <SidebarSeparator className="bg-gray-900/10 dark:bg-white/20" />

        <SidebarFooter className="p-4">
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start text-gray-800 dark:text-white hover:bg-red-500/20 hover:text-red-300"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </SidebarFooter>
      </Sidebar>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{conversationToDeleteName}"? This action cannot be undone and will permanently remove all messages in this conversation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
