import { APIGatewayProxyEvent } from "aws-lambda";

export interface AuthContext {
  userId: string;
  email?: string;
  username?: string;
  isAuthenticated: boolean;
}

export interface CognitoJWTPayload {
  sub: string; // User ID
  email?: string;
  'cognito:username'?: string;
  aud: string; // Audience (client ID)
  exp: number; // Expiration timestamp
  iat: number; // Issued at timestamp
  token_use: string; // Should be 'access' or 'id'
}

/**
 * Extract and parse user information from Cognito JWT token
 */
export const parseAuthToken = (event: APIGatewayProxyEvent): AuthContext => {
  try {
    // Get the Authorization header
    const authHeader = event.headers.Authorization || event.headers.authorization;
    
    if (!authHeader) {
      throw new Error('No Authorization header found');
    }

    // Extract the token (remove 'Bearer ' prefix)
    const token = authHeader.replace(/^Bearer\s+/i, '');
    
    if (!token) {
      throw new Error('No token found in Authorization header');
    }

    // Parse the JWT payload (middle part of the token)
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      throw new Error('Invalid JWT token format');
    }

    // Decode the payload (base64 URL decode)
    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64url').toString()) as CognitoJWTPayload;
    
    // Validate token structure
    if (!payload.sub) {
      throw new Error('Invalid token: missing subject (sub) claim');
    }

    // Check if token is expired
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      throw new Error('Token has expired');
    }

    return {
      userId: payload.sub,
      email: payload.email,
      username: payload['cognito:username'],
      isAuthenticated: true,
    };

  } catch (error) {
    console.error('Authentication error:', error);
    return {
      userId: '',
      isAuthenticated: false,
    };
  }
};

/**
 * Validate that the user is authenticated and extract user context
 * Throws error if authentication fails
 */
export const requireAuth = (event: APIGatewayProxyEvent): AuthContext => {
  const authContext = parseAuthToken(event);
  
  if (!authContext.isAuthenticated || !authContext.userId) {
    throw new Error('Authentication required');
  }
  
  return authContext;
};

/**
 * Extract user ID from authenticated request
 * This is a convenience function for the most common use case
 */
export const getUserId = (event: APIGatewayProxyEvent): string => {
  const authContext = requireAuth(event);
  return authContext.userId;
}; 