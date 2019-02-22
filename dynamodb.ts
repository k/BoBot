import { DynamoDB } from "aws-sdk";

const dynamoDb = new DynamoDB.DocumentClient();
const TableName = process.env.DYNAMODB_TABLE;

if (!TableName) {
  throw new Error("DYNAMODB_TABLE env var required");
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
    TableName,
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
    TableName,
    Key: { id }
  };

  return dynamoDb.get(params).promise()
}

export const updateAccounting = async (item) => {
  const timestamp = new Date().getTime();
  const params = {
    TableName,
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
