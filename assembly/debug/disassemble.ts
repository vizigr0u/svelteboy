import { BOOT_ROM_START, CARTRIDGE_ROM_START } from "../cpu/memoryConstants";
import { MemoryMap } from "../cpu/memoryMap";
import { Op, OpTarget, OpCondition, Operand, Instruction, unprefixedOpCodes, prefixedOpCodes, getTotalInstructionSize } from "../cpu/opcodes";
import { opNames, targetNames, conditionNames } from "../debug/symbols";

@final
export class ProgramLine {
    pc: u16 = 0;
    opCode: u8 = 0;
    byteSize: u8 = 0;
    cycleCounts: u8[] = [];
    prefixed: boolean = false;
    op: string = "NOP";
    parameters: string[] = [];
}

function hexdump(romAddress: u32, offset: u32, length: u32): string {
    const maxOffset: u32 = offset + length;
    // return `offset ${offset}->${maxOffset} => ${offset + romAddress} -> ${offset + romAddress + length}`;
    let result = "";
    while (offset < maxOffset) {
        result += "0x" + offset.toString(16) + "\t";
        let opCode: u8 = load<u8>(romAddress + offset);
        result += "0x" + opCode.toString(16) + "\n";
        offset++;
    }
    return result;
}

export function getMnemonicName(mnemonic: Op): string {
    return opNames.has(mnemonic) ? opNames.get(mnemonic) : "?";
}

export function getOperandTargetName(op: OpTarget): string {
    return targetNames.has(op) ? targetNames.get(op) : "?";
}

export function getConditionName(condition: OpCondition): string {
    return conditionNames.has(condition) ? conditionNames.get(condition) : "?";
}

function getValueString(op: Operand, globalAddress: u32): string {
    if (op.signed)
        return op.byteSize == 1 ? load<i8>(globalAddress).toString(16).padStart(2, '0') : load<i16>(globalAddress).toString(16).padStart(4, '0');
    return op.byteSize == 1 ? load<u8>(globalAddress).toString(16).padStart(2, '0') : load<u16>(globalAddress).toString(16).padStart(4, '0');
}

export function operandToString(op: Operand, globalAddress: u32): string {
    let result: string = op.immediate ? "" : "[";
    switch (op.target) {
        case OpTarget.Value:
            result += "$" + getValueString(op, globalAddress);
            break;
        case OpTarget.Constant:
            result += op.value.toString(16);
            break;
        case OpTarget.Condition:
            result += getConditionName(op.value);
            break;
        default:
            result += getOperandTargetName(op.target);
    }
    if (op.decrement)
        result += "-";
    else if (op.increment)
        result += "+";
    return op.immediate ? result : result + ']';
}

export function disassembleInstruction(globalAddress: u32): string {
    let opCode: u8 = load<u8>(globalAddress);
    let instr: Instruction = unprefixedOpCodes[opCode];
    if (opCode == 0xCB) {
        globalAddress++;
        opCode = load<u8>(globalAddress);
        instr = prefixedOpCodes[opCode];
    }
    if (instr.operands.length == 0)
        return getMnemonicName(instr.mnemonic);
    let result = getMnemonicName(instr.mnemonic) + "\t";
    for (let i = 0; i < instr.operands.length; i++) {
        const op = instr.operands[i];
        result += operandToString(op, globalAddress + 1);
        if (i < instr.operands.length - 1)
            result += ", ";
    }
    return result;
}

export function getDisassemble(gbAddress: u16): ProgramLine {
    const pc: u16 = gbAddress;
    let opCode: u8 = MemoryMap.GBload<u8>(gbAddress);
    let instr: Instruction = unprefixedOpCodes[opCode];
    let byteSize = instr.byteSize;
    const cycleCounts: u8[] = instr.cycleCounts.map<u8>(v => v);
    let prefixed: boolean = false;
    if (opCode == 0xCB) {
        gbAddress++;
        opCode = MemoryMap.GBload<u8>(gbAddress);
        instr = prefixedOpCodes[opCode];
        prefixed = true;
        byteSize = 2;
    }
    const op = getMnemonicName(instr.mnemonic);
    const parameters: string[] = [];
    for (let i = 0; i < instr.operands.length; i++) {
        const op = instr.operands[i];
        parameters.push(operandToString(op, MemoryMap.GBToMemory(gbAddress + 1)));
    }
    return {
        pc, opCode, byteSize, cycleCounts, prefixed, op, parameters
    };
}

function getDisassembleLines(PC: u16, maxPC: u16): Array<ProgramLine> {
    //const count: u16 = <u16>(0xFFFF - gbAddress) >= maxCount ? maxCount : 0xFFFF - gbAddress;
    const result: Array<ProgramLine> = new Array<ProgramLine>();
    while (PC <= maxPC && (<u16>0xFFFF - PC) >= getTotalInstructionSize(load<u8>(PC))) {
        let line = getDisassemble(PC);
        result.push(line);
        PC += line.byteSize;
    }
    return result;
}

export function getBootLines(gbAddress: u16, maxPC: u16): Array<ProgramLine> {
    const oldUseBoot = MemoryMap.useBootRom;
    MemoryMap.useBootRom = true;
    const res = getDisassembleLines(gbAddress, maxPC);
    MemoryMap.useBootRom = oldUseBoot;
    return res;
}

export function getCartLines(gbAddress: u16, maxPC: u16): Array<ProgramLine> {
    const oldUseBoot = MemoryMap.useBootRom;
    MemoryMap.useBootRom = false;
    const res = getDisassembleLines(gbAddress, maxPC);
    MemoryMap.useBootRom = oldUseBoot;
    return res;
}

export function disassembleArray(array: Array<u8>): string {
    return disassemble(<u32>array.dataStart, 0, array.length);
}

function disassemble(romAddress: u32, offset: u32, length: u32): string {
    const maxOffset: u32 = offset + length;
    // console.log(`offset ${offset}->${maxOffset} => ${offset + romAddress} -> ${offset + romAddress + length}`);
    let result = "";
    while (offset < maxOffset) {
        const op = load<u8>(romAddress + offset);
        result += "0x" + offset.toString(16) + "\t";
        const instructionSize = getTotalInstructionSize(op);
        if (offset + instructionSize > maxOffset + 1) {
            result += "!ERR: missing bytes";
            break;
        }
        result += disassembleInstruction(romAddress + offset) + "\n";
        offset += instructionSize;
    }
    return result;
}

function dumpSafe(actualStart: u32, wantedOffset: u32, wantedLength: u32, actualLength: u32): string {
    wantedOffset = wantedOffset >= actualLength ? 0 : wantedOffset;
    wantedLength = (wantedLength == 0 || (wantedLength + wantedOffset > actualLength)) ? actualLength - wantedOffset : wantedLength;
    // return `${actualStart} + ${safeOffset} for ${safeLength}`;
    return hexdump(actualStart, wantedOffset, wantedLength);
}

function disassembleSafe(actualStart: u32, wantedOffset: u32, wantedLength: u32, actualLength: u32): string {
    wantedOffset = wantedOffset >= actualLength ? 0 : wantedOffset;
    wantedLength = (wantedLength == 0 || (wantedLength + wantedOffset > actualLength)) ? actualLength - wantedOffset : wantedLength;
    return disassemble(actualStart, wantedOffset, wantedLength);
}

export function disassembleBoot(wantedOffset: u32, wantedLength: u32): string {
    // return dumpSafe(BOOT_ROM_START, wantedOffset, wantedLength, bootRomSize);
    return disassembleSafe(BOOT_ROM_START, wantedOffset, wantedLength, MemoryMap.loadedBootRomSize);
    // return disassembleMax(BOOT_ROM_START + start, bootRomSize, maxLength);
}

export function disassembleCartridge(wantedOffset: u32, wantedLength: u32): string {
    return disassembleSafe(CARTRIDGE_ROM_START, wantedOffset, wantedLength, MemoryMap.loadedCartridgeRomSize);
}
