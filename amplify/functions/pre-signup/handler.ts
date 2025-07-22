import type { PreSignUpTriggerHandler } from 'aws-lambda';
import { Logger } from '../api-function/logger';

export const handler: PreSignUpTriggerHandler = async (event) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const logger = Logger.createLogger({ requestId, operation: 'preSignUp' });
  
  try {
    logger.info('Pre-signup trigger started', {
      userPoolId: event.userPoolId,
      triggerSource: event.triggerSource,
      region: event.region,
      version: event.version
    });

    // Log the user attributes we received
    logger.info('User attributes received', {
      email: event.request.userAttributes.email,
      hasEmail: !!event.request.userAttributes.email,
      allAttributes: Object.keys(event.request.userAttributes || {}),
      clientMetadata: event.request.clientMetadata
    });

    const userEmail = event.request.userAttributes.email;
    
    if (!userEmail) {
      logger.warn('No email found in user attributes');
      return event;
    }

    logger.info('Checking email domain', {
      email: userEmail,
      isEnzaEmail: userEmail.endsWith('@enzagroup.global'),
      domain: userEmail.split('@')[1]
    });

    // Check if the user's email ends with @enzagroup.global
    if (userEmail.endsWith('@enzagroup.global')) {
      logger.info('Enza email detected - auto-confirming user', {
        email: userEmail,
        beforeAutoConfirm: event.response.autoConfirmUser,
        beforeAutoVerify: event.response.autoVerifyEmail
      });

      // Automatically confirm the user and verify their email
      event.response.autoConfirmUser = true;
      event.response.autoVerifyEmail = true;
      
      logger.info('Auto-confirmation applied', {
        email: userEmail,
        afterAutoConfirm: event.response.autoConfirmUser,
        afterAutoVerify: event.response.autoVerifyEmail,
        responseObject: event.response
      });
    } else {
      logger.info('Non-Enza email - standard signup flow', {
        email: userEmail,
        domain: userEmail.split('@')[1]
      });
    }

    logger.info('Pre-signup trigger completed successfully', {
      email: userEmail,
      finalResponse: event.response
    });
    
    return event;
    
  } catch (error) {
    logger.error('Pre-signup trigger failed', error as Error, {
      event: {
        userPoolId: event.userPoolId,
        triggerSource: event.triggerSource,
        userAttributes: event.request?.userAttributes
      }
    });
    
    // Return the original event even on error to not block signup
    return event;
  }
}; 