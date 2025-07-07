import { BedrockAgentRuntimeClient, RetrieveCommand } from "@aws-sdk/client-bedrock-agent-runtime";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { generateClient } from "aws-amplify/data";
import { type Schema } from "../../data/resource";

// This is the client used to interact with the backend
const client = generateClient<Schema>();

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
  // 'http://localhost:3000',
  // 'https://localhost:3000',
  // 'https://main.d2u0pycjfm8zuu.amplifyapp.com',
  'https://main.d1w9nr6stbxah6.amplifyapp.com'
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

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return createResponse(200, '', event);
  }

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

  try {
    // 1. Manage the conversation
    if (!conversationId) {
      const { data: newConversation } = await client.models.Conversation.create({
        name: query.substring(0, 50), // Use first 50 chars of query as name
      });
      if (newConversation) {
        conversationId = newConversation.id;
        console.log(`Created new conversation with ID: ${conversationId}`);
      } else {
        throw new Error("Could not create a new conversation.");
      }
    } else {
      console.log(`Continuing conversation with ID: ${conversationId}`);
    }

    // 2. Save the user's message
    await client.models.Message.create({
      content: query,
      role: 'user',
      conversationId: conversationId,
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
    await client.models.Message.create({
      content: assistantResponse,
      role: 'assistant',
      conversationId: conversationId,
      sources: JSON.stringify(sources), // Store sources as a JSON string
    });
    console.log("Saved assistant message.");
    
    return createResponse(200, {
      answer: assistantResponse,
      sources: sources,
      conversationId: conversationId, // Return conversationId to the client
    }, event);
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
