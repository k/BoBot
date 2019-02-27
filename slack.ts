import { WebClient } from "@slack/client";
import { createApp, getSlackApp } from "./dynamodb";

const clientId = process.env.SLACK_CLIENT_ID;

if (!clientId) {
  throw new Error("SLACK_CLIENT_ID env var must be defined");
}

const clientSecret = process.env.SLACK_SECRET;

if (!clientSecret) {
  throw new Error("SLACK_SECRET env var must be defined");
}
const webClientNoToken = new WebClient();

async function getToken(team_id: string) {
  const { access_token } = await getSlackApp(team_id);
  return access_token;
}

async function getBotToken(team_id: string) {
  const { bot: { bot_access_token }} = await getSlackApp(team_id);
  return bot_access_token
}

export const getTimeZone = async (team_id: string, user_id: string) => {
  const res = <any>(
    await webClientNoToken.users.info({ 
      token: await getToken(team_id),
      include_locale: true, user: user_id 
    })
  );
  return res.user.tz;
};

export const authorize = async (event) => {
  const { code } = event.queryStringParameters;
  if (typeof code != 'string') {
    throw new Error("Failed to get authorization grant from Slack")
  }
  const auth = await webClientNoToken.oauth.access({
    client_id: clientId,
    client_secret: clientSecret,
    code
  })
  await createApp(auth);
  return {
    statusCode: 200
  };
}

export const web = async (team_id: string) =>
  new WebClient(await getBotToken(team_id))