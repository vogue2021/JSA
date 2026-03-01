/**
 * 迁移：创建审计日志表
 * 记录所有关键写操作（POST/PUT/PATCH/DELETE）的操作人、路由、请求摘要
 */
exports.up = function (knex) {
  return knex.schema.createTable('audit_logs', (table) => {
    table.increments('id').primary();
    table.string('request_id', 36).nullable().comment('UUID，与请求日志关联');
    table.integer('user_id').nullable().comment('操作人用户ID，匿名操作为 null');
    table.string('user_name', 100).nullable().comment('操作人姓名或邮箱');
    table.string('user_role', 20).nullable().comment('操作人角色：admin/teacher/student');
    table.string('method', 10).notNullable().comment('HTTP 方法：POST/PUT/PATCH/DELETE');
    table.string('route', 500).notNullable().comment('请求路径（含 query string）');
    table.integer('status').notNullable().comment('HTTP 响应状态码');
    table.string('ip', 50).nullable().comment('客户端 IP');
    table.text('body_summary').nullable().comment('请求体摘要（已脱敏，最多 1000 字符）');
    table.timestamp('created_at').defaultTo(knex.fn.now()).comment('操作时间');

    // 索引：按用户、时间、路由快速查询
    table.index(['user_id', 'created_at'], 'idx_audit_user_time');
    table.index(['route', 'created_at'], 'idx_audit_route_time');
    table.index(['created_at'], 'idx_audit_time');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('audit_logs');
};
