const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const parseEnum = require('../services/parseEnum');
const getAlterStatements = require('../services/getAlterStatements');

test('separates enum values from comments containing parentheses', () => {
    assert.deepEqual(parseEnum("enum('unknown','issue_resolved') NOT NULL DEFAULT 'unknown' COMMENT 'closed (by Aikido)'"), [
        "'unknown','issue_resolved'",
        " NOT NULL DEFAULT 'unknown' COMMENT 'closed (by Aikido)'",
    ]);
});

test('does not stop at a parenthesis inside a quoted enum value', () => {
    assert.deepEqual(parseEnum("enum('a(b)','other') DEFAULT 'a(b)'"), ["'a(b)','other'", " DEFAULT 'a(b)'"]);
});

test('generates a comment change while preserving the existing enum union behavior', async () => {
    const cwd = process.cwd();
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'schema-enum-test-'));
    const schema = definition => `CREATE TABLE \`fixture\` (\n  \`reason\` ${definition}\n) ENGINE=InnoDB;\n`;
    try {
        fs.mkdirSync(path.join(directory, 'output'));
        process.chdir(directory);
        const result = await getAlterStatements(
            schema("enum('unknown','old') NOT NULL DEFAULT 'unknown'"),
            schema("enum('unknown','new') NOT NULL DEFAULT 'unknown' COMMENT 'closed (by user)'"),
        );
        assert.deepEqual(result.modifyStatements, ["ALTER TABLE `fixture` MODIFY `reason` ENUM('unknown','old','new') NOT NULL DEFAULT 'unknown' COMMENT 'closed (by user)';"]);
    } finally {
        process.chdir(cwd);
        fs.rmSync(directory, { recursive: true, force: true });
    }
});
