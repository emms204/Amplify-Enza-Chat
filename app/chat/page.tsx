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

const client = generateClient<Schema>();

function ChatPage() {
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
  const { authStatus } = useAuthenticator(context => [context.authStatus]);

  useEffect(() => {
    if (authStatus === 'authenticated') {
      fetchConversations();
      const subscription = client.models.Conversation.observeQuery().subscribe({
        next: ({ items }) => {
          const sortedConversations = [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setConversations(sortedConversations);
        }
      });
      return () => subscription.unsubscribe();
    }
  }, [authStatus]);

  const fetchConversations = async () => {
    const { data: items } = await client.models.Conversation.list();
    const sortedConversations = [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setConversations(sortedConversations);
  };

  const fetchMessages = async (conversationId: string) => {
    const { data } = await client.models.Message.list({
      filter: { conversationId: { eq: conversationId } }
    });
    const sortedMessages = data.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const newMessages: Message[] = sortedMessages.map(msg => ({
      id: msg.id,
      type: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
      timestamp: new Date(msg.createdAt)
    }));
    setMessages(newMessages);
  };

  const handleSelectConversation = async (id: string) => {
    setIsLoading(true);
    setActiveConversationId(id);
    await fetchMessages(id);
    setIsLoading(false);
  };

  const handleNewChat = () => {
    setActiveConversationId(null);
    setMessages([
      {
        id: "1",
        type: "assistant",
        content: "This is a new chat. What would you like to know?",
        timestamp: new Date(),
      },
    ]);
  };

  const handleSubmit = async (input: string) => {
    if (!input.trim()) return;
    setIsLoading(true);

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
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
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
          />
          <ChatInterface 
            messages={messages}
            isLoading={isLoading}
            handleSubmit={handleSubmit}
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
