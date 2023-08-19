import { testCall } from './callTests';
import { testAdd } from './addTests';
import { testBit } from './bitTests';
import { testDec } from './decTests';
import { testInc } from './incTests';
import { testLD } from './ldTests';
import { testRes } from './resTests';
import { testSet } from './setTests';
import { testSub } from './subTests';
import { testXor } from './xorTests';
import { testRet } from './retTests';
import { testCp } from './cpTests';
import { testJr } from './jrTests';
import { testPush } from './pushTests';
import { testPop } from './popTests';
import { MemoryMap } from '../../memoryMap';
import { Cpu } from '../../cpu';
import { testRl } from './rlTests';
import { testRr } from './rrTests';

export function SetHLDeref(value: u8): void {
    MemoryMap.GBstore(0x42, value);
    Cpu.HL = 0x42;
}

export function HLDeref(): u16 {
    return MemoryMap.GBload<u8>(Cpu.HL);
}

export function ClearHLDerefTest(): void {
    MemoryMap.GBstore(0x42, 0);
}

export function testInstructions(): boolean {
    testAdd();
    testSub();
    testXor();
    testBit();
    testSet();
    testRes();
    testInc();
    testDec();
    testLD();
    testCall();
    testRet();
    testCp();
    testJr();
    testPush();
    testPop();
    testRl();
    testRr();
    return true;
}
