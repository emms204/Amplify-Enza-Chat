import { BedrockAgentRuntimeClient, RetrieveCommand } from "@aws-sdk/client-bedrock-agent-runtime";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DatabaseService } from './database';
import { getUserId, requireAuth } from './auth';
import { generateConversationName, validateConversationName } from './naming';

interface ChatRequest {
  query: string;
  conversationId?: string;
}

interface ClaudeResponse {
  content: Array<{
    text: string;
  }>;
}

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://localhost:3000',
  'https://main.d2u0pycjfm8zuu.amplifyapp.com',
  'https://main.d1w9nr6stbxah6.amplifyapp.com',
  'https://main.d1oxkyfguywzru.amplifyapp.com'
];

// Function to get appropriate CORS headers based on request origin
const getCorsHeaders = (event: APIGatewayProxyEvent) => {
  const origin = event.headers.origin || event.headers.Origin || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token, X-Amz-User-Agent, X-Amz-Content-Sha256",
    "Access-Control-Allow-Credentials": "true"
  };
};

// Helper function to ensure CORS headers are always returned
const createResponse = (statusCode: number, body: any, event: APIGatewayProxyEvent): APIGatewayProxyResult => {
  return {
    statusCode,
    headers: getCorsHeaders(event),
    body: typeof body === 'string' ? body : JSON.stringify(body)
  };
};

// Just-In-Time user creation
const ensureUserExists = async (db: DatabaseService, userId: string, authContext: any): Promise<void> => {
  try {
    const existingUser = await db.getUser(userId);
    if (!existingUser) {
      console.log(`Creating new user: ${userId}`);
      await db.createUser({
        userId,
        email: authContext.email,
        displayName: authContext.username || authContext.email?.split('@')[0] || 'User',
      });
      console.log(`User created successfully: ${userId}`);
    }
  } catch (error) {
    // If user creation fails due to race condition, that's okay
    console.log(`User creation note for ${userId}:`, error);
  }
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Handler started, event:', JSON.stringify(event, null, 2));

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return createResponse(200, '', event);
  }

  try {
    // Authenticate user and extract context
    const authContext = requireAuth(event);
    const userId = authContext.userId;
    
    console.log(`Authenticated user: ${userId}`);

    // Initialize database service
    const db = new DatabaseService();

    // Ensure user exists (JIT pattern)
    await ensureUserExists(db, userId, authContext);

    // Handle conversation rename endpoint
    if (event.httpMethod === 'PUT' && event.path && event.path.includes('/conversation/')) {
      return await handleConversationUpdate(event, db, userId);
    }

    // Handle main chat endpoint
    if (event.httpMethod === 'POST' && event.path === '/chat') {
      return await handleChatRequest(event, db, userId);
    }

    return createResponse(404, { error: "Endpoint not found" }, event);

  } catch (error: any) {
    console.error("Detailed error information:");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error code:", error.$metadata?.httpStatusCode);
    console.error("Error timestamp:", new Date().toISOString());
    console.error("Full error:", JSON.stringify(error, null, 2));
    
    // Return proper error response with CORS headers
    return createResponse(500, { 
      error: "An error occurred while processing your request.",
      details: error.message || "Unknown error",
      errorType: error.name || "Unknown"
    }, event);
  }
};

async function handleConversationUpdate(
  event: APIGatewayProxyEvent, 
  db: DatabaseService, 
  userId: string
): Promise<APIGatewayProxyResult> {
  try {
    // Extract conversation ID from path
    const pathParts = event.path?.split('/') || [];
    const conversationId = pathParts[pathParts.length - 1];
    
    if (!conversationId) {
      return createResponse(400, { error: "Conversation ID is required" }, event);
    }

    // Parse request body
    if (!event.body) {
      return createResponse(400, { error: "Request body is required" }, event);
    }

    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const { name } = body;

    if (!name || typeof name !== 'string') {
      return createResponse(400, { error: "Name is required and must be a string" }, event);
    }

    // Validate name using existing validation function
    const validation = validateConversationName(name);
    if (!validation.isValid) {
      return createResponse(400, { error: validation.error }, event);
    }

    // Update the conversation
    await db.updateConversation(conversationId, userId, { name: name.trim() });

    return createResponse(200, { 
      success: true, 
      message: "Conversation name updated successfully",
      conversationId,
      name: name.trim()
    }, event);

  } catch (error: any) {
    console.error('Error updating conversation:', error);
    
    if (error.message === 'Conversation not found or access denied') {
      return createResponse(404, { error: "Conversation not found" }, event);
    }
    
    return createResponse(500, { 
      error: "Failed to update conversation name",
      details: error.message
    }, event);
  }
}

async function handleChatRequest(
  event: APIGatewayProxyEvent, 
  db: DatabaseService, 
  userId: string
): Promise<APIGatewayProxyResult> {
  // Parse the incoming request
  let query = "";
  let conversationId: string | undefined;
  
  if (event.body) {
    try {
      const body: ChatRequest = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      query = body.query || "";
      conversationId = body.conversationId;
    } catch (e) {
      console.error("Error parsing request body:", e);
      return createResponse(400, { error: "Invalid request body" }, event);
    }
  }
  
  if (!query) {
    return createResponse(400, { error: "Query parameter is required" }, event);
  }

  // 1. Manage the conversation
  let conversation;
  if (!conversationId) {
    // Create new conversation with auto-generated name
    const conversationName = generateConversationName(query);
    conversation = await db.createConversation(userId, conversationName);
    conversationId = conversation.conversationId;
    console.log(`Created new conversation: ${conversationId} with name: "${conversationName}"`);
  } else {
    // Verify user owns the conversation
    conversation = await db.getConversation(conversationId, userId);
    if (!conversation) {
      return createResponse(403, { error: "Conversation not found or access denied" }, event);
    }
    console.log(`Continuing conversation: ${conversationId}`);
  }

  // 2. Save the user's message
  await db.createMessage({
    conversationId,
    userId,
    content: query,
    role: 'user',
  });
  console.log("Saved user message.");
  
  // Initialize the Bedrock Agent Runtime client with timeout configuration
  const agentClient = new BedrockAgentRuntimeClient({ 
    region: process.env.REGION || "us-east-1",
    requestHandler: {
      requestTimeout: 25000, // 25 seconds to allow for API Gateway timeout
    }
  });
  
  console.log("Using Knowledge Base ID:", process.env.KNOWLEDGE_BASE_ID);
  console.log("Using Region:", process.env.REGION || "us-east-1");
  
  // Retrieve information from the knowledge base
  const retrieveParams = {
    knowledgeBaseId: process.env.KNOWLEDGE_BASE_ID,
    retrievalQuery: {
      text: query
    },
    retrievalConfiguration: {
      vectorSearchConfiguration: {
        numberOfResults: 5
      }
    }
  };
  
  console.log("Retrieve params:", JSON.stringify(retrieveParams, null, 2));
  console.log("Starting retrieval at:", new Date().toISOString());
  
  const retrieveCommand = new RetrieveCommand(retrieveParams);
  const retrieveResponse = await agentClient.send(retrieveCommand);
  
  console.log("Retrieval completed at:", new Date().toISOString());
  console.log("Retrieved results:", retrieveResponse.retrievalResults?.length || 0);
  
  // Extract retrieved passages
  const retrievedPassages = retrieveResponse.retrievalResults?.map((result: any) => 
    result.content?.text
  ).join("\n\n") || "";
  
  // Use Bedrock Runtime to generate a response using the retrieved information
  const runtimeClient = new BedrockRuntimeClient({ 
    region: process.env.REGION || "us-east-1",
    requestHandler: {
      requestTimeout: 20000, // 20 seconds for model generation
    }
  });
  
  const generateParams = {
    modelId: "anthropic.claude-3-sonnet-20240229-v1:0", // Adjust model if needed
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `You are an AI assistant that answers questions based on the provided knowledge base information.
Based on the following information, please answer this question: ${query}
Knowledge base information:
${retrievedPassages}`
        }
      ]
    })
  };
  
  console.log("Starting model generation at:", new Date().toISOString());
  const generateCommand = new InvokeModelCommand(generateParams);
  const generateResponse = await runtimeClient.send(generateCommand);
  const result: ClaudeResponse = JSON.parse(new TextDecoder().decode(generateResponse.body));
  
  console.log("Model generation completed at:", new Date().toISOString());
  
  const assistantResponse = result.content[0].text;
  const sources = retrieveResponse.retrievalResults?.map((result: any) => ({
    content: result.content?.text || 'No content available',
    metadata: result.metadata || {},
    location: result.location,
    score: result.score
  })) || [];

  // 3. Save the assistant's message
  await db.createMessage({
    conversationId,
    userId,
    content: assistantResponse,
    role: 'assistant',
    sources: sources, // Store sources as structured data
  });
  console.log("Saved assistant message.");
  
  return createResponse(200, {
    answer: assistantResponse,
    sources: sources,
    conversationId: conversationId, // Return conversationId to the client
  }, event);
}