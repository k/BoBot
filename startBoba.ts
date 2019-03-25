import { DateTime } from "luxon";
import * as queryString from "query-string";
import { StepFunctions } from "aws-sdk";
import { web } from "./slack";

const poller_arn = process.env.POLLER_ARN;
if (!poller_arn) {
  throw new Error("POLLER_ARN env var must be set");
}

const stepfunctions = new StepFunctions();

export const startBoba = async (event, context) => {
  try {
    console.log(event);
    const { text, user_id, user_name, team_domain, channel_id, team_id } = queryString.parse(
      event.body
    );
    if (
      typeof text !== "string" ||
      typeof user_id !== "string" ||
      typeof channel_id !== "string" ||
      typeof user_name !== "string" ||
      typeof team_domain !== "string" ||
      typeof team_id !== "string"
    ) {
      throw new Error("Error from slack");
    }
    const args = text.split(" ");
    const url = args[0];
    const message = args.splice(1).join(' ');
    const fields: { title: string, value: string, short?: boolean }[] = []
    if (message.length > 0) {
      fields.push({
          title: message,
          value: '',
          short: false
      });
    }
    console.log(url);
    const slack = await web(team_id)
    await slack.chat.postMessage({
      text: '',
      channel: channel_id,
      attachments: [
        {
          fallback: `New Boba Order started by ${user_name}! Order here: ${url}`,
          color: "#36a64f",
          pretext: `<!channel> New Boba Order started by ${user_name}!`,
          author_name: user_name,
          author_link: `http://${team_domain}.slack.com/team/${user_id}`,
          title: "Click here to order!",
          title_link: url,
          fields,
          footer: "Boba",
          footer_icon: "https://s3.amazonaws.com/k33.me/images/boba-icon.png",
          ts: `${Math.round(new Date().getTime() / 1000)}`
        }
      ]
    });

    await stepfunctions.startExecution({
      stateMachineArn: poller_arn,
      input: JSON.stringify({ 
        url,
        timestamp: DateTime.local().toISO(),
        slack_team_id: team_id,
        slack_channel_id: channel_id,
        vendor: vendorFromUrl(url),
      })
    }).promise();

    return {
      statusCode: 200,
      body: "Order started, I let everyone in the channel know!"
    };
  } catch (error) {
    console.log(error);
    throw error;
  }
};

function vendorFromUrl(url) {
  return "doordash";
}
