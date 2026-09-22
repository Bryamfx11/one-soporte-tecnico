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
        // JWT_SECRET, ADMIN_EMAIL y ADMIN_PASSWORD se cargan de server/.env (server/env.js)
        // Incluir el origen https del dominio para peticiones directas desde el navegador
        ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:4000',
        // Caddy/nginx en la misma mǭquina: loopback es suficiente para ver IPs reales
        TRUST_PROXY: process.env.TRUST_PROXY || 'loopback',
        // Backup automǭtico diario (hora en 24h, zona del servidor). NODE_ENV=production ya lo activa.
        AUTO_BACKUP_HOUR: process.env.AUTO_BACKUP_HOUR || '3'
      },
      max_memory_restart: '200M',
      autorestart: true,
      restart_delay: 3000,
      instances: 1,
      time: true
    }
  ]
};