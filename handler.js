'use strict';

const request = require('request-promise-native');
const { DateTime } = require('luxon');
const queryString = require('query-string');
const AWS = require('aws-sdk');
const stepfunctions = new AWS.StepFunctions();
const { sendSlackMessage, getTimeZone } = require('./slack');

const startExecution = (params) =>
  new Promise((resolve, reject) => {
    stepfunctions.startExecution(params, function (err, data) {
      if (err != null) {
        reject(err);
      } else {
        resolve(data);
      }
    })
  });

export const startBoba = async (event, context) => {
  try {
    console.log(event)
    const { text, user_id, user_name, team_domain } = queryString.parse(event.body);
    const args = text.split(' ');
    const url = args[0];
    const time = args[1];
    const zone = await getTimeZone(team_domain, user_id);
    const timestamp = DateTime.fromFormat(time, "h:mma", { zone }).toISO()
    const message = args.splice(2)
    console.log(url)

    await sendSlackMessage({
      "attachments": [
          {
              "fallback": `New Boba Order started by ${user_name}! Order here: ${url}`,
              "color": "#36a64f",
              "pretext": "<!channel> It's about time for some boba",
              "author_name": user_name,
              "author_link": `http://${team_domain}.slack.com/team/${user_id}`,
              "title": "New Boba Order!",
              "title_link": url,
              "text": "Order by clicking the url above",
              "fields": [
                  {
                      "title": "Order Closes at",
                      "value": time,
                      "short": false
                  }
              ],
              "footer": "Boba",
              "footer_icon": "https://s3.amazonaws.com/k33.me/images/boba-icon.png",
              "ts": Math.round(new Date().getTime() / 1000)
          }
      ]
  });

    await startExecution({
      stateMachineArn: process.env.TIMER_ARN,
      input: JSON.stringify({ timestamp }),
    });

    await startExecution({
      stateMachineArn: process.env.POLLER_ARN,
      input: JSON.stringify({ url, timestamp }),
    });

    return {
        statusCode: 200,
        body: "Order started, I let everyone in the channel know!",
    }

  } catch (error) {
    console.log(error);
    throw error;
  }
};


export const sendNotification = async (event, context) => {
  try {
    console.log(event);
    await sendSlackMessage({ text: event.text })
  } catch (error) {
    console.log(error);
    throw error;
  }
};
