/**
 * Generate a smart conversation name based on the first user message
 */
export const generateConversationName = (firstMessage: string): string => {
  // Clean the input message
  const cleaned = firstMessage.trim();
  
  // If message is too short, use fallback naming
  if (cleaned.length < 5) {
    return generateFallbackName();
  }
  
  // Apply smart naming rules
  let name = applyNamingRules(cleaned);
  
  // Truncate to reasonable length (50 characters max)
  name = smartTruncate(name, 50);
  
  return name;
};

/**
 * Apply intelligent naming rules based on message patterns
 */
const applyNamingRules = (message: string): string => {
  // Remove common conversational starters
  let processed = message
    .replace(/^(hi|hello|hey|please|can you|could you|would you|i need|i want|help me)\s+/i, '')
    .replace(/^(tell me|explain|show me|what is|what are|how do|how to|where is|when is|why)\s*/i, '$&')
    .trim();
  
  // If we removed too much, use original
  if (processed.length < 5) {
    processed = message;
  }
  
  // Capitalize first letter
  processed = processed.charAt(0).toUpperCase() + processed.slice(1);
  
  // Clean up common patterns
  processed = processed
    .replace(/\?+$/, '') // Remove trailing question marks
    .replace(/\.+$/, '') // Remove trailing periods
    .replace(/!+$/, '') // Remove trailing exclamations
    .trim();
  
  return processed;
};

/**
 * Smart truncation that tries to end at word boundaries
 */
const smartTruncate = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) {
    return text;
  }
  
  // Find the last space within the limit
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  // If we found a space and it's not too close to the beginning
  if (lastSpace > maxLength * 0.6) {
    return truncated.substring(0, lastSpace) + '...';
  }
  
  // Otherwise, hard truncate and add ellipsis
  return truncated.substring(0, maxLength - 3) + '...';
};

/**
 * Generate fallback name when message is too short or unclear
 */
const generateFallbackName = (): string => {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  };
  
  return `Chat started on ${now.toLocaleDateString('en-US', options)}`;
};

/**
 * Validate conversation name for manual updates
 */
export const validateConversationName = (name: string): { isValid: boolean; error?: string } => {
  const trimmed = name.trim();
  
  if (!trimmed) {
    return { isValid: false, error: 'Conversation name cannot be empty' };
  }
  
  if (trimmed.length > 100) {
    return { isValid: false, error: 'Conversation name must be 100 characters or less' };
  }
  
  // Check for invalid characters (optional - can be customized)
  const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
  if (invalidChars.test(trimmed)) {
    return { isValid: false, error: 'Conversation name contains invalid characters' };
  }
  
  return { isValid: true };
};

/**
 * Clean user input for conversation naming
 */
export const cleanConversationName = (name: string): string => {
  return name
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .substring(0, 100); // Ensure max length
}; 