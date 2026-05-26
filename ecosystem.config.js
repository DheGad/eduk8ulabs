module.exports = {
  apps: [
    {
      name: "streetmp-os",       // ← matches: pm2 restart streetmp-os
      cwd: "./apps/web",
      script: "npm",
      args: "start",
      watch: false,
      autorestart: true,
      max_memory_restart: "1G",
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
    {
      name: "titan-kernel",
      cwd: "./apps/titan-hq",
      script: "npm",
      args: "start",
      watch: false,
      autorestart: true,
      env_production: {
        NODE_ENV: "production",
        PORT: 5000,
      },
    },
  ],
};
