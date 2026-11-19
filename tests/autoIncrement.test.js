const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const getAlterStatements = require('../services/getAlterStatements');

// same layout as the mysql dump used for aikido.sql: AUTO_INCREMENT is declared in a separate ALTER TABLE
const dump = ({ idType, otherType = 'int NOT NULL', autoIncrement = true }) => `--
-- Table structure for table \`fixture\`
--
CREATE TABLE \`fixture\` (
  \`id\` ${idType},
  \`other_id\` ${otherType}
) ENGINE=InnoDB;

--
-- Indexes for table \`fixture\`
--
ALTER TABLE \`fixture\`
  ADD PRIMARY KEY (\`id\`);

--
-- AUTO_INCREMENT for table \`fixture\`
--
${autoIncrement ? `ALTER TABLE \`fixture\`
  MODIFY \`id\` ${idType} AUTO_INCREMENT;` : ''}
`;

async function compare(oldSchema, newSchema) {
    const cwd = process.cwd();
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'schema-auto-increment-test-'));
    try {
        fs.mkdirSync(path.join(directory, 'output'));
        process.chdir(directory);
        return await getAlterStatements(oldSchema, newSchema);
    } finally {
        process.chdir(cwd);
        fs.rmSync(directory, { recursive: true, force: true });
    }
}

test('keeps AUTO_INCREMENT when widening an auto increment column', async () => {
    const result = await compare(
        dump({ idType: 'int NOT NULL' }),
        dump({ idType: 'bigint UNSIGNED NOT NULL' }),
    );
    assert.deepEqual(result.modifyStatements, ['ALTER TABLE `fixture` MODIFY `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT;']);
});

test('does not generate a modify when the auto increment column is unchanged', async () => {
    const result = await compare(
        dump({ idType: 'int NOT NULL' }),
        dump({ idType: 'int NOT NULL' }),
    );
    assert.deepEqual(result.modifyStatements, []);
});

test('does not add AUTO_INCREMENT to other columns that change', async () => {
    const result = await compare(
        dump({ idType: 'int NOT NULL', otherType: 'int NOT NULL' }),
        dump({ idType: 'int NOT NULL', otherType: 'bigint NOT NULL' }),
    );
    assert.deepEqual(result.modifyStatements, ['ALTER TABLE `fixture` MODIFY `other_id` bigint NOT NULL;']);
});

test('does not add AUTO_INCREMENT to a column that is not auto increment in the new schema', async () => {
    const result = await compare(
        dump({ idType: 'int NOT NULL' }),
        dump({ idType: 'bigint NOT NULL', autoIncrement: false }),
    );
    assert.deepEqual(result.modifyStatements, ['ALTER TABLE `fixture` MODIFY `id` bigint NOT NULL;']);
});

test('does not duplicate AUTO_INCREMENT already in the column definition', async () => {
    const result = await compare(
        dump({ idType: 'int NOT NULL' }),
        dump({ idType: 'bigint NOT NULL AUTO_INCREMENT', autoIncrement: false }),
    );
    assert.deepEqual(result.modifyStatements, ['ALTER TABLE `fixture` MODIFY `id` bigint NOT NULL AUTO_INCREMENT;']);
});
