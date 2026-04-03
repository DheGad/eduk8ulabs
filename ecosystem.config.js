module.exports = {
  apps: [
    {
      name: "streetmp-web",
      cwd: "./apps/web",
      script: "npm",
      args: "start",
      watch: false,
      autorestart: true,
      env_production: {
        NODE_ENV: "production",
        PORT: 3000
      }
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
        PORT: 5000
      }
    }
  ]
};
