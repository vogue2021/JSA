/**
 * 反馈记录表迁移
 * 将用户反馈持久化到数据库，替代纯 localStorage 方案
 */
exports.up = function (knex) {
  return knex.schema.createTable('feedbacks', function (table) {
    table.increments('id').primary();
    table.string('type', 50).notNullable().defaultTo('suggestion'); // suggestion / bug / other
    table.text('content').notNullable();
    table.string('contact', 255).nullable();       // 用户留下的联系方式（可选）
    table.string('user_name', 100).nullable();     // 提交时的用户名
    table.string('user_id', 100).nullable();       // 提交时的用户ID（可为匿名）
    table.string('status', 50).notNullable().defaultTo('pending'); // pending / reviewed / resolved
    table.text('admin_note').nullable();           // 管理员备注
    table.timestamps(true, true);                  // created_at / updated_at
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('feedbacks');
};
