function colorString(str, colorCode) {
    if (!process.stdout.isTTY) return str;
    return '\u001b[' + colorCode + 'm' + str + '\u001b[0m';
}

const okString = colorString('✓', 92);
const failString = colorString('✖', 91);
const ignoreString = colorString('-', 93);
const dim = s => colorString(s, 2);

let totalPassed = 0;
let totalFailed = 0;
let suitePassed = 0;
let suiteFailed = 0;

export function suite(name, fn) {
    console.log(`\n  ${dim(name)}`);
    suitePassed = 0;
    suiteFailed = 0;
    fn();
    const summary = `    ${okString} ${suitePassed} passed` +
        (suiteFailed ? `  ${failString} ${suiteFailed} failed` : '');
    console.log(summary);
    totalPassed += suitePassed;
    totalFailed += suiteFailed;
}

export function test(fn, ignored = false) {
    if (ignored) {
        console.log(`    ${ignoreString} ${fn.name} (ignored)`);
        return;
    }
    try {
        fn();
        console.log(`    ${okString} ${colorString(fn.name, 32)}`);
        suitePassed++;
    } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        console.log(`    ${failString} ${colorString(fn.name, 31)}: ${msg}`);
        suiteFailed++;
    }
}

export function printTotals() {
    console.log('-------------------------------');
    if (totalFailed === 0) {
        console.log(`  ${okString} ${totalPassed} passed`);
    } else {
        console.log(`  ${okString} ${totalPassed} passed`);
        console.log(`  ${failString} ${totalFailed} failed`);
    }
    console.log('-------------------------------');
}
