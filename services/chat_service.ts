import { post, put } from 'aws-amplify/api';
import { Amplify } from 'aws-amplify';
import { fetchAuthSession } from 'aws-amplify/auth';

interface ChatResponse {
  answer: string;
  sources: Array<{
    content: string;
    metadata: any;
    location: any;
    score: number;
  }>;
  conversationId: string;
}

interface UpdateConversationResponse {
  success: boolean;
  message: string;
  conversationId: string;
  name: string;
}

async function queryKnowledgeBase(
  question: string,
  conversationId: string | null
): Promise<ChatResponse> {
  try {
    // Debug: Check if API configuration is loaded
    const config = Amplify.getConfig();
    console.log('Amplify config API section:', config.API);
    
    // Get the current authentication session
    const session = await fetchAuthSession();
    console.log('Auth session:', session);
    
    if (!session.tokens) {
      throw new Error('User not authenticated');
    }

    const restOperation = post({
      apiName: 'chatApi', // This matches the restApiName in backend.ts
      path: '/chat',
      options: {
        body: {
          query: question,
          conversationId: conversationId,
        },
        headers: {
          'Authorization': `Bearer ${session.tokens.idToken?.toString()}`,
          'Content-Type': 'application/json'
        }
      }
    });
    
    // Wait for the response
    const { body } = await restOperation.response;
    
    // Get the response body as JSON
    const responseBody = await body.json() as unknown as ChatResponse;
    return responseBody;
  } catch (error) {
    console.error('Error querying knowledge base:', error);
    
    // Additional debugging information
    const config = Amplify.getConfig();
    console.log('Current Amplify configuration:', config);
    
    throw error;
  }
}

async function updateConversationName(
  conversationId: string,
  name: string
): Promise<UpdateConversationResponse> {
  try {
    // Get the current authentication session
    const session = await fetchAuthSession();
    
    if (!session.tokens) {
      throw new Error('User not authenticated');
    }

    const restOperation = put({
      apiName: 'chatApi',
      path: `/chat/conversation/${conversationId}`,
      options: {
        body: {
          name: name,
        },
        headers: {
          'Authorization': `Bearer ${session.tokens.idToken?.toString()}`,
          'Content-Type': 'application/json'
        }
      }
    });
    
    // Wait for the response
    const { body } = await restOperation.response;
    
    // Get the response body as JSON
    const responseBody = await body.json() as unknown as UpdateConversationResponse;
    return responseBody;
  } catch (error) {
    console.error('Error updating conversation name:', error);
    throw error;
  }
}

export default queryKnowledgeBase;
export { updateConversationName };
