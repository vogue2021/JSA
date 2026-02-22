// Migration: Create materials table
// 创建材料清单表

exports.up = function(knex) {
  return knex.schema.createTable('materials', table => {
    table.increments('id').primary();
    table.integer('student_id').unsigned().notNullable();
    table.integer('school_id').unsigned();
    table.string('item', 200).notNullable();
    table.enum('type', ['general', 'school']).notNullable();
    table.date('deadline').notNullable();
    table.string('url', 500);
    table.boolean('completed').defaultTo(false);
    table.string('checked_by', 50);
    table.date('checked_at');
    table.timestamps(true, true);

    // Foreign keys
    table.foreign('student_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('school_id').references('id').inTable('schools').onDelete('CASCADE');

    // Indexes
    table.index('student_id');
    table.index('school_id');
    table.index('type');
    table.index('completed');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('materials');
};
