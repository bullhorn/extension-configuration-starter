const chalk = require("chalk");
const logger = require('./logger');
const fetch = require('node-fetch');
/**
 * New Bullhorn Authentication Module
 * Handles OAuth flow with automatic token refresh
 */

class BullhornAuth {
  constructor(config) {
    this.config = {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      username: config.username,
      password: config.password,
      baseUrl: config.baseUrl || 'https://rest.bullhornstaffing.com'
    };
    this.session = null;
    this.logger = logger;
  }

  /**
   * Main authentication flow - gets a valid session token
   */
  async authenticate() {
    this.logger.info('=== Starting Bullhorn Authentication ===');

    try {
      // Step 0: Get loginInfo to discover OAuth and REST URLs
      const loginInfo = await this.getLoginInfo();
      const {oauthUrl, restUrl} = loginInfo;

      // Step 1: Get authorization code
      const authCode = await this.getAuthorizationCode(oauthUrl);

      // Step 2: Exchange code for access token
      const accessToken = await this.getAccessToken(oauthUrl, authCode);

      // Step 3: Get REST session token
      const sessionData = await this.getRestSession(restUrl, accessToken);

      // Store session with expiration
      this.session = {
        BhRestToken: sessionData.BhRestToken,
        restUrl: sessionData.restUrl,
        expiresAt: Date.now() + (3600 * 1000) // 1 hour from now
      };

      this.logger.info('=== Authentication Successful ===');

      return this.session;
    } catch (error) {
      this.logger.error(chalk.red('Authentication error:', error.message));
      process.exit(1);
    }
  }

  /**
   * Step 0: Get login information (OAuth and REST URLs)
   */
  async getLoginInfo() {
    const url = `${this.config.baseUrl}/rest-services/loginInfo?username=${encodeURIComponent(this.config.username)}`;

    this.logger.info('Step 0: Getting login info...');
    const response = await fetch(url);

    if (!response.ok) {
      this.logger.error(chalk.red(`LoginInfo failed: ${response.statusText}`));
      process.exit();
    }

    const data = await response.json();

    if (!data.oauthUrl || !data.restUrl) {
      this.logger.error(chalk.red('LoginInfo did not return required URLs'));
      process.exit();
    }

    this.logger.debug(`  OAuth URL: ${data.oauthUrl}`);
    this.logger.debug(`  REST URL: ${data.restUrl}`);

    return data;
  }

  /**
   * Step 1: Get authorization code via OAuth
   */
  async getAuthorizationCode(oauthUrl) {
    const url = `${oauthUrl}/authorize?` +
      `client_id=${encodeURIComponent(this.config.clientId)}` +
      `&response_type=code` +
      `&action=Login` +
      `&username=${encodeURIComponent(this.config.username)}` +
      `&password=${encodeURIComponent(this.config.password)}`;

    this.logger.info('Step 1: Getting authorization code...');

    const response = await fetch(url, {
      method: 'POST',
      redirect: 'manual' // Don't follow redirects
    });

    // Extract code from Location header
    const locationHeader = response.headers.get('location');

    if (!locationHeader || !locationHeader.includes('code=')) {
      const responseText = await response.text();
      this.logger.info(chalk.blue(`responseText : ${responseText}`));
      this.logger.error(chalk.red(`No authorization code in redirect. Location: ${locationHeader}`));
      process.exit();
    }

    // Parse and decode the authorization code
    const urlParams = new URLSearchParams(locationHeader.split('?')[1]);
    const code = urlParams.get('code');

    if (!code) {
      this.logger.error(chalk.red(`Could not extract code parameter from location header: ${locationHeader}`));
      process.exit();
    }

    this.logger.debug(`  Got authorization code (length: ${code.length})`);

    return code;
  }

  /**
   * Step 2: Exchange authorization code for access token
   */
  async getAccessToken(oauthUrl, authCode) {
    const url = `${oauthUrl}/token?` +
      `grant_type=authorization_code` +
      `&code=${encodeURIComponent(authCode)}` +
      `&client_id=${encodeURIComponent(this.config.clientId)}` +
      `&client_secret=${encodeURIComponent(this.config.clientSecret)}`;

    this.logger.info('Step 2: Exchanging code for access token...');

    const response = await fetch(url, {
      method: 'POST'
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(chalk.red(`Token exchange failed: ${response.status} ${response.statusText} - ${errorText}`));
      process.exit();
    }

    const data = await response.json();

    if (!data.access_token) {
      this.logger.error(chalk.red('No access token in response'));
      process.exit();
    }

    this.logger.debug('  Got access token');

    return data.access_token;
  }

  /**
   * Step 3: Get REST session token
   */
  async getRestSession(restUrl, accessToken) {
    const url = `${restUrl}/login?version=*&access_token=${encodeURIComponent(accessToken)}`;

    this.logger.info('Step 3: Getting REST session...');

    const response = await fetch(url, {
      method: 'GET'
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(chalk.red(`Login failed: ${response.status} ${response.statusText} - ${errorText}`));
      process.exit();
    }

    const data = await response.json();

    if (!data.BhRestToken || !data.restUrl) {
      this.logger.error(chalk.red('Invalid session data received'));
      process.exit(1);
    }

    this.logger.debug('  Got REST session token');

    return data;
  }

  /**
   * Ensure we have a valid session, refresh if needed
   */
  async ensureAuthenticated() {
    if (!this.isSessionValid()) {
      this.logger.info('Session expired or missing, re-authenticating...');
      await this.authenticate();
    }

    return this.session;
  }

  /**
   * Get current session (without refreshing)
   */
  getSession() {
    return this.session;
  }

  /**
   * Check if session is valid
   */
  isSessionValid() {
    return this.session && Date.now() < this.session.expiresAt;
  }

  /**
   * Make an authenticated API request
   */
  async makeRequest(endpoint, options = {}) {
    await this.ensureAuthenticated();

    const url = `${this.session.restUrl}${endpoint}`;
    const headers = {
      'BhRestToken': this.session.BhRestToken,
      'Content-Type': 'application/json',
      ...options.headers
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    return response;
  }
}

// Export for use in other scripts
module.exports = {
  BullhornAuth
};

