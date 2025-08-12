module.exports = {
  apps: [
    {
      name: 'us-school-districts-api',
      script: 'dist/server.js',
      exec_mode: 'fork',
      max_memory_restart: '150M',
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '20s',
      restart_delay: 4000,
      
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      env: {
        NODE_ENV: 'production',
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
      post_update: ['npm install', 'npm run build'],
    },
  ],
};