/**
 * 验证码持久化表迁移
 * 替代内存 Map 方案，解决服务重启丢失和多实例不共享问题
 */
exports.up = function (knex) {
  return knex.schema.createTable('verification_codes', function (table) {
    table.increments('id').primary();
    table.string('email', 255).notNullable();
    table.string('code', 10).notNullable();
    table.bigInteger('expires_at').notNullable();       // Unix 毫秒时间戳
    table.integer('attempts').notNullable().defaultTo(0);
    table.boolean('verified').notNullable().defaultTo(false);
    table.bigInteger('last_sent_at').nullable();        // 上次发送时间（用于频率限制）
    table.string('ip', 64).nullable();                  // 发送方 IP（用于 IP 级限流）
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('email');
    table.index('expires_at');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('verification_codes');
};
