// Import required modules
const util = require('mc-server-utilities');
const config = require('config-yml');
const schedule = require('node-schedule');
const JsonFind = require('json-find');
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');

// Load token from environment variable if available, otherwise from config
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || config.token;

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

// Validate IP address format
function isValidIpOrDomain(input) {
  // IPv4 pattern
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}(:\d{1,5})?$/;
  // Domain name pattern
  const domainPattern = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(:\d{1,5})?$/;
  
  return ipv4Pattern.test(input) || domainPattern.test(input);
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

// Process termination handlers
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Safe shutdown
  client.destroy();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Continue running but log the issue
});

process.on('SIGINT', () => {
  console.log('Received SIGINT. Gracefully shutting down...');
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Gracefully shutting down...');
  client.destroy();
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

// Event listener for when the bot is ready
client.on('ready', () => {
	// Log a message to the console indicating the bot is logged in
	console.log(`Logged in as ${client.user.tag}!`);
	
	// When in debug mode, only log minimal information
	debugLog('Client is ready', {
		username: client.user.username,
		guildsCount: client.guilds.cache.size // Only log count, not detailed information
	});
});

// Track failed attempts to implement rate limiting
let failedAttempts = 0;
const MAX_RETRY_ATTEMPTS = 5;
const RETRY_COOLDOWN = 60000; // 1 minute in milliseconds

// Schedule a job to run every 30 seconds (increased from 15 to reduce polling frequency)
const job = schedule.scheduleJob('*/30 * * * * *', function(){
	debugLog('Running scheduled job to update server status');
	
	// Validate server IP before using it
	const serverIp = config.ip;
	if (!isValidIpOrDomain(serverIp)) {
		console.error('Invalid server IP or domain format in configuration');
		return;
	}
	
	debugLog('Querying Minecraft server at', serverIp);
	
	// Get the status of the Minecraft server using the IP address from the config file
	util.status(serverIp)
		// If the status request is successful
		.then((response) => {
			// Reset failed attempts counter on success
			failedAttempts = 0;
			
			// Use JsonFind to safely access data from the response
			const query = JsonFind(response);
			const players = JsonFind(query.checkKey('players') || {});
			
			// Get player counts, defaulting to 0 if data is missing
			const onlinePlayers = players.checkKey('online') || 0;
			const maxPlayers = players.checkKey('max') || 0;
			
			if (config.debug === 1) {
				// Only log essential information in debug mode
				debugLog('Server response received with', onlinePlayers, 'players online');
				debugLog('Players data:', {
					online: onlinePlayers,
					max: maxPlayers,
					// Don't expose player names in debug logs
					sampleCount: query.checkKey('players.sample') ? 
						(Array.isArray(query.checkKey('players.sample')) ? 
						query.checkKey('players.sample').length : 0) : 
						'No player sample available'
				});
			}
			
			// Create a string to display the current player count and server name with sanitized inputs
			const sanitizedServerName = sanitizeString(config.name);
			let active = `Watching ${onlinePlayers} of ${maxPlayers} players on ${sanitizedServerName}`;
			debugLog('Setting presence to:', active);
			
			// Set the bot's presence using the updated setPresence method
			try {
				client.user.setPresence({
					activities: [{
						name: active,
						type: ActivityType.Watching,
					}],
					status: 'online',
				});
				debugLog('Presence updated successfully');
			} catch (presenceError) {
				console.error('Failed to update presence:', presenceError.message);
			}
		})
		.catch((error) => {
			// Increment failed attempts for rate limiting
			failedAttempts++;
			
			// If there is an error, log it to the console with more detailed info
			console.error(`Error getting server status (attempt ${failedAttempts}/${MAX_RETRY_ATTEMPTS}):`, error.message);
			debugLog('Error occurred while getting server status:', error.message);
			
			// Set presence to show error state
			try {
				client.user.setPresence({
					activities: [{
						name: `Unable to connect to ${sanitizeString(config.name)}`,
						type: ActivityType.Watching,
					}],
					status: 'dnd', // Red status to indicate error
				});
			} catch (presenceError) {
				console.error('Failed to update error presence:', presenceError.message);
			}
			
			// If too many failed attempts, pause the job temporarily
			if (failedAttempts >= MAX_RETRY_ATTEMPTS) {
				console.warn(`Too many failed attempts (${failedAttempts}). Pausing updates for ${RETRY_COOLDOWN/1000} seconds.`);
				job.cancel();
				
				// Restart the job after cooldown
				setTimeout(() => {
					console.log('Resuming server status updates after cooldown');
					failedAttempts = 0;
					job.reschedule('*/30 * * * * *');
				}, RETRY_COOLDOWN);
			}
		});
});
