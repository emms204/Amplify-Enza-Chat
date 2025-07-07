import type { Schema } from '@/amplify/data/resource';

declare global {
  namespace Amplify {
    interface UserAttributes {
      email: string;
      sub: string;
    }
  }
}

export type AmplifyUser = {
  username: string;
  userId: string;
  signInDetails?: {
    loginId?: string;
    authFlowType?: string;
  };
};

export type { Schema }; 