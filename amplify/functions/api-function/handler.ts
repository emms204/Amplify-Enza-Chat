import { BedrockAgentRuntimeClient, RetrieveCommand } from "@aws-sdk/client-bedrock-agent-runtime";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DatabaseService } from './database';
import { getUserId, requireAuth } from './auth';
import { generateConversationName, validateConversationName } from './naming';
import { Logger } from './logger';

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
  'https://main.dptc9tdidmx35.amplifyapp.com',
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
const ensureUserExists = async (
  db: DatabaseService, 
  userId: string, 
  authContext: any, 
  logger: Logger
): Promise<void> => {
  try {
    const existingUser = await db.getUser(userId);
    if (!existingUser) {
      logger.info(`Creating new user via JIT provisioning`, { userId });
      await db.createUser({
        userId,
        email: authContext.email,
        displayName: authContext.username || authContext.email?.split('@')[0] || 'User',
      });
      logger.businessEvent('user_created_jit', { 
        userId, 
        email: authContext.email,
        displayName: authContext.username || authContext.email?.split('@')[0] || 'User'
      });
    }
  } catch (error) {
    // If user creation fails due to race condition, that's okay
    logger.warn(`User creation note for ${userId}`, { error: (error as Error).message });
  }
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId || 'unknown';
  const startTime = Date.now();
  const logger = Logger.createLogger({ requestId });
  
  logger.requestStart(event.httpMethod, event.path || '', {
    requestId,
    userAgent: event.headers['User-Agent'],
    origin: event.headers.origin || event.headers.Origin
  });

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    const duration = Date.now() - startTime;
    logger.requestEnd(event.httpMethod, event.path || '', 200, duration);
    return createResponse(200, '', event);
  }

  try {
    // Authenticate user and extract context
    const authContext = requireAuth(event);
    const userId = authContext.userId;
    
    const userLogger = logger.child({ userId });
    userLogger.info('User authenticated successfully', {
      email: authContext.email,
      username: authContext.username
    });

    // Initialize database service with logger
    const db = new DatabaseService(userLogger);

    // Ensure user exists (JIT pattern)
    await ensureUserExists(db, userId, authContext, userLogger);

    // Handle conversation rename endpoint
    if (event.httpMethod === 'PUT' && event.path && event.path.includes('/conversation/')) {
      const result = await handleConversationUpdate(event, db, userId, userLogger);
      const duration = Date.now() - startTime;
      logger.requestEnd(event.httpMethod, event.path, result.statusCode, duration);
      return result;
    }

    // Handle main chat endpoint
    if (event.httpMethod === 'POST' && event.path === '/chat') {
      const result = await handleChatRequest(event, db, userId, userLogger);
      const duration = Date.now() - startTime;
      logger.requestEnd(event.httpMethod, event.path, result.statusCode, duration);
      return result;
    }

    const duration = Date.now() - startTime;
    logger.requestEnd(event.httpMethod, event.path || '', 404, duration);
    return createResponse(404, { error: "Endpoint not found" }, event);

  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    logger.error("Request failed with error", error, {
      httpMethod: event.httpMethod,
      path: event.path,
      errorName: error.name,
      errorCode: error.$metadata?.httpStatusCode,
      duration
    });
    
    let statusCode = 500;
    let errorMessage = "An error occurred while processing your request.";
    
    // Handle authentication errors
    if (error.message?.includes('Authentication required') || 
        error.message?.includes('auth') || 
        error.message?.includes('unauthorized')) {
      statusCode = 401;
      errorMessage = "Authentication required";
      logger.security('authentication_failed', {
        path: event.path,
        userAgent: event.headers['User-Agent']
      });
    }
    
    logger.requestEnd(event.httpMethod, event.path || '', statusCode, duration);
    
    // Return proper error response with CORS headers
    return createResponse(statusCode, { 
      error: errorMessage,
      details: error.message || "Unknown error",
      errorType: error.name || "Unknown"
    }, event);
  }
};

async function handleConversationUpdate(
  event: APIGatewayProxyEvent, 
  db: DatabaseService, 
  userId: string,
  logger: Logger
): Promise<APIGatewayProxyResult> {
  const startTime = Date.now();
  
  try {
    // Extract conversation ID from path
    const pathParts = event.path?.split('/') || [];
    const conversationId = pathParts[pathParts.length - 1];
    
    const opLogger = logger.child({ conversationId, operation: 'updateConversation' });
    
    if (!conversationId) {
      opLogger.warn('Missing conversation ID in request');
      return createResponse(400, { error: "Conversation ID is required" }, event);
    }

    // Parse request body
    if (!event.body) {
      opLogger.warn('Missing request body');
      return createResponse(400, { error: "Request body is required" }, event);
    }

    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    const { name } = body;

    if (!name || typeof name !== 'string') {
      opLogger.warn('Invalid name in request', { providedName: name });
      return createResponse(400, { error: "Name is required and must be a string" }, event);
    }

    // Validate name using existing validation function
    const validation = validateConversationName(name);
    if (!validation.isValid) {
      opLogger.warn('Conversation name validation failed', { 
        name, 
        error: validation.error 
      });
      return createResponse(400, { error: validation.error }, event);
    }

    opLogger.info('Updating conversation name', { 
      conversationId, 
      oldName: 'unknown',
      newName: name.trim() 
    });

    // Update the conversation
    await db.updateConversation(conversationId, userId, { name: name.trim() });

    const duration = Date.now() - startTime;
    opLogger.performance('handleConversationUpdate', duration, { 
      conversationId,
      success: true 
    });

    return createResponse(200, { 
      success: true, 
      message: "Conversation name updated successfully",
      conversationId,
      name: name.trim()
    }, event);

  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    logger.error('Failed to update conversation', error, {
      operation: 'handleConversationUpdate',
      duration
    });
    
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
  userId: string,
  logger: Logger
): Promise<APIGatewayProxyResult> {
  const startTime = Date.now();
  const opLogger = logger.child({ operation: 'chatRequest' });
  
  // Parse the incoming request
  let query = "";
  let conversationId: string | undefined;
  
  if (event.body) {
    try {
      const body: ChatRequest = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      query = body.query || "";
      conversationId = body.conversationId;
      
      opLogger.info('Chat request received', {
        queryLength: query.length,
        hasConversationId: !!conversationId,
        conversationId: conversationId || 'new'
      });
    } catch (e) {
      opLogger.error("Error parsing request body", e as Error);
      return createResponse(400, { error: "Invalid request body" }, event);
    }
  }
  
  if (!query) {
    opLogger.warn('Empty query received');
    return createResponse(400, { error: "Query parameter is required" }, event);
  }

  // 1. Manage the conversation
  let conversation;
  if (!conversationId) {
    // Create new conversation with auto-generated name
    const conversationName = generateConversationName(query);
    opLogger.info('Creating new conversation', { 
      generatedName: conversationName,
      querySnippet: query.substring(0, 50) + (query.length > 50 ? '...' : '')
    });
    
    conversation = await db.createConversation(userId, conversationName);
    conversationId = conversation.conversationId;
    
    opLogger.businessEvent('new_conversation_started', {
      conversationId,
      name: conversationName,
      firstQuery: query.substring(0, 100)
    });
  } else {
    // Verify user owns the conversation
    conversation = await db.getConversation(conversationId, userId);
    if (!conversation) {
      opLogger.security('unauthorized_conversation_access_attempt', {
        conversationId,
        userId
      });
      return createResponse(403, { error: "Conversation not found or access denied" }, event);
    }
    opLogger.info('Continuing existing conversation', { 
      conversationId,
      name: conversation.name 
    });
  }

  const chatLogger = opLogger.child({ conversationId });

  // 2. Save the user's message
  const userMessageStart = Date.now();
  await db.createMessage({
    conversationId,
    userId,
    content: query,
    role: 'user',
  });
  chatLogger.performance('saveUserMessage', Date.now() - userMessageStart);
  
  // Initialize the Bedrock Agent Runtime client with timeout configuration
  const agentClient = new BedrockAgentRuntimeClient({ 
    region: process.env.REGION || "eu-west-1",
    requestHandler: {
      requestTimeout: 25000, // 25 seconds to allow for API Gateway timeout
    }
  });
  
  chatLogger.info('Bedrock configuration', {
    knowledgeBaseId: process.env.KNOWLEDGE_BASE_ID,
    region: process.env.REGION || "eu-west-1"
  });
  
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
  
  chatLogger.debug('Starting knowledge base retrieval', { 
    numberOfResults: 5,
    queryLength: query.length 
  });
  
  const retrieveStart = Date.now();
  const retrieveCommand = new RetrieveCommand(retrieveParams);
  const retrieveResponse = await agentClient.send(retrieveCommand);
  const retrieveDuration = Date.now() - retrieveStart;
  
  const resultCount = retrieveResponse.retrievalResults?.length || 0;
  chatLogger.performance('bedrockRetrieval', retrieveDuration, {
    resultCount,
    success: true
  });
  
  chatLogger.info('Knowledge base retrieval completed', {
    resultCount,
    durationMs: retrieveDuration
  });
  
  // Extract retrieved passages
  const retrievedPassages = retrieveResponse.retrievalResults?.map((result: any) => 
    result.content?.text
  ).join("\n\n") || "";
  
  chatLogger.debug('Retrieved content summary', {
    passageLength: retrievedPassages.length,
    hasContent: retrievedPassages.length > 0
  });
  
  // Use Bedrock Runtime to generate a response using the retrieved information
  const runtimeClient = new BedrockRuntimeClient({ 
    region: process.env.REGION || "eu-west-1",
    requestHandler: {
      requestTimeout: 20000, // 20 seconds for model generation
    }
  });
  
  const generateParams = {
    modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
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
  
  chatLogger.debug('Starting model generation', {
    modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
    maxTokens: 1000
  });
  
  const generateStart = Date.now();
  const generateCommand = new InvokeModelCommand(generateParams);
  const generateResponse = await runtimeClient.send(generateCommand);
  const result: ClaudeResponse = JSON.parse(new TextDecoder().decode(generateResponse.body));
  const generateDuration = Date.now() - generateStart;
  
  chatLogger.performance('bedrockGeneration', generateDuration, {
    success: true,
    responseLength: result.content[0].text.length
  });
  
  chatLogger.info('Model generation completed', {
    durationMs: generateDuration,
    responseLength: result.content[0].text.length
  });
  
  const assistantResponse = result.content[0].text;
  const sources = retrieveResponse.retrievalResults?.map((result: any) => ({
    content: result.content?.text || 'No content available',
    metadata: result.metadata || {},
    location: result.location,
    score: result.score
  })) || [];

  // 3. Save the assistant's message
  const saveAssistantStart = Date.now();
  await db.createMessage({
    conversationId,
    userId,
    content: assistantResponse,
    role: 'assistant',
    sources: sources, // Store sources as structured data
  });
  chatLogger.performance('saveAssistantMessage', Date.now() - saveAssistantStart);
  
  const totalDuration = Date.now() - startTime;
  chatLogger.performance('completeChatRequest', totalDuration, {
    conversationId,
    userMessageLength: query.length,
    assistantMessageLength: assistantResponse.length,
    sourceCount: sources.length,
    retrievalDuration: retrieveDuration,
    generationDuration: generateDuration
  });
  
  chatLogger.businessEvent('chat_interaction_completed', {
    conversationId,
    messageExchange: 'user_assistant',
    totalDuration,
    hasKnowledgeBase: resultCount > 0
  });
  
  return createResponse(200, {
    answer: assistantResponse,
    sources: sources,
    conversationId: conversationId, // Return conversationId to the client
  }, event);
}