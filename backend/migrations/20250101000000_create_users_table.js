// Migration: Create users table
// 创建用户表

exports.up = function(knex) {
  return knex.schema.createTable('users', table => {
    table.increments('id').primary();
    table.string('email', 100).notNullable().unique();
    table.string('password', 255).notNullable();
    table.enum('role', ['student', 'teacher', 'admin']).notNullable();
    table.string('name', 100).notNullable();
    table.string('student_id', 50).unique();
    table.string('teacher_id', 50).unique();
    table.boolean('is_active').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('email');
    table.index('role');
    table.index('student_id');
    table.index('teacher_id');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('users');
};
