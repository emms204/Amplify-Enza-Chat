import { defineBackend } from '@aws-amplify/backend';
import { Stack } from 'aws-cdk-lib';
import {
  AuthorizationType,
  Cors,
  LambdaIntegration,
  RestApi,
  MethodOptions,
  CognitoUserPoolsAuthorizer,
  JsonSchemaType,
} from 'aws-cdk-lib/aws-apigateway';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { bedrockKbFunction } from "./functions/api-function/resource";
import * as cdk from 'aws-cdk-lib';

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
const backend = defineBackend({
  auth,
  data,
  bedrockKbFunction
});

// Grant the function access to the new data resources
backend.bedrockKbFunction.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['appsync:GraphQL'],
    resources: [`${backend.data.resources.cfnResources.cfnGraphqlApi.attrArn}/*`],
  })
);

// Add Bedrock permissions to the function
backend.bedrockKbFunction.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: [
      'bedrock:InvokeModel',
      'bedrock:Retrieve',
      'bedrock-agent:Retrieve',
      'bedrock-agent-runtime:Retrieve'
    ],
    resources: ['*']
  })
);

// Create a new API stack for the REST API
const apiStack = backend.createStack("chat-api-stack");

// Create a new REST API
const chatRestApi = new RestApi(apiStack, "ChatRestApi", {
  restApiName: "chatApi",
  deploy: true,
  deployOptions: {
    stageName: "dev",
  },
  defaultCorsPreflightOptions: {
    allowOrigins: [
      'http://localhost:3000',
      'https://localhost:3000',
      // 'https://main.d2u0pycjfm8zuu.amplifyapp.com',
      'https://main.d1w9nr6stbxah6.amplifyapp.com'
    ],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'X-Amz-Date',
      'X-Api-Key',
      'X-Amz-Security-Token',
      'X-Amz-User-Agent',
      'X-Amz-Content-Sha256'
    ],
    allowCredentials: true,
  },
});

// Create a Cognito User Pool authorizer
const cognitoAuthorizer = new CognitoUserPoolsAuthorizer(apiStack, 'CognitoAuthorizer', {
  cognitoUserPools: [backend.auth.resources.userPool]
});

// Create a new Lambda integration with increased timeout
const lambdaIntegration = new LambdaIntegration(
  backend.bedrockKbFunction.resources.lambda,
  {
    timeout: cdk.Duration.seconds(29), // API Gateway max timeout is 29 seconds
    proxy: true
  }
);

// Create the chat resource
const chatPath = chatRestApi.root.addResource("chat");

// Add POST method for chat with Cognito authorization
chatPath.addMethod("POST", lambdaIntegration, {
  authorizer: cognitoAuthorizer,
  methodResponses: [
    {
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Origin': true,
        'method.response.header.Access-Control-Allow-Headers': true,
        'method.response.header.Access-Control-Allow-Methods': true,
        'method.response.header.Access-Control-Allow-Credentials': true,
      },
    },
    {
      statusCode: '500',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Origin': true,
        'method.response.header.Access-Control-Allow-Headers': true,
        'method.response.header.Access-Control-Allow-Methods': true,
        'method.response.header.Access-Control-Allow-Credentials': true,
      },
    },
  ],
});

// Add outputs to the configuration file
backend.addOutput({
  custom: {
    API: {
      [chatRestApi.restApiName]: {
        endpoint: chatRestApi.url,
        region: Stack.of(chatRestApi).region,
        apiName: chatRestApi.restApiName,
      },
    },
  },
});

export { backend };
