import { DynamoDB } from "aws-sdk";

const dynamoDb = new DynamoDB.DocumentClient();
const OrdersTable = process.env.ORDERS_TABLE;
const SlackAppTable = process.env.SLACK_APP_TABLE;

if (!OrdersTable) {
  throw new Error("ORDERS_TABLE env var required");
}

if (!SlackAppTable) {
  throw new Error("SLACK_APP_TABLE env var required");
}

function sanitizeObject(obj) {
  for (const i in obj) {
    if (obj[i] == null || obj[i] == '') {
      delete obj[i];
    }
    if (typeof obj[i] === "object") {
      sanitizeObject(obj[i]);
    }
  }
  return obj
}

export const createOrderInfo = async (item) => {
  const timestamp = new Date().getTime();
  const params = {
    TableName: OrdersTable,
    Item: {
      createdAt: timestamp,
      updatedAt: timestamp,
      ...sanitizeObject(item),
    }
  };

  return dynamoDb.put(params).promise();
};

export const getOrderInfo = async(id: string) => {
  const params = {
    TableName: OrdersTable,
    Key: { id }
  };

  return dynamoDb.get(params).promise()
}

export const updateAccounting = async (item) => {
  const timestamp = new Date().getTime();
  const params = {
    TableName: OrdersTable,
    Key: {
      id: item.id,
    },
    ExpressionAttributeValues: {
      ':accounting': item.accounting,
      ':updatedAt': timestamp,
    },
    UpdateExpression: 'SET accounting = :accounting, updatedAt = :updatedAt',
    ReturnValues: 'ALL_NEW',
  };
  return dynamoDb.update(params).promise()
}

export const createApp = async (auth) => {
  const timestamp = new Date().getTime();
  const params = {
    TableName: SlackAppTable,
    Item: {
      createdAt: timestamp,
      updatedAt: timestamp,
      ...auth
    }
  };
  return dynamoDb.put(params).promise();
}

export const getSlackApp = async(team_id: string) => {
  const params = {
    TableName: SlackAppTable,
    Key: { team_id }
  };

  const { Item } = await dynamoDb.get(params).promise()
  if (!Item) {
    throw new Error(`Could not find Slack App for team_id: ${team_id}`);
  }
  return Item
}
