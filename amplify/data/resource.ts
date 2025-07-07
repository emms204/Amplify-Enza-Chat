import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

/*== STEP 1 ===============================================================
The section below creates a Todo database table with a "content" field. Try
adding a new "isDone" field as a boolean. The authorization rule below
specifies that any unauthenticated user can "create", "read", "update", 
and "delete" any "Todo" records.
=========================================================================*/
const schema = a.schema({
  User: a.model({
    userId: a.id().required(),
    email: a.string(),
    displayName: a.string(),
    conversationCount: a.integer().default(0),
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
  }).authorization(allow => [
    allow.owner()
  ]).identifier(['userId']),

  Conversation: a.model({
    conversationId: a.id().required(),
    userId: a.id().required(),
    name: a.string().required(),
    messageCount: a.integer().default(0),
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
    messages: a.hasMany('Message', 'conversationId'),
  }).authorization(allow => [
    allow.owner()
  ]).identifier(['conversationId']),

  Message: a.model({
    messageId: a.id().required(),
    conversationId: a.id().required(),
    userId: a.id().required(),
    content: a.string().required(),
    role: a.enum(['user', 'assistant']),
    sources: a.json(),
    createdAt: a.datetime(),
    conversation: a.belongsTo('Conversation', 'conversationId'),
  }).authorization(allow => [
    allow.owner()
  ]).identifier(['messageId']),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});

/*== STEP 2 ===============================================================
Go to your frontend source code. From your client-side code, generate a
Data client to make CRUDL requests to your table. (THIS SNIPPET WILL ONLY
WORK IN THE FRONTEND CODE FILE.)

Using JavaScript or Next.js React Server Components, Middleware, Server 
Actions or Pages Router? Review how to generate Data clients for those use
cases: https://docs.amplify.aws/gen2/build-a-backend/data/connect-to-API/
=========================================================================*/

/*
"use client"
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>() // use this Data client for CRUDL requests
*/

/*== STEP 3 ===============================================================
Fetch records from the database and use them in your frontend component.
(THIS SNIPPET WILL ONLY WORK IN THE FRONTEND CODE FILE.)
=========================================================================*/

/* For example, in a React component, you can use this snippet in your
  function's RETURN statement */
// const { data: todos } = await client.models.Todo.list()

// return <ul>{todos.map(todo => <li key={todo.id}>{todo.content}</li>)}</ul>
