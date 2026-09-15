module.exports = {
  apps: [
    {
      name: 'onetec',
      script: 'server/index.js',
      cwd: __dirname,
      node_args: '--max-old-space-size=256',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
        JWT_SECRET: 'onetec-prod-secret-cambiar'
      },
      max_memory_restart: '200M',
      autorestart: true,
      restart_delay: 3000
    }
  ]
};