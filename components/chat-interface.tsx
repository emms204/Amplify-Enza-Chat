"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Send, FileText, ExternalLink, Upload, MessageSquare } from "lucide-react"
import UploadDialog from "./upload-dialog"
import queryKnowledgeBase from "@/services/chat_service"

export interface Message {
  id: string
  type: "user" | "assistant"
  content: string
  sources?: Array<{
    content: string;
    metadata: any;
    location: any;
    score: number;
  }>
  timestamp: Date
}

interface ChatInterfaceProps {
  messages: Message[];
  isLoading: boolean;
  isLoadingMessages?: boolean;
  handleSubmit: (input: string) => Promise<void>;
  error?: string | null;
  networkError?: string | null;
  onRetry?: () => void;
}

export function ChatInterface({ 
  messages, 
  isLoading, 
  isLoadingMessages,
  handleSubmit,
  error,
  networkError,
  onRetry
}: ChatInterfaceProps) {
  const [input, setInput] = useState("")
  const [showAddModal, setShowAddModal] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleUpload = () => {
    setShowAddModal(true)
  }

  const localOnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    handleSubmit(input);
    setInput("");
  }

  return (
    <SidebarInset className="bg-transparent">
      <div className="flex flex-col h-screen">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-white/10 backdrop-blur-md border-b border-white/20">
          <div className="flex items-center space-x-4">
            <SidebarTrigger className="text-white hover:bg-white/20" />
            <h1 className="text-lg font-semibold text-white">Document Q&A Assistant</h1>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Error Banner */}
          {(error || networkError) && (
            <div className="bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-800 dark:text-red-200 font-medium">
                    {networkError ? "Connection Error" : "Error"}
                  </p>
                  <p className="text-red-600 dark:text-red-300 text-sm">
                    {networkError || error}
                  </p>
                </div>
                {onRetry && (
                  <Button
                    onClick={onRetry}
                    variant="outline"
                    size="sm"
                    className="text-red-700 dark:text-red-300 border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/30"
                  >
                    Retry
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Loading Messages */}
          {isLoadingMessages && (
            <div className="flex justify-center">
              <Card className="p-4 bg-white/90 backdrop-blur-sm border-white/20">
                <div className="flex items-center space-x-3">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"></div>
                    <div
                      className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-600">Loading conversation...</span>
                </div>
              </Card>
            </div>
          )}

          {/* Empty State for New Conversations */}
          {messages.length === 1 && messages[0].type === "assistant" && !isLoadingMessages && (
            <div className="flex justify-center mt-8">
              <Card className="max-w-md p-6 bg-white/90 backdrop-blur-sm border-white/20 text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-emerald-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Ready to help!
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Ask me anything about your documents and I'll provide detailed answers with sources.
                </p>
                <div className="space-y-2 text-xs text-gray-500 dark:text-gray-500">
                  <p>• Try: "What is the main topic of document X?"</p>
                  <p>• Try: "Summarize the key points from..."</p>
                  <p>• Try: "Find information about..."</p>
                </div>
              </Card>
            </div>
          )}

          {/* Regular Messages */}
          {!isLoadingMessages && messages.map((message) => (
            <div key={message.id} className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}>
              <Card
                className={`max-w-[80%] p-4 ${
                  message.type === "user"
                    ? "bg-emerald-600 text-white border-emerald-500"
                    : "bg-white/90 text-gray-900 dark:bg-gray-800 dark:text-gray-100 backdrop-blur-sm border-white/20 dark:border-gray-700"
                }`}
              >
                <div className="space-y-2">
                  <p className="text-sm leading-relaxed">{message.content}</p>

                  {message.sources && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Sources:</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {message.sources.map((source, index) => {
                          const sourceName = typeof source.location === 'string' 
                            ? source.location.split('/').pop() 
                            : source.location?.s3Location?.uri?.split('/').pop() 
                              || source.location?.uri?.split('/').pop() 
                              || 'Unknown';
                          
                          return (
                            <span 
                              key={index} 
                              className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded"
                            >
                              {sourceName}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <p className="text-xs opacity-70">{message.timestamp.toLocaleTimeString()}</p>
                </div>
              </Card>
            </div>
          ))}

          {/* AI Response Loading */}
          {isLoading && !isLoadingMessages && (
            <div className="flex justify-start">
              <Card className="max-w-[80%] p-4 bg-white/90 backdrop-blur-sm border-white/20">
                <div className="flex items-center space-x-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-600">Searching documents...</span>
                </div>
              </Card>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 bg-white/10 backdrop-blur-md border-t border-white/20">
          <form onSubmit={localOnSubmit} className="flex space-x-2">
            <Button variant="outline" size="icon" type="button" onClick={handleUpload}>
              <Upload className="h-4 w-4" />
            </Button>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about your documents..."
              className="flex-1 bg-white/90 dark:bg-gray-800/80 text-gray-900 dark:text-gray-100 backdrop-blur-sm border-white/30 dark:border-gray-700 focus:border-emerald-500 focus:ring-emerald-500"
              disabled={isLoading}
            />
            <Button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
        <UploadDialog showAddModal={showAddModal} setShowAddModal={setShowAddModal} />
      </div>
    </SidebarInset>
  )
}
