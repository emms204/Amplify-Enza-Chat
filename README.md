# Enza Chat App - AWS Amplify + Next.js Integration

## Architecture Overview

This project integrates a Next.js 15.2.4 TypeScript frontend with AWS Amplify Gen 2 backend services including:

- **Authentication**: AWS Cognito User Pool with email sign-in
- **API**: GraphQL API with AWS AppSync  
- **Data**: DynamoDB with real-time subscriptions
- **Frontend**: Modern Next.js with Tailwind CSS, Radix UI, and React Hook Form

## Project Structure

```
amplify/
├── amplify/                    # Amplify backend definition
│   ├── auth/                   # Cognito authentication config
│   ├── data/                   # GraphQL API and data models
│   └── backend.ts              # Backend configuration
├── app/                        # Next.js app directory
├── components/                 # React components
├── lib/                        # Amplify configuration and utilities
├── types/                      # TypeScript type definitions
├── amplify_outputs.json        # Auto-generated Amplify config
└── package.json                # Dependencies and scripts
```

## Phase 1 Deliverables ✅

### ✅ Merged Project Structure
- Moved Next.js app into Amplify directory structure
- Proper file organization with backend and frontend colocated
- Clean separation of concerns maintained

### ✅ Updated Dependencies
- **AWS Amplify packages**: `aws-amplify`, `@aws-amplify/ui-react`, `@aws-amplify/adapter-nextjs`
- **Next.js 15.2.4**: Latest stable version with React 19
- **UI Framework**: Complete Radix UI component library
- **Developer Tools**: TypeScript, Tailwind CSS, React Hook Form

### ✅ Amplify Configuration Setup
- **Client Configuration**: `/lib/amplify-provider.tsx` for React context
- **Server Configuration**: `/lib/amplify-server-utils.ts` for SSR support  
- **Type Definitions**: `/types/amplify.d.ts` for TypeScript integration
- **Environment Config**: Proper separation of development/production settings

### ✅ TypeScript Configuration
- Updated paths for integrated structure
- Amplify type definitions included
- Proper module resolution for both frontend and backend code
- Support for JSON imports (amplify_outputs.json)

## Available Scripts

```bash
# Development
npm run dev          # Start Next.js development server

# Production  
npm run build        # Build optimized production bundle
npm run start        # Start production server

# Code Quality
npm run lint         # Run ESLint
```

## Key Integration Files

### 1. Amplify Provider (`/lib/amplify-provider.tsx`)
```typescript
// Wraps app with Amplify authentication context
import { AmplifyProvider } from '@/lib/amplify-provider'
```

### 2. Server Utils (`/lib/amplify-server-utils.ts`)  
```typescript
// SSR-compatible authentication utilities
import { runWithAmplifyServerContext } from '@/lib/amplify-server-utils'
```

### 3. Configuration (`amplify_outputs.json`)
- Auto-generated configuration from deployed backend
- Contains Cognito User Pool and API endpoints
- Used by both client and server-side code

## Authentication Integration Points

Your existing authentication flow can now be replaced with:

```typescript
import { Authenticator } from '@aws-amplify/ui-react'
import { useAuthenticator } from '@aws-amplify/ui-react'

// Replace localStorage auth checks with:
const { user, signOut } = useAuthenticator()
```

## Next Steps for Phase 2

1. **Replace Custom Login Form** with `<Authenticator>` component
2. **Update Route Protection** to use Amplify authentication state  
3. **Integrate GraphQL API** for real-time chat functionality
4. **Configure Social Sign-in** (Google, Facebook, etc.)
5. **Add MFA Support** for enhanced security

## Development Notes

- Backend resources are already deployed and configured
- Frontend can now authenticate against your existing Cognito User Pool
- All Amplify configuration is automatically loaded from `amplify_outputs.json`
- SSR/SSG compatibility is properly configured for production deployment

## Environment Requirements

- Node.js 18+
- AWS CLI configured (for backend deployments)
- Valid `amplify_outputs.json` from deployed backend

---

**Integration Complete!** 🚀 

Your Next.js app is now properly configured to work with your existing AWS Amplify backend. The foundation is set for seamless authentication and real-time chat functionality. 