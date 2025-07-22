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
import { preSignup } from './functions/pre-signup/resource';
import * as cdk from 'aws-cdk-lib';

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
const backend = defineBackend({
  auth,
  data,
  bedrockKbFunction,
  preSignup
});

// Add DynamoDB permissions to the function
backend.bedrockKbFunction.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: [
      'dynamodb:PutItem',
      'dynamodb:GetItem',
      'dynamodb:Query',
      'dynamodb:UpdateItem',
      'dynamodb:DeleteItem',
      'dynamodb:BatchWriteItem',
    ],
    resources: [
      `${backend.data.resources.tables["User"].tableArn}`,
      `${backend.data.resources.tables["User"].tableArn}/index/*`,
      `${backend.data.resources.tables["Conversation"].tableArn}`,
      `${backend.data.resources.tables["Conversation"].tableArn}/index/*`,
      `${backend.data.resources.tables["Message"].tableArn}`,
      `${backend.data.resources.tables["Message"].tableArn}/index/*`,
    ],
  })
);

// Grant the function access to AppSync for frontend compatibility
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

// Add CloudWatch Logs permissions for enhanced logging
backend.bedrockKbFunction.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: [
      'logs:CreateLogGroup',
      'logs:CreateLogStream',
      'logs:PutLogEvents',
      'logs:DescribeLogStreams',
      'logs:DescribeLogGroups'
    ],
    resources: [
      `arn:aws:logs:*:*:log-group:/aws/lambda/*`,
      `arn:aws:logs:*:*:log-group:/aws/lambda/*:*`
    ]
  })
);

// Pass table names and Cognito info to Lambda function
backend.bedrockKbFunction.addEnvironment("USER_TABLE_NAME", backend.data.resources.tables["User"].tableName);
backend.bedrockKbFunction.addEnvironment("CONVERSATION_TABLE_NAME", backend.data.resources.tables["Conversation"].tableName);
backend.bedrockKbFunction.addEnvironment("MESSAGE_TABLE_NAME", backend.data.resources.tables["Message"].tableName);
backend.bedrockKbFunction.addEnvironment("USER_POOL_ID", backend.auth.resources.userPool.userPoolId);
backend.bedrockKbFunction.addEnvironment("USER_POOL_CLIENT_ID", backend.auth.resources.userPoolClient.userPoolClientId);

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
      'https://main.d2v40bpj9oxupa.amplifyapp.com',
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

// Create the conversation resource for updates
const conversationPath = chatPath.addResource("conversation");
const conversationIdPath = conversationPath.addResource("{id}");

// Add PUT method for conversation updates with Cognito authorization
conversationIdPath.addMethod("PUT", lambdaIntegration, {
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
      statusCode: '400',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Origin': true,
        'method.response.header.Access-Control-Allow-Headers': true,
        'method.response.header.Access-Control-Allow-Methods': true,
        'method.response.header.Access-Control-Allow-Credentials': true,
      },
    },
    {
      statusCode: '404',
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
