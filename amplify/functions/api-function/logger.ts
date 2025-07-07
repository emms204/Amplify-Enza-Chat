export interface LogContext {
  userId?: string;
  conversationId?: string;
  messageId?: string;
  operation?: string;
  tableName?: string;
  requestId?: string;
}

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

export class Logger {
  private static instance: Logger;
  private context: LogContext;

  private constructor(context: LogContext = {}) {
    this.context = context;
  }

  public static getInstance(context: LogContext = {}): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(context);
    }
    return Logger.instance;
  }

  public static createLogger(context: LogContext = {}): Logger {
    return new Logger(context);
  }

  private formatLog(level: LogLevel, message: string, data?: any, error?: Error): any {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      context: this.context,
      ...(data && { data }),
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        }
      }),
      // AWS specific fields for CloudWatch Insights
      service: 'enza-chat',
      function: 'bedrock-kb-api',
      environment: process.env.NODE_ENV || 'development',
    };

    return logEntry;
  }

  private log(level: LogLevel, message: string, data?: any, error?: Error): void {
    const logEntry = this.formatLog(level, message, data, error);
    
    // Use console methods for CloudWatch integration
    switch (level) {
      case LogLevel.ERROR:
        console.error(JSON.stringify(logEntry));
        break;
      case LogLevel.WARN:
        console.warn(JSON.stringify(logEntry));
        break;
      case LogLevel.DEBUG:
        console.debug(JSON.stringify(logEntry));
        break;
      default:
        console.log(JSON.stringify(logEntry));
    }
  }

  public debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  public info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  public warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  public error(message: string, error?: Error, data?: any): void {
    this.log(LogLevel.ERROR, message, data, error);
  }

  // Database operation specific logging methods
  public dbCreate(tableName: string, itemId: string, data?: any): void {
    this.info(`Database CREATE operation`, {
      operation: 'CREATE',
      tableName,
      itemId,
      ...data
    });
  }

  public dbRead(tableName: string, itemId: string, found: boolean, data?: any): void {
    this.info(`Database READ operation`, {
      operation: 'READ',
      tableName,
      itemId,
      found,
      ...data
    });
  }

  public dbUpdate(tableName: string, itemId: string, data?: any): void {
    this.info(`Database UPDATE operation`, {
      operation: 'UPDATE',
      tableName,
      itemId,
      ...data
    });
  }

  public dbDelete(tableName: string, itemId: string, data?: any): void {
    this.info(`Database DELETE operation`, {
      operation: 'DELETE',
      tableName,
      itemId,
      ...data
    });
  }

  public dbQuery(tableName: string, indexName?: string, resultCount?: number, data?: any): void {
    this.info(`Database QUERY operation`, {
      operation: 'QUERY',
      tableName,
      indexName,
      resultCount,
      ...data
    });
  }

  public dbBatchWrite(tableName: string, operation: string, count: number, data?: any): void {
    this.info(`Database BATCH_WRITE operation`, {
      operation: 'BATCH_WRITE',
      tableName,
      batchOperation: operation,
      itemCount: count,
      ...data
    });
  }

  public dbError(operation: string, tableName: string, error: Error, data?: any): void {
    this.error(`Database ${operation} operation failed`, error, {
      operation,
      tableName,
      ...data
    });
  }

  // Performance monitoring
  public performance(operation: string, durationMs: number, data?: any): void {
    this.info(`Performance measurement`, {
      operation,
      durationMs,
      ...data
    });
  }

  // Request lifecycle logging
  public requestStart(method: string, path: string, data?: any): void {
    this.info(`Request started`, {
      httpMethod: method,
      path,
      ...data
    });
  }

  public requestEnd(method: string, path: string, statusCode: number, durationMs: number, data?: any): void {
    this.info(`Request completed`, {
      httpMethod: method,
      path,
      statusCode,
      durationMs,
      ...data
    });
  }

  // Business logic logging
  public businessEvent(event: string, data?: any): void {
    this.info(`Business event: ${event}`, {
      eventType: 'business',
      event,
      ...data
    });
  }

  // Security logging
  public security(event: string, data?: any): void {
    this.warn(`Security event: ${event}`, {
      eventType: 'security',
      event,
      ...data
    });
  }

  // Create child logger with additional context
  public child(additionalContext: LogContext): Logger {
    return new Logger({
      ...this.context,
      ...additionalContext
    });
  }
} 