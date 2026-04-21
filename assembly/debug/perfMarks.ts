// @ts-ignore: decorator
@external("env", "perfNow")
@external.js(`return performance.now();`)
export declare function perfNow(): f64;
