module.exports = {
  apps: [
    {
      name: 'us-school-districts-api',
      script: 'dist/server.js',
      exec_mode: 'fork',
      max_memory_restart: '200M',  // Increased from 150M to match other services
      autorestart: true,
      watch: false,
      max_restarts: 10,  // Reduced from 50 to standard 10
      min_uptime: '20s',  // Increased to standard 20s
      restart_delay: 4000,
      exp_backoff_restart_delay: 30000,  // Added exponential backoff
      
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      env: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'error',  // Reduce disk writes by ~90%
        PORT: 3712,
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3712,
        LOG_LEVEL: 'debug',
      },
      
      kill_timeout: 5000,
      listen_timeout: 3000,
      
      cron_restart: '0 3 * * *',
      wait_ready: true,
      post_update: [
        'npm ci --omit=dev || npm install --production --ignore-scripts',
        'npm run build'
      ],
    },
  ],
};