import { Cpu, Flag } from "./cpu";
import { getOperandTargetName, getConditionName } from "../debug/disassemble";
import { MemoryMap } from "../memory/memoryMap";
import { Operand, Instruction, OpTarget, OpCondition } from "./opcodes";
import { uToHex } from "../utils/stringUtils";
import { Logger } from "../debug/logger";

function log(s: string): void {
    Logger.Log("CPU: " + s);
}

function checkAndStoreCondition(cond: OpCondition): boolean {
    Cpu.failedLastCondition = !isConditionFullfilled(cond);
    if (Logger.verbose >= 3)
        log('Last condition check: ' + (!Cpu.failedLastCondition).toString());
    return Cpu.failedLastCondition;
}

function isConditionFullfilled(cond: OpCondition): boolean {
    switch (cond) {
        case OpCondition.Carry:
            return Cpu.HasFlag(Flag.C_Carry);
        case OpCondition.NonCarry:
            return !Cpu.HasFlag(Flag.C_Carry);
        case OpCondition.Zero:
            return Cpu.HasFlag(Flag.Z_Zero);
        case OpCondition.NonZero:
            return !Cpu.HasFlag(Flag.Z_Zero);
        default:
            assert(false, 'Unexpected condition flag: ' + getConditionName(cond) + '\n' + Cpu.GetTrace());
    }
    return false;
}

@final
export class CpuOps {
    static RstOp(source: Operand): void {
        Cpu.PushToSP(Cpu.ProgramCounter);
        Cpu.ProgramCounter = Cpu.get8bitSourceValue(0x00, source);
    }

    static JpOp(instr: Instruction, originalPc: u16): void {
        const hasCondition = instr.operands.length == 2;
        const sourceOp = instr.operands[hasCondition ? 1 : 0];
        if (hasCondition) {
            assert(instr.operands[0].target == OpTarget.Condition, 'unexpected condition target: ' + getOperandTargetName(instr.operands[0].target) + '\n' + Cpu.GetTrace());
            checkAndStoreCondition(<OpCondition>(instr.operands[0].value));
        }
        if (!Cpu.failedLastCondition) {
            const address = Cpu.get16bitValue(originalPc + 1, sourceOp);
            Cpu.ProgramCounter = address;
        }
    }

    static JrOp(instr: Instruction, originalPc: u16): void {
        const hasCondition = instr.operands.length == 2;
        const sourceOp = instr.operands[hasCondition ? 1 : 0];
        if (hasCondition) {
            assert(instr.operands[0].target == OpTarget.Condition);
            checkAndStoreCondition(<OpCondition>(instr.operands[0].value));
        }
        if (!Cpu.failedLastCondition) {
            const change: i8 = <i8>Cpu.get8bitSourceValue(originalPc + 1, sourceOp);
            if (change == -2) {
                if (Logger.verbose >= 1)
                    log("JR -2, infinite loop detected at " + uToHex(originalPc) + ", Halting.");
                Cpu.isHalted = true;
            }
            Cpu.ProgramCounter += change;
        }
    }

    static CallOp(instr: Instruction, originalPc: u16, nextPc: u16): void {
        const hasCondition = instr.operands.length == 2;
        const targetOp = instr.operands[hasCondition ? 1 : 0];
        if (hasCondition) {
            assert(instr.operands[0].target == OpTarget.Condition, 'unexpected condition target: ' + getOperandTargetName(instr.operands[0].target) + '\n' + Cpu.GetTrace());
            checkAndStoreCondition(<OpCondition>(instr.operands[0].value));
        }
        if (!Cpu.failedLastCondition) {
            const address = Cpu.get16bitValue(originalPc + 1, targetOp);
            Cpu.ProgramCounter = address;
            Cpu.PushToSP(nextPc);
        }
    }

    static RetOp(instr: Instruction): void {
        const hasCondition = instr.operands.length == 1;
        if (hasCondition) {
            assert(instr.operands[0].target == OpTarget.Condition, 'unexpected condition target: ' + getOperandTargetName(instr.operands[0].target) + '\n' + Cpu.GetTrace());
            checkAndStoreCondition(<OpCondition>(instr.operands[0].value));
        }
        if (!Cpu.failedLastCondition) {
            Cpu.ProgramCounter = Cpu.PopSP();
        }
    }

    static LdhOp(targetOp: Operand, sourceOp: Operand, originalPc: u16): void {
        if (targetOp.target == OpTarget.A) {
            const address = Cpu.get16bitValue(originalPc + 1, sourceOp);
            const value = MemoryMap.GBload<u8>(address);
            Cpu.SetA(value);
        } else {
            const address = Cpu.get16bitValue(originalPc + 1, targetOp);
            MemoryMap.GBstore<u8>(address, Cpu.A());
        }
    }

    static LdOp(opCode: u8, instr: Instruction, originalPc: u16): void {
        if (opCode == 0xF8) { // LD HL, SP + e8
            const value: i16 = <i16>MemoryMap.GBload<i8>(originalPc + 1);
            const signedSP = <i16>Cpu.StackPointer;
            Cpu.HL = <u16>(signedSP + value);

            // Flags 0 0 H C
            Cpu.SetF(0);
            Cpu.SetFlag(Flag.H_HalfC, ((signedSP & 0xF) + (value & 0xF)) >= 0x10);
            Cpu.SetFlag(Flag.C_Carry, ((signedSP & 0xFF) + (value & 0xFF)) >= 0x100);
            return;
        }
        const targetOp = instr.operands[0];
        const sourceOp = instr.operands[1];
        // 16bit LD
        if (opCode == 0x08 || opCode == 0xF9
            || sourceOp.immediate && sourceOp.target == OpTarget.Value && sourceOp.byteSize == 2) {
            const sourceValue = Cpu.get16bitValue(originalPc + 1, sourceOp);
            Cpu.Set16bitValue(originalPc + 1, targetOp, sourceValue);
            return;
        }
        // 8bit LD
        const sourceValue = Cpu.get8bitSourceValue(originalPc + 1, sourceOp);
        Cpu.set8bitTargetValue(originalPc + 1, targetOp, sourceValue);
    }
}