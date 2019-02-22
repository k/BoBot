"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var uuid = require("uuid");
var AWS = require("aws-sdk"); // eslint-disable-line import/no-extraneous-dependencies
var dynamoDb = new AWS.DynamoDB.DocumentClient();
exports.testCreate = function (event, context, callback) {
    var timestamp = new Date().getTime();
    var params = {
        TableName: process.env.DYNAMODB_TABLE,
        Item: {
            id: uuid.v1(),
            text: "test data",
            checked: false,
            createdAt: timestamp,
            updatedAt: timestamp
        }
    };
    // write the todo to the database
    dynamoDb.put(params, function (error) {
        // handle potential errors
        if (error) {
            console.error(error);
            callback(null, {
                statusCode: error.statusCode || 501,
                headers: { "Content-Type": "text/plain" },
                body: "Couldn't create the todo item."
            });
            return;
        }
        // create a response
        var response = {
            statusCode: 200,
            body: JSON.stringify(params.Item)
        };
        callback(null, response);
    });
};
//# sourceMappingURL=dynamodb.js.map