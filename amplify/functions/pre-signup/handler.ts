import type { PreSignUpTriggerHandler } from 'aws-lambda';

export const handler: PreSignUpTriggerHandler = async (event) => {
  // Check if the user's email ends with @enzagroup.global
  if (event.request.userAttributes.email && 
      event.request.userAttributes.email.endsWith('@enzagroup.global')) {
    // Automatically confirm the user and verify their email
    event.response.autoConfirmUser = true;
    event.response.autoVerifyEmail = true;
  }
  
  return event;
}; 