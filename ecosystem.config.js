// PM2 进程配置 — ai-newline-center
// 文档: https://pm2.keymetrics.io/docs/usage/application-declaration/
//
// 用法:
//   pm2 start ecosystem.config.js      # 首次启动
//   pm2 restart ai-newline-center      # 重启
//   pm2 reload ai-newline-center       # 零停机重载
//   pm2 logs ai-newline-center         # 查看日志
//   pm2 monit                          # 监控面板

module.exports = {
  apps: [
    {
      name: "ai-newline-center",
      script: "server.js",
      // cwd 会在 server-setup.sh / server-update.sh 中动态写入，
      // 或者在宝塔 PM2 管理器中手动设置为: <项目目录>/.next/standalone
      cwd: process.env.APP_STANDALONE_DIR || ".next/standalone",

      instances: 1,
      exec_mode: "fork",

      env_production: {
        NODE_ENV: "production",
        PORT: process.env.PORT || 3000,
        HOSTNAME: "0.0.0.0",
      },

      // 日志
      error_file: "../../logs/pm2-error.log",
      out_file: "../../logs/pm2-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,

      // 自动重启策略
      watch: false,
      max_memory_restart: "1G",
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 10,
    },
  ],
};
