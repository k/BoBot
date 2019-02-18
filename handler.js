'use strict';

const request = require('request-promise-native');
const { DateTime } = require('luxon');
const queryString = require('query-string');
const AWS = require('aws-sdk');
const stepfunctions = new AWS.StepFunctions();

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

const sendSlackMessage = async (body) =>
  request.post(process.env.SLACK_WEBHOOK_URL, { json: true, body });

const getTimeZone = async (team_domain, user_id) => {

  const options = { 
    method: 'GET',
    url: `https://${team_domain}.slack.com/api/users.info`,
    qs: { 
      token: process.env.SLACK_TOKEN,
      user: user_id,
      include_locale: 'true' 
    },
  };

  return request(options).then(JSON.parse).then(r => r.user.tz);
}

export const startBoba = async (event, context) => {
  try {
    console.log(event)
    const { text, user_id, user_name, team_domain } = queryString.parse(event.body);
    const args = text.split(' ');
    const link = args[0];
    const time = args[1];
    const zone = await getTimeZone(team_domain, user_id);
    const timestamp = DateTime.fromFormat(time, "h:mma", { zone }).toISO()
    const message = args.splice(2)

    await sendSlackMessage({
      "attachments": [
          {
              "fallback": `New Boba Order started by ${user_name}! Order here: ${link}`,
              "color": "#36a64f",
              "pretext": "@channel It's about time for some boba",
              "author_name": user_name,
              "author_link": `http://${team_domain}.slack.com/team/${user_id}`,
              "title": "New Boba Order!",
              "title_link": link,
              "text": "Order by clicking the link above",
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
      input: JSON.stringify({ link }),
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

export const checkLink = async (event, context) => {
    console.log(event)
    const link = event.link;
    if (Math.random() > 0.5) {
      return { link, didCheckout: 1 }
    }
    return { link, didCheckout: 0 }
}


export const sendNotification = async (event, context) => {
  try {
    console.log(event);
    await sendSlackMessage({ text: event.text })
  } catch (error) {
    console.log(error);
    throw error;
  }
};
