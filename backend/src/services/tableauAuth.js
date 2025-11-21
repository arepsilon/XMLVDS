const axios = require('axios');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

class TableauAuthService {
  constructor() {
    this.serverUrl = process.env.TABLEAU_SERVER_URL;
    this.apiVersion = process.env.TABLEAU_API_VERSION || '3.22';
    this.patName = process.env.TABLEAU_PAT_NAME;
    this.patSecret = process.env.TABLEAU_PAT_SECRET;
    this.siteId = process.env.TABLEAU_SITE_ID || '';
    this.authToken = null;
    this.siteIdActual = null;
    this.userId = null;
    this.tokenExpiry = null;
  }

  /**
   * Sign in to Tableau Server using Personal Access Token
   * @returns {Promise<Object>} Authentication response with token
   */
  async signIn() {
    try {
      // Check if we have a valid token
      if (this.authToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
        logger.info('Using existing valid auth token');
        return {
          token: this.authToken,
          siteId: this.siteIdActual,
          userId: this.userId
        };
      }

      logger.info('Authenticating to Tableau Server with PAT');

      const signInUrl = `${this.serverUrl}/api/${this.apiVersion}/auth/signin`;

      const requestBody = {
        credentials: {
          personalAccessTokenName: this.patName,
          personalAccessTokenSecret: this.patSecret,
          site: {
            contentUrl: this.siteId
          }
        }
      };

      const response = await axios.post(signInUrl, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (response.data && response.data.credentials) {
        this.authToken = response.data.credentials.token;
        this.siteIdActual = response.data.credentials.site.id;
        this.userId = response.data.credentials.user.id;

        // Set token expiry (Tableau tokens typically expire after 240 minutes)
        this.tokenExpiry = new Date(Date.now() + 240 * 60 * 1000);

        logger.info('Successfully authenticated to Tableau Server', {
          siteId: this.siteIdActual,
          userId: this.userId
        });

        return {
          token: this.authToken,
          siteId: this.siteIdActual,
          userId: this.userId
        };
      } else {
        throw new AppError('Invalid authentication response from Tableau Server', 500);
      }
    } catch (error) {
      logger.error('Tableau authentication failed', {
        error: error.message,
        serverUrl: this.serverUrl,
        response: error.response?.data
      });

      if (error.response) {
        const errorMessage = error.response.data?.error?.summary ||
                           error.response.data?.error?.detail ||
                           'Authentication failed';
        throw new AppError(errorMessage, error.response.status);
      }

      throw new AppError('Failed to authenticate with Tableau Server', 500);
    }
  }

  /**
   * Sign out and invalidate the current auth token
   */
  async signOut() {
    try {
      if (!this.authToken) {
        logger.info('No active session to sign out');
        return;
      }

      const signOutUrl = `${this.serverUrl}/api/${this.apiVersion}/auth/signout`;

      await axios.post(signOutUrl, {}, {
        headers: {
          'X-Tableau-Auth': this.authToken
        }
      });

      this.authToken = null;
      this.siteIdActual = null;
      this.userId = null;
      this.tokenExpiry = null;

      logger.info('Successfully signed out from Tableau Server');
    } catch (error) {
      logger.error('Error during sign out', { error: error.message });
      // Still clear the token even if sign out fails
      this.authToken = null;
      this.siteIdActual = null;
      this.userId = null;
      this.tokenExpiry = null;
    }
  }

  /**
   * Get current authentication token, refreshing if necessary
   * @returns {Promise<string>} Valid authentication token
   */
  async getToken() {
    const auth = await this.signIn();
    return auth.token;
  }

  /**
   * Get current site ID
   * @returns {Promise<string>} Site ID
   */
  async getSiteId() {
    const auth = await this.signIn();
    return auth.siteId;
  }

  /**
   * Create authenticated axios instance
   * @returns {Promise<Object>} Axios instance with auth headers
   */
  async getAuthenticatedClient() {
    const token = await this.getToken();

    return axios.create({
      baseURL: `${this.serverUrl}/api/${this.apiVersion}`,
      headers: {
        'X-Tableau-Auth': token,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 60000 // 60 seconds
    });
  }
}

// Singleton instance
const tableauAuthService = new TableauAuthService();

module.exports = tableauAuthService;
