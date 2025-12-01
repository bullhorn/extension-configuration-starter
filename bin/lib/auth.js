const chalk = require('chalk');
const fetch = require('node-fetch');
const logger = require('./logger');

const DEFAULT_BASE_URL = 'https://rest.bullhornstaffing.com';
const SESSION_EXPIRY_MS = 3600000;

class BullhornAuth {
  constructor(_config) {
    this.config = {
      clientId: _config.clientId,
      clientSecret: _config.clientSecret,
      username: _config.username,
      password: _config.password,
      baseUrl: _config.baseUrl || DEFAULT_BASE_URL,
    };
    this.session = null;
    this.logger = logger;
  }

  async authenticate() {
    this.logger.info('=== Starting Bullhorn Authentication ===');

    const loginInfo = await this.getLoginInfo();
    if (!loginInfo) {
      return null;
    }

    const { oauthUrl, restUrl } = loginInfo;

    const authCode = await this.getAuthorizationCode(oauthUrl);
    if (!authCode) {
      return null;
    }

    const accessToken = await this.getAccessToken(oauthUrl, authCode);
    if (!accessToken) {
      return null;
    }

    const sessionData = await this.getRestSession(restUrl, accessToken);
    if (!sessionData) {
      return null;
    }

    this.session = {
      BhRestToken: sessionData.BhRestToken,
      restUrl: sessionData.restUrl,
      expiresAt: Date.now() + SESSION_EXPIRY_MS,
    };

    this.logger.info('=== Authentication Successful ===');

    return this.session;
  }

  async getLoginInfo() {
    const url = `${this.config.baseUrl}/rest-services/loginInfo?username=${encodeURIComponent(this.config.username)}`;

    this.logger.info('Step 0: Getting login info...');
    const response = await fetch(url);

    if (!response.ok) {
      this.logger.error(chalk.red(`LoginInfo failed: ${response.statusText}`));
      return null;
    }

    const data = await response.json();

    if (!data.oauthUrl || !data.restUrl) {
      this.logger.error(chalk.red('LoginInfo did not return required URLs'));
      return null;
    }

    this.logger.debug(`  OAuth URL: ${data.oauthUrl}`);
    this.logger.debug(`  REST URL: ${data.restUrl}`);

    return data;
  }

  async getAuthorizationCode(oauthUrl) {
    const url = `${oauthUrl}/authorize?`
      + `client_id=${encodeURIComponent(this.config.clientId)}`
      + '&response_type=code'
      + '&action=Login'
      + `&username=${encodeURIComponent(this.config.username)}`
      + `&password=${encodeURIComponent(this.config.password)}`;

    this.logger.info('Step 1: Getting authorization code...');

    const response = await fetch(url, {
      method: 'POST',
      redirect: 'manual',
    });

    const locationHeader = response.headers.get('location');

    if (!locationHeader || !locationHeader.includes('code=')) {
      this.logger.error(chalk.red(`No authorization code in redirect. Location: ${locationHeader}`));
      return null;
    }

    const urlParams = new URLSearchParams(locationHeader.split('?')[1]);
    const code = urlParams.get('code');

    if (!code) {
      this.logger.error(chalk.red(`Could not extract code parameter from location header: ${locationHeader}`));
      return null;
    }

    this.logger.debug(`  Got authorization code (length: ${code.length})`);

    return code;
  }

  async getAccessToken(oauthUrl, authCode) {
    const url = `${oauthUrl}/token?`
      + 'grant_type=authorization_code'
      + `&code=${encodeURIComponent(authCode)}`
      + `&client_id=${encodeURIComponent(this.config.clientId)}`
      + `&client_secret=${encodeURIComponent(this.config.clientSecret)}`;

    this.logger.info('Step 2: Exchanging code for access token...');

    const response = await fetch(url, {
      method: 'POST',
    });

    if (!response.ok) {
      const errorText = await response.text();
      const singleLineError = errorText
        .replace(/[\r\n]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      this.logger.error(chalk.red(`Token exchange failed: ${response.status} ${response.statusText} - ${singleLineError}`));
      return null;
    }

    const data = await response.json();

    if (!data.access_token) {
      this.logger.error(chalk.red('No access token in response'));
      return null;
    }

    this.logger.debug('  Got access token');

    return data.access_token;
  }

  async getRestSession(restUrl, accessToken) {
    const url = `${restUrl}/login?version=*&access_token=${encodeURIComponent(accessToken)}`;

    this.logger.info('Step 3: Getting REST session...');

    const response = await fetch(url, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorText = await response.text();
      const singleLineError = errorText
        .replace(/[\r\n]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      this.logger.error(chalk.red(`Login failed: ${response.status} ${response.statusText} - ${singleLineError}`));
      return null;
    }

    const data = await response.json();

    if (!data.BhRestToken || !data.restUrl) {
      this.logger.error(chalk.red('Invalid session data received'));
      return null;
    }

    this.logger.debug('  Got REST session token');

    return data;
  }

  async ensureAuthenticated() {
    if (!this.isSessionValid()) {
      this.logger.info('Session expired or missing, re-authenticating...');
      await this.authenticate();
    }

    return this.session;
  }

  getSession() {
    return this.session;
  }

  isSessionValid() {
    return this.session && Date.now() < this.session.expiresAt;
  }

  async makeRequest(endpoint, options = {}) {
    await this.ensureAuthenticated();

    const url = `${this.session.restUrl}${endpoint}`;
    const headers = {
      'BhRestToken': this.session.BhRestToken,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    return response;
  }
}

module.exports = {
  BullhornAuth,
};
