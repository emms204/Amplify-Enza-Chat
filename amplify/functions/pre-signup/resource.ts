import { defineFunction } from '@aws-amplify/backend';

export const preSignup = defineFunction({
  name: 'pre-signup',
  entry: './handler.ts',
  resourceGroupName: 'auth'
}); 