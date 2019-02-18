const request = require('request-promise-native');

export const sendSlackMessage = async (body) =>
  request.post(process.env.SLACK_WEBHOOK_URL, { json: true, body });

export const getTimeZone = async (team_domain, user_id) => {
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

