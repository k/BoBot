import { DateTime } from "luxon";
import * as queryString from "query-string";
import { StepFunctions } from "aws-sdk";
import { webhook, getTimeZone } from "./slack";

const poller_arn = process.env.POLLER_ARN;
if (!poller_arn) {
  throw new Error("POLLER_ARN env var must be set");
}

const stepfunctions = new StepFunctions();

export const startBoba = async (event, context) => {
  try {
    console.log(event);
    const { text, user_id, user_name, team_domain, channel_id } = queryString.parse(
      event.body
    );
    if (
      typeof text !== "string" ||
      typeof user_id !== "string" ||
      typeof user_name !== "string" ||
      typeof team_domain !== "string"
    ) {
      throw new Error("Error from slack");
    }
    const args = text.split(" ");
    const url = args[0];
    const message = args.splice(1).join(' ');
    const fields: { title: string, value: string, short?: boolean }[] = []
    if (message.length > 0) {
      fields.push({
          title: "Message from host",
          value: message,
          short: false
      });
    }
    console.log(url);

    await webhook.send({
      attachments: [
        {
          fallback: `New Boba Order started by ${user_name}! Order here: ${url}`,
          color: "#36a64f",
          pretext: "<!channel> It's about time for some boba",
          author_name: user_name,
          author_link: `http://${team_domain}.slack.com/team/${user_id}`,
          title: "New Boba Order!",
          title_link: url,
          text: "Order by clicking the url above",
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
        slack_team_domain: team_domain,
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
