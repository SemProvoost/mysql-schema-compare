// Stop at the ENUM's closing parenthesis, not parentheses in values or comments.
module.exports = function parseEnum(definition) {
    const start = definition.indexOf('(');
    let quoted = false;
    for (let i = start + 1; start >= 0 && i < definition.length; i++) {
        if (quoted && definition[i] === '\\') {
            i++;
        } else if (definition[i] === "'") {
            quoted = !quoted;
        } else if (!quoted && definition[i] === ')') {
            return [definition.slice(start + 1, i), definition.slice(i + 1)];
        }
    }
    throw new Error('Cannot parse ENUM');
};
