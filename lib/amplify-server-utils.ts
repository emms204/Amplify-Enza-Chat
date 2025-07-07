import { createServerRunner } from '@aws-amplify/adapter-nextjs';
import config from '../amplify_outputs.json';

export const { runWithAmplifyServerContext } = createServerRunner({
  config,
});

export { getCurrentUser } from 'aws-amplify/auth/server'; 