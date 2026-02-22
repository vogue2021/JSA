// Migration: Create students and teachers tables
// 创建学生表和老师表（补充缺失的迁移）

exports.up = function(knex) {
  return knex.schema
    .createTable('teachers', table => {
      table.string('teacher_id', 50).primary();
      table.integer('user_id').unsigned().notNullable()
        .references('id').inTable('users').onDelete('CASCADE');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.index('user_id');
    })
    .createTable('students', table => {
      table.string('student_id', 20).primary();
      table.integer('user_id').unsigned()
        .references('id').inTable('users').onDelete('SET NULL');
      table.string('name', 100).notNullable();
      table.string('email', 255);
      table.string('teacher_id', 50)
        .references('teacher_id').inTable('teachers').onDelete('SET NULL');
      table.boolean('has_account').defaultTo(false);
      table.string('target_country', 50).defaultTo('日本');
      table.string('target_level', 20).defaultTo('修士');
      table.integer('progress').defaultTo(0);
      table.integer('urgent_tasks').defaultTo(0);
      table.string('avatar', 10).defaultTo('👨‍🎓');
      table.string('birthday', 20);
      table.string('high_school', 200);
      table.string('language_school', 200);
      table.string('jlpt_score', 50);
      table.string('english_score', 50);
      table.text('eju_scores');
      table.text('follow_up_notes');
      table.text('photo');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.index('teacher_id');
      table.index('has_account');
    })
    .createTable('parent_emails', table => {
      table.increments('id').primary();
      table.string('student_id', 20).notNullable()
        .references('student_id').inTable('students').onDelete('CASCADE');
      table.string('email', 255).notNullable();
      table.unique(['student_id', 'email']);
    })
    .createTable('sessions', table => {
      table.string('id', 128).primary();
      table.integer('user_id').unsigned().notNullable()
        .references('id').inTable('users').onDelete('CASCADE');
      table.string('ip_address', 45);
      table.text('user_agent');
      table.text('payload');
      table.integer('last_activity').unsigned();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.index('user_id');
      table.index('last_activity');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('sessions')
    .dropTableIfExists('parent_emails')
    .dropTableIfExists('students')
    .dropTableIfExists('teachers');
};
