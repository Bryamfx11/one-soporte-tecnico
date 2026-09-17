module.exports = {
  apps: [
    {
      name: 'onetec',
      script: 'server/index.js',
      cwd: __dirname,
      node_args: '--max-old-space-size=256',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 4000,
        JWT_SECRET: process.env.JWT_SECRET || '',
        ADMIN_EMAIL: process.env.ADMIN_EMAIL || '',
        ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '',
        ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:4000'
      },
      max_memory_restart: '200M',
      autorestart: true,
      restart_delay: 3000
    }
  ]
};