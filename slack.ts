import { IncomingWebhook, WebClient } from "@slack/client";

const url = process.env.SLACK_WEBHOOK_URL;

if (!url) {
  throw new Error("SLACK_WEBHOOK_URL env var must be defined");
}

export const webhook = new IncomingWebhook(url);

const slack_token = process.env.SLACK_TOKEN;

if (!slack_token) {
  throw new Error("SLACK_TOKEN env var must be defined");
}
export const web = new WebClient(slack_token);

export const getTimeZone = async (user_id: string) => {
  const res = <any>await web.users.info({ include_locale: true, user: user_id });
  return res.user.tz;
};
