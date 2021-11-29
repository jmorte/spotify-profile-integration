'use strict';
const express = require('express');
const path = require('path');
const serverless = require('serverless-http');
const app = express();

const cors = require('cors');
const cookieParser = require('cookie-parser');
const request = require('request');

const { CLIENT_ID } = process.env;
const { CLIENT_SECRET } = process.env;
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:8888/api/spotify/callback';

const router = express.Router();

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} T he generated string
 */
 const generateRandomString = function(length) {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

const stateKey = 'spotify_auth_state';

app.use(cors())
  .use(cookieParser());

app.use('/api/spotify', router);

router.get('/login', (req, res) => {
  const state = generateRandomString(16);
  res.cookie(stateKey, state);

  const scope = 'user-read-private user-read-email';

  let queryParams = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: scope,
    redirect_uri: REDIRECT_URI,
    state: state
  });

  res.redirect('https://accounts.spotify.com/authorize?' + queryParams.toString());
});

router.get('/callback', (req, res) => {
  const code = req.query.code || null;
  const state = req.query.state || null;
  const storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    const queryParams = new URLSearchParams({
      error: 'state_mismatch'
    });

    res.redirect('/#' + queryParams.toString());
  } else {
    res.clearCookie(stateKey);
    const authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': `Basic ${new Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString(
          'base64',
        )}`
      },
      json: true
    };

    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        const access_token = body.access_token;
        const refresh_token = body.refresh_token;
        
        const queryParams = new URLSearchParams({
          access_token: access_token,
          refresh_token: refresh_token
        });

        res.redirect('/#' + queryParams.toString());
      } else {
        const queryParams = new URLSearchParams({
          error: 'invalid_token'
        });
        res.redirect('/#' + queryParams.toString());
      }
    });
  }
});


app.get('/refresh_token', function (req, res) {
  const refresh_token = req.query.refresh_token;
  const authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: {
      Authorization: `Basic ${new Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString(
        'base64',
      )}`,
    },
    form: {
      grant_type: 'refresh_token',
      refresh_token,
    },
    json: true,
  };

  request.post(authOptions, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      const access_token = body.access_token;
      res.send({ access_token });
    }
  });
});

module.exports = app;
module.exports.handler = serverless(app);