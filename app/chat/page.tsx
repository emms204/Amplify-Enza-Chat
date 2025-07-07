"use client"

import { useState, useEffect } from 'react';
import WithAuthenticator from "@/components/with-authenticator"
import { SidebarProvider } from "@/components/ui/sidebar"
import { ChatSidebar } from "@/components/chat-sidebar"
import { ChatInterface, Message } from "@/components/chat-interface"
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@/amplify/data/resource';
import queryKnowledgeBase from '@/services/chat_service';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { useToast } from '@/hooks/use-toast';

const client = generateClient<Schema>();

function ChatPage() {
  const { toast } = useToast()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      type: "assistant",
      content:
        "Hello! I'm your document assistant. I can help you find information from your uploaded documents and provide sources for my answers. What would you like to know?",
      timestamp: new Date(),
    },
  ]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const { authStatus } = useAuthenticator(context => [context.authStatus]);

  useEffect(() => {
    if (authStatus === 'authenticated') {
      fetchConversations();
      const subscription = client.models.Conversation.observeQuery().subscribe({
        next: ({ items }) => {
          const sortedConversations = [...items].sort((a, b) => {
            const aDate = new Date(a.updatedAt || a.createdAt || 0).getTime();
            const bDate = new Date(b.updatedAt || b.createdAt || 0).getTime();
            return bDate - aDate;
          });
          setConversations(sortedConversations);
          setIsLoadingConversations(false);
        },
        error: (error) => {
          console.error('Error subscribing to conversations:', error);
          setError('Failed to load conversations. Please refresh the page.');
          setIsLoadingConversations(false);
        }
      });
      return () => subscription.unsubscribe();
    }
  }, [authStatus]);

  const fetchConversations = async () => {
    try {
      setIsLoadingConversations(true);
      setError(null);
      const { data: items } = await client.models.Conversation.list();
      const sortedConversations = [...items].sort((a, b) => {
        const aDate = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bDate = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bDate - aDate;
      });
      setConversations(sortedConversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setError('Failed to load conversations. Please try again.');
    } finally {
      setIsLoadingConversations(false);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    try {
      setIsLoadingMessages(true);
      setError(null);
      const { data } = await client.models.Message.list({
        filter: { conversationId: { eq: conversationId } }
      });
      const sortedMessages = data.sort((a, b) => {
        const aDate = new Date(a.createdAt || 0).getTime();
        const bDate = new Date(b.createdAt || 0).getTime();
        return aDate - bDate;
      });
      const newMessages: Message[] = sortedMessages.map(msg => ({
        id: msg.messageId || '',
        type: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
        timestamp: new Date(msg.createdAt || 0),
        sources: msg.sources ? (typeof msg.sources === 'string' ? JSON.parse(msg.sources) : msg.sources) : undefined
      }));
      setMessages(newMessages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      setError('Failed to load conversation messages. Please try again.');
      // Show fallback message on error
      setMessages([
        {
          id: "error-1",
          type: "assistant",
          content: "Sorry, I couldn't load the conversation history. Please try refreshing or selecting another conversation.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleSelectConversation = async (id: string) => {
    if (isLoadingMessages) return; // Prevent multiple simultaneous loads
    
    setActiveConversationId(id);
    await fetchMessages(id);
  };

  const handleNewChat = () => {
    setActiveConversationId(null);
    setError(null);
    setNetworkError(null);
    setMessages([
      {
        id: "1",
        type: "assistant",
        content: "This is a new chat. What would you like to know?",
        timestamp: new Date(),
      },
    ]);
  };

  const handleDeleteConversation = async (conversationId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Delete the conversation using the Amplify client with correct field name
      await client.models.Conversation.delete({ conversationId: conversationId });
      
      // If the deleted conversation was active, switch to new chat
      if (activeConversationId === conversationId) {
        handleNewChat();
      }
      
      // Refresh conversations list
      await fetchConversations();
      
      // Show success toast
      toast({
        title: "Conversation deleted",
        description: "The conversation has been permanently removed.",
      })
      
      console.log(`Conversation ${conversationId} deleted successfully`);
    } catch (error) {
      console.error('Error deleting conversation:', error);
      setError('Failed to delete conversation. Please try again.');
      
      // Show error toast
      toast({
        title: "Failed to delete conversation",
        description: "Please try again later.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false);
    }
  };

  const handleRenameConversation = async (conversationId: string, newName: string) => {
    // Optimistically update the local state
    setConversations(prev => prev.map(conv => 
      conv.conversationId === conversationId 
        ? { ...conv, name: newName, updatedAt: new Date().toISOString() }
        : conv
    ));
    
    // Refresh from server to ensure consistency
    setTimeout(() => {
      fetchConversations();
    }, 1000);
  };

  const handleSubmit = async (input: string) => {
    if (!input.trim() || isLoading) return;
    
    setIsLoading(true);
    setError(null);
    setNetworkError(null);

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: input,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      const response = await queryKnowledgeBase(input, activeConversationId);
      
      if (!activeConversationId) {
        setActiveConversationId(response.conversationId);
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content: response.answer,
        sources: response.sources,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
      
      // Refresh conversations to show updated names and ordering
      await fetchConversations();
    } catch (error: any) {
      console.error('Chat error:', error);
      
      // Determine error type for better user feedback
      let errorMessage = "Sorry, I encountered an error. Please try again.";
      if (error.name === 'NetworkError' || error.message?.includes('network')) {
        setNetworkError('Network connection issue. Please check your internet connection and try again.');
        errorMessage = "Network connection issue. Please check your internet connection.";
      } else if (error.message?.includes('auth') || error.message?.includes('unauthorized')) {
        setError('Authentication error. Please sign out and sign back in.');
        errorMessage = "Authentication error. Please refresh the page.";
      }
      
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content: errorMessage,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    setNetworkError(null);
    fetchConversations();
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/images/chat-bg.png')",
        }}
      />

      {/* Content */}
      <div className="relative z-10">
        <SidebarProvider defaultOpen={true}>
          <ChatSidebar 
            conversations={conversations}
            activeConversationId={activeConversationId}
            onSelectConversation={handleSelectConversation}
            onNewChat={handleNewChat}
            onDeleteConversation={handleDeleteConversation}
            onRenameConversation={handleRenameConversation}
            isLoading={isLoadingConversations}
            error={error}
            onRetry={handleRetry}
          />
          <ChatInterface 
            messages={messages}
            isLoading={isLoading || isLoadingMessages}
            isLoadingMessages={isLoadingMessages}
            handleSubmit={handleSubmit}
            error={error}
            networkError={networkError}
            onRetry={handleRetry}
          />
        </SidebarProvider>
      </div>
    </div>
  )
}

export default function AuthenticatedChatPage() {
  return (
    <WithAuthenticator>
      <ChatPage />
    </WithAuthenticator>
  )
}
