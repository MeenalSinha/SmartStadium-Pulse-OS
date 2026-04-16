/**
 * PM2 Ecosystem Config — SmartStadium Pulse OS
 *
 * Usage:
 *   npm install -g pm2
 *   cd backend && npm install --production
 *   pm2 start ../ecosystem.config.js --env production
 *   pm2 save && pm2 startup     # survive reboots
 *
 * Monitor:
 *   pm2 monit
 *   pm2 logs smartstadium-backend
 */
module.exports = {
  apps: [
    {
      name:              'smartstadium-backend',
      script:            './backend/server.js',
      cwd:               __dirname,
      instances:         1,            // scale to 'max' only after adding Redis adapter
      exec_mode:         'fork',
      autorestart:       true,
      watch:             false,
      max_memory_restart: '300M',

      // Environment — development
      env: {
        NODE_ENV:  'development',
        PORT:       3001,
        LOG_LEVEL: 'info',
      },

      // Environment — production
      env_production: {
        NODE_ENV:  'production',
        PORT:       3001,
        LOG_LEVEL: 'warn',
      },

      // Structured logging to files (pino writes JSON to stdout; PM2 captures it)
      error_file:      './logs/backend-error.log',
      out_file:        './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs:      true,

      // Graceful shutdown — give server 5s to close open connections
      kill_timeout:    5000,
      listen_timeout:  10000,
    },
  ],
};
