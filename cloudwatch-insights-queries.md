# CloudWatch Insights Queries for Enza Chat App

This document contains useful CloudWatch Insights queries for monitoring your chat application's database operations and performance.

## Database Operations Monitoring

### All Database Operations
```
fields @timestamp, level, message, context.operation, context.tableName, data.operation, data.duration
| filter level = "INFO" and (message like /Database/ or data.operation exists)
| sort @timestamp desc
```

### Database Errors
```
fields @timestamp, level, message, context.operation, context.tableName, error.name, error.message
| filter level = "ERROR" and (context.tableName exists or message like /Database/)
| sort @timestamp desc
```

### CREATE Operations
```
fields @timestamp, message, context.userId, context.conversationId, data.tableName, data.itemId, data.duration
| filter data.operation = "CREATE"
| sort @timestamp desc
```

### READ Operations with Performance
```
fields @timestamp, message, context.userId, data.tableName, data.itemId, data.found, data.duration
| filter data.operation = "READ"
| stats avg(data.duration), max(data.duration), count() by data.tableName
```

### UPDATE Operations
```
fields @timestamp, message, context.userId, context.conversationId, data.tableName, data.itemId, data.duration
| filter data.operation = "UPDATE"
| sort @timestamp desc
```

### DELETE Operations
```
fields @timestamp, message, context.userId, context.conversationId, data.tableName, data.itemId, data.duration
| filter data.operation = "DELETE"
| sort @timestamp desc
```

### QUERY Operations with Results
```
fields @timestamp, message, context.userId, data.tableName, data.indexName, data.resultCount, data.duration
| filter data.operation = "QUERY"
| sort @timestamp desc
```

### Batch Operations
```
fields @timestamp, message, data.tableName, data.batchOperation, data.itemCount, data.duration
| filter data.operation = "BATCH_WRITE"
| sort @timestamp desc
```

## Performance Monitoring

### Database Performance by Operation
```
fields @timestamp, data.operation, data.duration, data.tableName
| filter data.operation exists and data.duration exists
| stats avg(data.duration), max(data.duration), min(data.duration), count() by data.operation, data.tableName
| sort avg(data.duration) desc
```

### Slow Database Operations (>1000ms)
```
fields @timestamp, message, data.operation, data.tableName, data.duration, context.userId
| filter data.duration > 1000
| sort data.duration desc
```

### Request Performance
```
fields @timestamp, data.operation, data.durationMs, context.userId, context.conversationId
| filter message like /Performance measurement/
| stats avg(data.durationMs), max(data.durationMs), count() by data.operation
| sort avg(data.durationMs) desc
```

## Business Events

### User Creation Events
```
fields @timestamp, message, data.event, data.userId, data.email
| filter data.eventType = "business" and data.event = "user_created_jit"
| sort @timestamp desc
```

### Conversation Events
```
fields @timestamp, message, data.event, data.conversationId, data.name, data.userId
| filter data.eventType = "business" and (data.event = "conversation_created" or data.event = "conversation_deleted" or data.event = "conversation_renamed")
| sort @timestamp desc
```

### Message Events
```
fields @timestamp, message, data.event, data.messageId, data.conversationId, data.role, data.userId
| filter data.eventType = "business" and data.event = "message_created"
| sort @timestamp desc
```

### Chat Interactions
```
fields @timestamp, message, data.conversationId, data.totalDuration, data.hasKnowledgeBase
| filter data.event = "chat_interaction_completed"
| stats avg(data.totalDuration), count() by bin(5m)
```

## Security Monitoring

### Authentication Failures
```
fields @timestamp, message, data.event, data.path, data.userAgent
| filter data.eventType = "security" and data.event = "authentication_failed"
| sort @timestamp desc
```

### Unauthorized Access Attempts
```
fields @timestamp, message, data.event, data.conversationId, data.userId
| filter data.eventType = "security" and (data.event like /unauthorized/)
| sort @timestamp desc
```

## Request Monitoring

### Request Lifecycle
```
fields @timestamp, message, data.httpMethod, data.path, data.statusCode, data.durationMs, context.userId
| filter message like /Request/ and (message like /started/ or message like /completed/)
| sort @timestamp desc
```

### Error Requests
```
fields @timestamp, message, data.httpMethod, data.path, data.statusCode, data.durationMs, error.message
| filter data.statusCode >= 400
| sort @timestamp desc
```

### API Usage by Endpoint
```
fields @timestamp, data.httpMethod, data.path, data.statusCode
| filter message = "Request completed"
| stats count() by data.httpMethod, data.path, data.statusCode
| sort count desc
```

## Bedrock Operations

### Knowledge Base Retrieval Performance
```
fields @timestamp, message, data.operation, data.durationMs, data.resultCount, context.conversationId
| filter data.operation = "bedrockRetrieval"
| stats avg(data.durationMs), max(data.durationMs), avg(data.resultCount) by bin(5m)
```

### Model Generation Performance
```
fields @timestamp, message, data.operation, data.durationMs, data.responseLength, context.conversationId
| filter data.operation = "bedrockGeneration"
| stats avg(data.durationMs), max(data.durationMs), avg(data.responseLength) by bin(5m)
```

### Complete Chat Request Performance
```
fields @timestamp, message, data.totalDuration, data.retrievalDuration, data.generationDuration, data.sourceCount
| filter data.operation = "completeChatRequest"
| sort @timestamp desc
```

## Troubleshooting Queries

### Recent Errors (Last Hour)
```
fields @timestamp, level, message, error.name, error.message, context.userId, context.operation
| filter level = "ERROR" and @timestamp > @timestamp - 1h
| sort @timestamp desc
```

### User-Specific Issues
```
fields @timestamp, level, message, context.operation, data.operation, error.message
| filter context.userId = "USER_ID_HERE"
| sort @timestamp desc
```

### Conversation-Specific Issues
```
fields @timestamp, level, message, context.operation, data.operation, error.message, context.userId
| filter context.conversationId = "CONVERSATION_ID_HERE"
| sort @timestamp desc
```

### Database Connection Issues
```
fields @timestamp, message, error.name, error.message, data.tableName
| filter error.name like /Connection/ or error.message like /timeout/ or error.message like /connection/
| sort @timestamp desc
```

## Custom Metrics Extraction

### Daily Active Users
```
fields @timestamp, context.userId
| filter message = "User authenticated successfully"
| stats count_distinct(context.userId) by bin(1d)
```

### Conversation Creation Rate
```
fields @timestamp, data.conversationId
| filter data.event = "conversation_created"
| stats count() by bin(1h)
```

### Average Message Length
```
fields @timestamp, data.userMessageLength, data.assistantMessageLength
| filter data.operation = "completeChatRequest"
| stats avg(data.userMessageLength), avg(data.assistantMessageLength) by bin(1h)
```

## Usage Tips

1. **Time Range**: Always specify an appropriate time range for your queries to avoid scanning unnecessary logs.

2. **Filtering**: Use specific filters to narrow down results, especially when dealing with high-volume logs.

3. **Performance**: For performance analysis, focus on the `data.duration` and `data.durationMs` fields.

4. **Business Intelligence**: Use the business event queries to understand user behavior and application usage patterns.

5. **Alerting**: Consider setting up CloudWatch alarms based on these queries for proactive monitoring.

## Log Structure Reference

The application generates structured JSON logs with the following key fields:

- `@timestamp`: ISO timestamp
- `level`: Log level (DEBUG, INFO, WARN, ERROR)
- `message`: Human-readable message
- `context`: Request context (userId, conversationId, operation, etc.)
- `data`: Operation-specific data
- `error`: Error details (when applicable)
- `service`: Always "enza-chat"
- `function`: Always "bedrock-kb-api"
- `environment`: Environment name 