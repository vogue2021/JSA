// Migration: Create schools table
// 创建学校表

exports.up = function(knex) {
  return knex.schema.createTable('schools', table => {
    table.increments('id').primary();
    table.integer('student_id').unsigned().notNullable();
    table.string('name', 200).notNullable();
    table.enum('type', ['国立', '公立', '私立']).notNullable();
    table.string('program', 200).notNullable();
    table.enum('status', ['preparing', 'contacted', 'submitted', 'admitted']).defaultTo('preparing');
    table.date('application_start_date').notNullable();
    table.date('application_end_date').notNullable();
    table.date('exam_date').notNullable();
    table.date('result_date').notNullable();
    table.string('requirements_url', 500);
    table.text('teacher_notes');
    table.json('materials');
    table.timestamps(true, true);

    // Foreign key
    table.foreign('student_id').references('id').inTable('users').onDelete('CASCADE');

    // Indexes
    table.index('student_id');
    table.index('status');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('schools');
};
