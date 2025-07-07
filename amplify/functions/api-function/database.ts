import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand, DeleteCommand, GetCommand, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";

export interface User {
  userId: string;
  email?: string;
  displayName?: string;
  conversationCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  conversationId: string;
  userId: string;
  name: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  messageId: string;
  conversationId: string;
  userId: string;
  content: string;
  role: 'user' | 'assistant';
  sources?: any;
  createdAt: string;
}

export class DatabaseService {
  private docClient: DynamoDBDocumentClient;
  private userTableName: string;
  private conversationTableName: string;
  private messageTableName: string;

  constructor() {
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1'
    });
    this.docClient = DynamoDBDocumentClient.from(client);
    
    this.userTableName = process.env.USER_TABLE_NAME!;
    this.conversationTableName = process.env.CONVERSATION_TABLE_NAME!;
    this.messageTableName = process.env.MESSAGE_TABLE_NAME!;
  }

  // User Operations
  async createUser(userData: Omit<User, 'conversationCount' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const now = new Date().toISOString();
    const user: User = {
      ...userData,
      conversationCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    await this.docClient.send(new PutCommand({
      TableName: this.userTableName,
      Item: user,
      ConditionExpression: 'attribute_not_exists(userId)', // Prevent duplicates
    }));

    return user;
  }

  async getUser(userId: string): Promise<User | null> {
    const result = await this.docClient.send(new GetCommand({
      TableName: this.userTableName,
      Key: { userId },
    }));

    return result.Item as User || null;
  }

  async updateUserConversationCount(userId: string, increment: number): Promise<void> {
    await this.docClient.send(new UpdateCommand({
      TableName: this.userTableName,
      Key: { userId },
      UpdateExpression: 'SET conversationCount = conversationCount + :inc, updatedAt = :now',
      ExpressionAttributeValues: {
        ':inc': increment,
        ':now': new Date().toISOString(),
      },
    }));
  }

  // Conversation Operations
  async createConversation(userId: string, name: string): Promise<Conversation> {
    const now = new Date().toISOString();
    const conversation: Conversation = {
      conversationId: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      name,
      messageCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    await this.docClient.send(new PutCommand({
      TableName: this.conversationTableName,
      Item: conversation,
    }));

    // Update user conversation count
    await this.updateUserConversationCount(userId, 1);

    return conversation;
  }

  async getUserConversations(userId: string): Promise<Conversation[]> {
    const result = await this.docClient.send(new QueryCommand({
      TableName: this.conversationTableName,
      IndexName: 'UserConversationsIndex', // We'll need to create this GSI
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
      ScanIndexForward: false, // Most recent first
    }));

    return result.Items as Conversation[] || [];
  }

  async getConversation(conversationId: string, userId: string): Promise<Conversation | null> {
    const result = await this.docClient.send(new GetCommand({
      TableName: this.conversationTableName,
      Key: { conversationId },
    }));

    const conversation = result.Item as Conversation;
    
    // Verify ownership
    if (conversation && conversation.userId !== userId) {
      return null; // User doesn't own this conversation
    }

    return conversation || null;
  }

  async updateConversation(conversationId: string, userId: string, updates: Partial<Conversation>): Promise<void> {
    // First verify ownership
    const existing = await this.getConversation(conversationId, userId);
    if (!existing) {
      throw new Error('Conversation not found or access denied');
    }

    const updateExpression: string[] = [];
    const expressionAttributeValues: Record<string, any> = {};
    
    if (updates.name) {
      updateExpression.push('name = :name');
      expressionAttributeValues[':name'] = updates.name;
    }
    
    if (updates.messageCount !== undefined) {
      updateExpression.push('messageCount = :messageCount');
      expressionAttributeValues[':messageCount'] = updates.messageCount;
    }

    updateExpression.push('updatedAt = :now');
    expressionAttributeValues[':now'] = new Date().toISOString();

    await this.docClient.send(new UpdateCommand({
      TableName: this.conversationTableName,
      Key: { conversationId },
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeValues: expressionAttributeValues,
    }));
  }

  async deleteConversation(conversationId: string, userId: string): Promise<void> {
    // First verify ownership
    const conversation = await this.getConversation(conversationId, userId);
    if (!conversation) {
      throw new Error('Conversation not found or access denied');
    }

    // Delete all messages first
    const messages = await this.getConversationMessages(conversationId, userId);
    if (messages.length > 0) {
      const deleteRequests = messages.map(msg => ({
        DeleteRequest: {
          Key: { messageId: msg.messageId }
        }
      }));

      // Batch delete messages (max 25 at a time)
      for (let i = 0; i < deleteRequests.length; i += 25) {
        const batch = deleteRequests.slice(i, i + 25);
        await this.docClient.send(new BatchWriteCommand({
          RequestItems: {
            [this.messageTableName]: batch
          }
        }));
      }
    }

    // Delete the conversation
    await this.docClient.send(new DeleteCommand({
      TableName: this.conversationTableName,
      Key: { conversationId },
    }));

    // Update user conversation count
    await this.updateUserConversationCount(userId, -1);
  }

  // Message Operations
  async createMessage(messageData: Omit<Message, 'messageId' | 'createdAt'>): Promise<Message> {
    const now = new Date().toISOString();
    const message: Message = {
      ...messageData,
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: now,
    };

    await this.docClient.send(new PutCommand({
      TableName: this.messageTableName,
      Item: message,
    }));

    // Update conversation message count and updatedAt
    await this.updateConversation(messageData.conversationId, messageData.userId, {
      messageCount: undefined, // We'll increment this separately
    });

    // Increment message count
    await this.docClient.send(new UpdateCommand({
      TableName: this.conversationTableName,
      Key: { conversationId: messageData.conversationId },
      UpdateExpression: 'SET messageCount = messageCount + :inc, updatedAt = :now',
      ExpressionAttributeValues: {
        ':inc': 1,
        ':now': now,
      },
    }));

    return message;
  }

  async getConversationMessages(conversationId: string, userId: string): Promise<Message[]> {
    // First verify user owns the conversation
    const conversation = await this.getConversation(conversationId, userId);
    if (!conversation) {
      return []; // No access to conversation
    }

    const result = await this.docClient.send(new QueryCommand({
      TableName: this.messageTableName,
      IndexName: 'ConversationMessagesIndex', // We'll need to create this GSI
      KeyConditionExpression: 'conversationId = :conversationId',
      ExpressionAttributeValues: {
        ':conversationId': conversationId,
      },
      ScanIndexForward: true, // Chronological order
    }));

    return result.Items as Message[] || [];
  }
} 