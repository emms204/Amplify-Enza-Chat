import { defineFunction } from "@aws-amplify/backend";

export const bedrockKbFunction = defineFunction({
  name: "bedrock-kb-api",
  environment: {
    // Bedrock configuration
    KNOWLEDGE_BASE_ID: "DN5XHBICMZ",
    // "WAWVDMQWLL", // Your actual Knowledge Base ID
    REGION: "eu-west-1", // Adjust to your region
    
    // DynamoDB table names (will be set in backend.ts)
    USER_TABLE_NAME: "",
    CONVERSATION_TABLE_NAME: "",
    MESSAGE_TABLE_NAME: "",
    
    // Cognito configuration (will be set in backend.ts)
    USER_POOL_ID: "",
    USER_POOL_CLIENT_ID: "",

    // Cohere configuration
    COHERE_API_KEY: "y6527Mi4ahq7DDGgRMVpbSLl8ucCHsrQe3HQBRBn",
  },
  // Configure function with proper timeout and memory for DynamoDB operations
  timeoutSeconds: 60, // 60 seconds timeout for Bedrock calls
  memoryMB: 1024 // Increase memory for better performance
});
