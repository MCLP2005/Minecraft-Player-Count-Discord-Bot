// Import required modules
const util = require('mc-server-utilities');
const config = require('config-yml');
const JsonFind = require('json-find');
const { Client, GatewayIntentBits, ActivityType, Events } = require('discord.js');

// Validate and load configuration
function validateConfig() {
  const token = process.env.DISCORD_BOT_TOKEN || config.token;
  
  if (!token || typeof token !== 'string' || token.trim() === '') {
    throw new Error('Discord bot token is required');
  }
  
  if (!config.ip || typeof config.ip !== 'string' || config.ip.trim() === '') {
    throw new Error('Server IP is required in configuration');
  }
  
  if (!config.name || typeof config.name !== 'string' || config.name.trim() === '') {
    throw new Error('Server name is required in configuration');
  }
  
  // Sanitize debug flag allowing common truthy values
  const debugValue = config.debug;
  const debugEnabled = debugValue === 1 || debugValue === true ||
    (typeof debugValue === 'string' && ['1', 'true', 'yes', 'on'].includes(debugValue.trim().toLowerCase()));
  config.debug = debugEnabled ? 1 : 0;

  // Sanitize refresh interval (seconds)
  const defaultInterval = 30;
  if (config['refresh-interval'] !== undefined) {
    const intervalSec = parseInt(config['refresh-interval'], 10);
    if (isNaN(intervalSec) || intervalSec <= 0) {
      throw new Error('refresh-interval must be a positive integer (seconds)');
    }
    config.refreshInterval = intervalSec;
  } else {
    config.refreshInterval = defaultInterval;
  }

  return token;
}

// Load token from environment variable if available, otherwise from config
const BOT_TOKEN = validateConfig();

// Safely sanitize strings to prevent potential injection
function sanitizeString(str) {
  if (!str) return '';
  return String(str).replace(/[<>"'&]/g, char => {
    switch (char) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      case '&': return '&amp;';
      default: return char;
    }
  });
}

// Validate IP address format with enhanced security checks
function isValidIpOrDomain(input) {
  if (!input || typeof input !== 'string') return false;
  
  const trimmedInput = input.trim();
  if (trimmedInput.length === 0 || trimmedInput.length > 253) return false;
  
  // Check for dangerous characters
  if (/[<>"'&\s;|`$(){}[\]\\]/.test(trimmedInput)) return false;
  
  // Split into host and port parts
  const parts = trimmedInput.split(':');
  if (parts.length > 2) return false;

  const host = parts[0];
  const port = parts[1];

  if (host.toLowerCase() === 'localhost') {
    return true;
  }
  
  // Validate port if present
  if (port !== undefined) {
    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) return false;
  }
  
  // IPv4 pattern with strict validation
  const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const ipv4Match = host.match(ipv4Pattern);
  if (ipv4Match) {
    // Validate each octet is 0-255
    for (let i = 1; i <= 4; i++) {
      const octet = parseInt(ipv4Match[i], 10);
      if (octet < 0 || octet > 255) return false;
    }
    return true;
  }
  
  // Domain name pattern with stricter validation
  const domainPattern = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
  if (domainPattern.test(host)) {
    // Additional checks for domain names
    const labels = host.split('.');
    if (labels.length < 2) return false;
    
    // Check each label length
    for (const label of labels) {
      if (label.length === 0 || label.length > 63) return false;
      if (label.startsWith('-') || label.endsWith('-')) return false;
    }
    
    // Check TLD is at least 2 characters and only letters
    const tld = labels[labels.length - 1];
    if (!/^[a-zA-Z]{2,}$/.test(tld)) return false;
    
    return true;
  }
  
  return false;
}

// Debug function that only logs messages when debug is enabled
// Limits sensitive information exposure
function debugLog(...messages) {
  if (config.debug === 1) {
    // Filter out potentially sensitive data
    const safeMessages = messages.map(msg => {
      if (typeof msg === 'object') {
        const safeObj = {...msg};
        // Redact potential sensitive fields
        if (safeObj.token) safeObj.token = '***REDACTED***';
        if (safeObj.password) safeObj.password = '***REDACTED***';
        if (safeObj.id) safeObj.id = '***REDACTED***';
        if (safeObj.key) safeObj.key = '***REDACTED***';
        if (safeObj.secret) safeObj.secret = '***REDACTED***';
        return safeObj;
      } else if (typeof msg === 'string') {
        // Attempt to redact tokens or keys in strings
        return msg.replace(/([\w-]*token[\w-]*["']?\s*[:=]\s*["']?)([\w.-]+)/gi, '$1***REDACTED***')
                 .replace(/([\w-]*key[\w-]*["']?\s*[:=]\s*["']?)([\w.-]+)/gi, '$1***REDACTED***')
                 .replace(/([\w-]*password[\w-]*["']?\s*[:=]\s*["']?)([\w.-]+)/gi, '$1***REDACTED***')
                 .replace(/([\w-]*secret[\w-]*["']?\s*[:=]\s*["']?)([\w.-]+)/gi, '$1***REDACTED***');
      }
      return msg;
    });
    
    // Add timestamp to debug logs
    const timestamp = new Date().toISOString();
    console.log(`[DEBUG ${timestamp}]`, ...safeMessages);
  }
}

// Process termination handlers with safe client access
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error.message);
  // Safe shutdown - check if client exists and is ready
  if (typeof client !== 'undefined' && client && client.readyAt) {
    client.destroy();
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at promise:', reason?.message || reason);
  // Continue running but log the issue
});

process.on('SIGINT', () => {
  console.log('Received SIGINT. Gracefully shutting down...');
  if (typeof client !== 'undefined' && client && client.readyAt) {
    client.destroy();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Gracefully shutting down...');
  if (typeof client !== 'undefined' && client && client.readyAt) {
    client.destroy();
  }
  process.exit(0);
});

// Creating discord client with proper intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, // Using proper GatewayIntentBits instead of strings
    GatewayIntentBits.GuildPresences
  ]
});

// Set up error handlers for the client
client.on('error', error => {
	console.error('Discord client error:', error.message);
});

client.on('warn', warning => {
	console.warn('Discord client warning:', warning);
});

// Log in to Discord using the token from environment or config
debugLog('Attempting to log in');
client.login(BOT_TOKEN).catch(error => {
	console.error('Failed to login to Discord:', error.message);
	process.exit(1); // Exit if we can't connect to Discord
});

// Event listener for when the bot is ready (uses renamed clientReady event)
client.once(Events.ClientReady, () => {
	// Log a message to the console indicating the bot is logged in
	console.log(`Logged in as ${client.user.tag}!`);
	
	// When in debug mode, only log minimal information
	debugLog('Client is ready', {
		username: client.user.username,
		guildsCount: client.guilds.cache.size // Only log count, not detailed information
	});
	
	// Start periodic presence updates once the bot is ready
	scheduleUpdates();
});

// Track failed attempts to implement rate limiting
let failedAttempts = 0;
const MAX_RETRY_ATTEMPTS = 5;
const RETRY_COOLDOWN = 60000; // 1 minute in milliseconds

// Rate limiting for Discord presence updates
let lastPresenceUpdate = 0;
const PRESENCE_UPDATE_COOLDOWN = 15000; // 15 seconds minimum between updates
let lastActivityText = '';
const PRESENCE_REFRESH_THRESHOLD = 45000; // 45 seconds before refreshing same presence to avoid disappearance

function updatePresenceSafely(activityText, status = 'online') {
  const now = Date.now();
  
  // Skip update if too soon or same activity until refresh threshold
  if ((now - lastPresenceUpdate) < PRESENCE_UPDATE_COOLDOWN ||
      (activityText === lastActivityText && (now - lastPresenceUpdate) < PRESENCE_REFRESH_THRESHOLD)) {
    return;
  }
  
  try {
    if (!client || !client.user || !client.readyAt) {
      debugLog('Client not ready, skipping presence update');
      return;
    }

    const presenceOperation = client.user.setPresence({
      activities: [{
        name: activityText,
        type: ActivityType.Watching,
      }],
      status: status,
    });

    if (presenceOperation && typeof presenceOperation.then === 'function') {
      presenceOperation
        .then(() => {
          lastPresenceUpdate = now;
          lastActivityText = activityText;
          debugLog('Presence updated successfully');
        })
        .catch((presenceError) => {
          console.error('Failed to update presence:', presenceError.message);
        });
    } else {
      lastPresenceUpdate = now;
      lastActivityText = activityText;
      debugLog('Presence updated successfully');
    }
  } catch (presenceError) {
    console.error('Failed to update presence:', presenceError.message);
  }
}

// Function to query server status and update Discord presence
function updateServerStatus() {
  debugLog('Running scheduled job to update server status');

  // Validate server IP before using it
  const serverIp = config.ip;
  if (!isValidIpOrDomain(serverIp)) {
    console.error('Invalid server IP or domain format in configuration');
    return;
  }

  debugLog('Querying Minecraft server at', serverIp);

  const statusPromise = util.status(serverIp);
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Server status request timeout')), 10000);
  });

  Promise.race([statusPromise, timeoutPromise])
    .then((response) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (!response || typeof response !== 'object') {
        throw new Error('Server returned an unexpected response');
      }
      failedAttempts = 0;
      const query = JsonFind(response);
      const players = JsonFind(query.checkKey('players') || {});
      const onlinePlayers = players.checkKey('online') || 0;
      const maxPlayers = players.checkKey('max') || 0;

      if (config.debug === 1) {
        debugLog('Server response received with', onlinePlayers, 'players online');
        debugLog('Players data:', {
          online: onlinePlayers,
          max: maxPlayers,
          sampleCount: query.checkKey('players.sample') && Array.isArray(query.checkKey('players.sample'))
            ? query.checkKey('players.sample').length : 'No player sample available'
        });
      }

      const validOnline = Number.isInteger(onlinePlayers) && onlinePlayers >= 0 ? onlinePlayers : 0;
      const validMax = Number.isInteger(maxPlayers) && maxPlayers >= 0 ? maxPlayers : 0;
      const sanitizedServerName = sanitizeString(config.name);
      const basePresence = `Watching ${validOnline} of ${validMax} players on ${sanitizedServerName}`;
      const activity = basePresence.length > 120 ? `${basePresence.slice(0, 117)}...` : basePresence;
      debugLog('Setting presence to:', activity);
      updatePresenceSafely(activity, 'online');
    })
    .catch((error) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      failedAttempts++;
      console.error(`Error getting server status (attempt ${failedAttempts}/${MAX_RETRY_ATTEMPTS}):`, error.message);
      debugLog('Error occurred while getting server status:', error.message);

      const errorBase = `Unable to connect to ${sanitizeString(config.name)}`;
      const errorMessage = errorBase.length > 120 ? `${errorBase.slice(0, 117)}...` : errorBase;
      updatePresenceSafely(errorMessage, 'dnd');

      if (failedAttempts >= MAX_RETRY_ATTEMPTS) {
        console.warn(`Too many failed attempts (${failedAttempts}). Pausing updates for ${RETRY_COOLDOWN/1000} seconds.`);
        if (scheduler) {
          clearInterval(scheduler);
          scheduler = null;
        }
        setTimeout(() => {
          console.log('Resuming server status updates after cooldown');
          failedAttempts = 0;
          scheduleUpdates();
        }, RETRY_COOLDOWN);
      }
    });
}

// Scheduler control
let scheduler = null;
function scheduleUpdates() {
  if (scheduler) {
    clearInterval(scheduler);
    scheduler = null;
  }
  updateServerStatus();
  scheduler = setInterval(updateServerStatus, config.refreshInterval * 1000);
}

