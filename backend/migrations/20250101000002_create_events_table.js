// Migration: Create events table
// 创建时间线事件表

exports.up = function(knex) {
  return knex.schema.createTable('events', table => {
    table.increments('id').primary();
    table.integer('student_id').unsigned().notNullable();
    table.integer('school_id').unsigned();
    table.enum('type', ['exam', 'deadline', 'contact', 'document']).notNullable();
    table.string('title', 200).notNullable();
    table.date('date').notNullable();
    table.integer('days_left');
    table.string('category', 100).notNullable();
    table.boolean('urgent').defaultTo(false);
    table.text('notes');
    table.boolean('completed').defaultTo(false);
    table.timestamps(true, true);

    // Foreign keys
    table.foreign('student_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('school_id').references('id').inTable('schools').onDelete('CASCADE');

    // Indexes
    table.index('student_id');
    table.index('school_id');
    table.index('date');
    table.index('urgent');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('events');
};
