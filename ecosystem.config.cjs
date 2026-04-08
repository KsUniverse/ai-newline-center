// ecosystem.config.cjs
// PM2 进程管理配置 — 服务器端使用
// 由 scripts/server/start.sh 自动调用，无需手动执行
//
// PM2 常用命令:
//   pm2 status                      查看状态
//   pm2 logs ai-newline-center       查看日志
//   pm2 restart ai-newline-center    重启
//   pm2 stop ai-newline-center       停止
//   pm2 startup                      设置开机自启（首次运行后执行）

"use strict";

module.exports = {
  apps: [
    {
      name: "ai-newline-center",
      script: "server.js",

      // 单实例 fork 模式
      // (应用内含 BullMQ Worker + node-cron 定时任务，不能多实例)
      instances: 1,
      exec_mode: "fork",

      // 崩溃自动重启
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      restart_delay: 3000,

      // 内存超过 1.5GB 时自动重启
      max_memory_restart: "1500M",

      // 生产环境基础变量
      // 注意: DATABASE_URL 等业务变量由 start.sh 从 .env.production 注入
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        HOSTNAME: "0.0.0.0", // 监听所有网卡，允许外部访问
      },

      // 日志配置
      out_file: "./logs/app.log",
      error_file: "./logs/error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,
    },
  ],
};
