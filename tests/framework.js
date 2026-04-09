function colorString(str, colorCode) {
    if (!process.stdout.isTTY) return str;
    return '\u001b[' + colorCode + 'm' + str + '\u001b[0m';
}

const okString = colorString('✓', 92);
const failString = colorString('✖', 91);
const ignoreString = colorString('-', 93);

export function test(testableFunc, ignored = false) {
    if (ignored) {
        console.log(ignoreString + ' ' + testableFunc.name + ' (ignored)');
        return;
    }
    const result = testableFunc();
    console.log((result ? okString : failString) + ' ' + colorString(testableFunc.name, result ? 32 : 31));
}
