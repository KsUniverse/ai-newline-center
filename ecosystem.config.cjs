// ecosystem.config.cjs
// PM2 进程管理配置 — 宝塔源码部署使用
// 适用于: 在服务器执行 pnpm install && pnpm build 后，由 PM2 / 宝塔启动
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
      cwd: __dirname,
      script: "./node_modules/next/dist/bin/next",
      args: "start -H 0.0.0.0 -p 3000",
      interpreter: "node",

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
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        HOSTNAME: "0.0.0.0",
      },

      // 日志配置
      out_file: "./logs/app.log",
      error_file: "./logs/error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,
    },
  ],
};
