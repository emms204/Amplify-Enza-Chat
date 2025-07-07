import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand, DeleteCommand, GetCommand, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { Logger } from './logger';

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
  owner?: string;
}

export interface Message {
  messageId: string;
  conversationId: string;
  userId: string;
  content: string;
  role: 'user' | 'assistant';
  sources?: any;
  createdAt: string;
  owner?: string;
}

export class DatabaseService {
  private docClient: DynamoDBDocumentClient;
  private userTableName: string;
  private conversationTableName: string;
  private messageTableName: string;
  private logger: Logger;

  constructor(logger?: Logger) {
    const client = new DynamoDBClient({ region: process.env.REGION || 'us-east-1' });
    this.docClient = DynamoDBDocumentClient.from(client);
    
    this.userTableName = process.env.USER_TABLE_NAME || '';
    this.conversationTableName = process.env.CONVERSATION_TABLE_NAME || '';
    this.messageTableName = process.env.MESSAGE_TABLE_NAME || '';
    this.logger = logger || Logger.createLogger({ });

    this.logger.info('DatabaseService initialized', {
      userTable: this.userTableName,
      conversationTable: this.conversationTableName,
      messageTable: this.messageTableName,
      region: process.env.REGION || 'us-east-1'
    });
  }

  // User Operations
  async createUser(userData: Omit<User, 'conversationCount' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const startTime = Date.now();
    const logger = this.logger.child({ userId: userData.userId });
    
    try {
      logger.info('Creating new user', { email: userData.email, displayName: userData.displayName });
      
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

      const duration = Date.now() - startTime;
      logger.dbCreate(this.userTableName, userData.userId, { duration });
      logger.performance('createUser', duration, { userId: userData.userId });
      
      return user;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.dbError('CREATE', this.userTableName, error as Error, { 
        userId: userData.userId,
        duration,
        operation: 'createUser'
      });
      throw error;
    }
  }

  async getUser(userId: string): Promise<User | null> {
    const startTime = Date.now();
    const logger = this.logger.child({ userId });
    
    try {
      logger.debug('Fetching user', { userId });
      
      const result = await this.docClient.send(new GetCommand({
        TableName: this.userTableName,
        Key: { userId },
      }));

      const duration = Date.now() - startTime;
      const user = result.Item as User || null;
      const found = !!user;
      
      logger.dbRead(this.userTableName, userId, found, { duration });
      logger.performance('getUser', duration, { userId, found });
      
      return user;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.dbError('READ', this.userTableName, error as Error, { 
        userId,
        duration,
        operation: 'getUser'
      });
      throw error;
    }
  }

  async updateUserConversationCount(userId: string, increment: number): Promise<void> {
    const startTime = Date.now();
    const logger = this.logger.child({ userId });
    
    try {
      logger.debug('Updating user conversation count', { userId, increment });
      
      await this.docClient.send(new UpdateCommand({
        TableName: this.userTableName,
        Key: { userId },
        UpdateExpression: 'SET conversationCount = conversationCount + :inc, updatedAt = :now',
        ExpressionAttributeValues: {
          ':inc': increment,
          ':now': new Date().toISOString(),
        },
      }));

      const duration = Date.now() - startTime;
      logger.dbUpdate(this.userTableName, userId, { 
        increment,
        duration,
        operation: 'updateConversationCount'
      });
      logger.performance('updateUserConversationCount', duration, { userId, increment });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.dbError('UPDATE', this.userTableName, error as Error, { 
        userId,
        increment,
        duration,
        operation: 'updateUserConversationCount'
      });
      throw error;
    }
  }

  // Conversation Operations
  async createConversation(userId: string, name: string): Promise<Conversation> {
    const startTime = Date.now();
    const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const logger = this.logger.child({ userId, conversationId });
    
    try {
      logger.info('Creating new conversation', { userId, name, conversationId });
      
      const now = new Date().toISOString();
      const conversation: Conversation = {
        conversationId,
        userId,
        name,
        messageCount: 0,
        createdAt: now,
        updatedAt: now,
        owner: userId,
      };

      await this.docClient.send(new PutCommand({
        TableName: this.conversationTableName,
        Item: conversation,
      }));

      // Update user conversation count
      await this.updateUserConversationCount(userId, 1);

      const duration = Date.now() - startTime;
      logger.dbCreate(this.conversationTableName, conversationId, { 
        name,
        duration,
        operation: 'createConversation'
      });
      logger.businessEvent('conversation_created', { conversationId, name, userId });
      logger.performance('createConversation', duration, { conversationId, userId });
      
      return conversation;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.dbError('CREATE', this.conversationTableName, error as Error, { 
        conversationId,
        userId,
        name,
        duration,
        operation: 'createConversation'
      });
      throw error;
    }
  }

  async getUserConversations(userId: string): Promise<Conversation[]> {
    const startTime = Date.now();
    const logger = this.logger.child({ userId });
    
    try {
      logger.debug('Fetching user conversations', { userId });
      
      const result = await this.docClient.send(new QueryCommand({
        TableName: this.conversationTableName,
        IndexName: 'UserConversationsIndex',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
        ScanIndexForward: false, // Most recent first
      }));

      const conversations = result.Items as Conversation[] || [];
      const duration = Date.now() - startTime;
      
      logger.dbQuery(this.conversationTableName, 'UserConversationsIndex', conversations.length, { 
        userId,
        duration,
        operation: 'getUserConversations'
      });
      logger.performance('getUserConversations', duration, { 
        userId, 
        resultCount: conversations.length 
      });
      
      return conversations;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.dbError('QUERY', this.conversationTableName, error as Error, { 
        userId,
        indexName: 'UserConversationsIndex',
        duration,
        operation: 'getUserConversations'
      });
      return [];
    }
  }

  async getConversation(conversationId: string, userId: string): Promise<Conversation | null> {
    const startTime = Date.now();
    const logger = this.logger.child({ userId, conversationId });
    
    try {
      logger.debug('Fetching conversation', { conversationId, userId });
      
      const result = await this.docClient.send(new GetCommand({
        TableName: this.conversationTableName,
        Key: { conversationId },
      }));

      const conversation = result.Item as Conversation;
      
      // Verify ownership
      if (conversation && conversation.userId !== userId && conversation.owner !== userId) {
        const duration = Date.now() - startTime;
        logger.security('unauthorized_conversation_access', { 
          conversationId,
          requestUserId: userId,
          conversationUserId: conversation.userId,
          duration
        });
        return null; // User doesn't own this conversation
      }

      const duration = Date.now() - startTime;
      const found = !!conversation;
      
      logger.dbRead(this.conversationTableName, conversationId, found, { 
        userId,
        duration,
        operation: 'getConversation'
      });
      logger.performance('getConversation', duration, { conversationId, userId, found });
      
      return conversation || null;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.dbError('READ', this.conversationTableName, error as Error, { 
        conversationId,
        userId,
        duration,
        operation: 'getConversation'
      });
      throw error;
    }
  }

  async updateConversation(conversationId: string, userId: string, updates: Partial<Conversation>): Promise<void> {
    const startTime = Date.now();
    const logger = this.logger.child({ userId, conversationId });
    
    try {
      logger.info('Updating conversation', { conversationId, userId, updates });
      
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

      const duration = Date.now() - startTime;
      logger.dbUpdate(this.conversationTableName, conversationId, { 
        userId,
        updates,
        duration,
        operation: 'updateConversation'
      });
      
      if (updates.name) {
        logger.businessEvent('conversation_renamed', { 
          conversationId, 
          oldName: existing.name, 
          newName: updates.name, 
          userId 
        });
      }
      
      logger.performance('updateConversation', duration, { conversationId, userId });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.dbError('UPDATE', this.conversationTableName, error as Error, { 
        conversationId,
        userId,
        updates,
        duration,
        operation: 'updateConversation'
      });
      throw error;
    }
  }

  async deleteConversation(conversationId: string, userId: string): Promise<void> {
    const startTime = Date.now();
    const logger = this.logger.child({ userId, conversationId });
    
    try {
      logger.info('Deleting conversation', { conversationId, userId });
      
      // First verify ownership
      const conversation = await this.getConversation(conversationId, userId);
      if (!conversation) {
        throw new Error('Conversation not found or access denied');
      }

      // Delete all messages first
      const messages = await this.getConversationMessages(conversationId, userId);
      if (messages.length > 0) {
        logger.info('Deleting conversation messages', { 
          conversationId, 
          messageCount: messages.length 
        });
        
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
          
          logger.dbBatchWrite(this.messageTableName, 'DELETE', batch.length, {
            conversationId,
            batchIndex: Math.floor(i / 25) + 1,
            totalBatches: Math.ceil(deleteRequests.length / 25)
          });
        }
      }

      // Delete the conversation
      await this.docClient.send(new DeleteCommand({
        TableName: this.conversationTableName,
        Key: { conversationId },
      }));

      // Update user conversation count
      await this.updateUserConversationCount(userId, -1);

      const duration = Date.now() - startTime;
      logger.dbDelete(this.conversationTableName, conversationId, { 
        userId,
        messagesDeleted: messages.length,
        duration,
        operation: 'deleteConversation'
      });
      logger.businessEvent('conversation_deleted', { 
        conversationId, 
        name: conversation.name, 
        userId, 
        messagesDeleted: messages.length 
      });
      logger.performance('deleteConversation', duration, { 
        conversationId, 
        userId, 
        messagesDeleted: messages.length 
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.dbError('DELETE', this.conversationTableName, error as Error, { 
        conversationId,
        userId,
        duration,
        operation: 'deleteConversation'
      });
      throw error;
    }
  }

  // Message Operations
  async createMessage(messageData: Omit<Message, 'messageId' | 'createdAt'>): Promise<Message> {
    const startTime = Date.now();
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const logger = this.logger.child({ 
      userId: messageData.userId, 
      conversationId: messageData.conversationId,
      messageId 
    });
    
    try {
      logger.info('Creating new message', { 
        messageId,
        conversationId: messageData.conversationId,
        role: messageData.role,
        contentLength: messageData.content.length,
        hasSources: !!messageData.sources
      });
      
      const now = new Date().toISOString();
      const message: Message = {
        ...messageData,
        messageId,
        createdAt: now,
        owner: messageData.userId,
      };

      await this.docClient.send(new PutCommand({
        TableName: this.messageTableName,
        Item: message,
      }));

      // Update conversation message count and updatedAt
      await this.docClient.send(new UpdateCommand({
        TableName: this.conversationTableName,
        Key: { conversationId: messageData.conversationId },
        UpdateExpression: 'SET messageCount = messageCount + :inc, updatedAt = :now',
        ExpressionAttributeValues: {
          ':inc': 1,
          ':now': now,
        },
      }));

      const duration = Date.now() - startTime;
      logger.dbCreate(this.messageTableName, messageId, { 
        conversationId: messageData.conversationId,
        role: messageData.role,
        contentLength: messageData.content.length,
        duration,
        operation: 'createMessage'
      });
      logger.businessEvent('message_created', { 
        messageId,
        conversationId: messageData.conversationId,
        role: messageData.role,
        userId: messageData.userId
      });
      logger.performance('createMessage', duration, { 
        messageId, 
        conversationId: messageData.conversationId 
      });
      
      return message;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.dbError('CREATE', this.messageTableName, error as Error, { 
        messageId,
        conversationId: messageData.conversationId,
        userId: messageData.userId,
        duration,
        operation: 'createMessage'
      });
      throw error;
    }
  }

  async getConversationMessages(conversationId: string, userId: string): Promise<Message[]> {
    const startTime = Date.now();
    const logger = this.logger.child({ userId, conversationId });
    
    try {
      logger.debug('Fetching conversation messages', { conversationId, userId });
      
      // First verify user owns the conversation
      const conversation = await this.getConversation(conversationId, userId);
      if (!conversation) {
        logger.security('unauthorized_message_access', { 
          conversationId,
          userId
        });
        return []; // No access to conversation
      }

      const result = await this.docClient.send(new QueryCommand({
        TableName: this.messageTableName,
        IndexName: 'ConversationMessagesIndex',
        KeyConditionExpression: 'conversationId = :conversationId',
        ExpressionAttributeValues: {
          ':conversationId': conversationId,
        },
        ScanIndexForward: true, // Chronological order
      }));

      const messages = result.Items as Message[] || [];
      const duration = Date.now() - startTime;
      
      logger.dbQuery(this.messageTableName, 'ConversationMessagesIndex', messages.length, { 
        conversationId,
        userId,
        duration,
        operation: 'getConversationMessages'
      });
      logger.performance('getConversationMessages', duration, { 
        conversationId, 
        userId, 
        resultCount: messages.length 
      });
      
      return messages;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.dbError('QUERY', this.messageTableName, error as Error, { 
        conversationId,
        userId,
        indexName: 'ConversationMessagesIndex',
        duration,
        operation: 'getConversationMessages'
      });
      throw error;
    }
  }
} 