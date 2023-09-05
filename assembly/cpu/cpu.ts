import { Alu } from "./alu";
import { CpuOps } from "./cpuOps";
import { disassembleInstruction, getMnemonicName, getOperandTargetName } from "../debug/disassemble";
import { Interrupt } from "./interrupts";
import { Logger } from "../debug/logger";
import { MemoryMap } from "../memory/memoryMap";
import { Op, OpTarget, Operand, prefixedOpCodes, unprefixedOpCodes } from "./opcodes";
import { uToHex } from "../utils/stringUtils";

export enum Flag {
    Z_Zero = 0b10000000,
    N_Sub = 0b01000000,
    H_HalfC = 0b00100000,
    C_Carry = 0b00010000,
}

function log(s: string): void {
    Logger.Log("CPU: " + s);
}

@final
export class Cpu {
    static AF: u16 = 0;
    static BC: u16 = 0;
    static DE: u16 = 0;
    static HL: u16 = 0;

    static StackPointer: u16 = 0;
    static ProgramCounter: u16 = 0x0000;

    static PCbeingRan: u16 = 0x0000; // for debug purposes, changed on new instruction being red

    static CycleCount: u32 = 0;

    static isHalted: boolean = false;
    static isStopped: boolean = false;
    static failedLastCondition: boolean = false;
    static isEnablingIME: boolean = false;

    @inline static A(): u8 { return <u8>(Cpu.AF >> 8) };
    @inline static F(): u8 { return <u8>(Cpu.AF & 0xFF) };
    @inline static B(): u8 { return <u8>(Cpu.BC >> 8) };
    @inline static C(): u8 { return <u8>(Cpu.BC & 0xFF) };
    @inline static D(): u8 { return <u8>(Cpu.DE >> 8) };
    @inline static E(): u8 { return <u8>(Cpu.DE & 0xFF) };
    @inline static H(): u8 { return <u8>(Cpu.HL >> 8) };
    @inline static L(): u8 { return <u8>(Cpu.HL & 0xFF) };

    @inline static SetA(value: u8): void { Cpu.AF = (Cpu.AF & 0x00FF) | <u16>value << 8; }
    @inline static SetF(value: u8): void { Cpu.AF = (Cpu.AF & 0xFF00) | <u16>value; }
    @inline static SetB(value: u8): void { Cpu.BC = (Cpu.BC & 0x00FF) | <u16>value << 8; }
    @inline static SetC(value: u8): void { Cpu.BC = (Cpu.BC & 0xFF00) | <u16>value; }
    @inline static SetD(value: u8): void { Cpu.DE = (Cpu.DE & 0x00FF) | <u16>value << 8; }
    @inline static SetE(value: u8): void { Cpu.DE = (Cpu.DE & 0xFF00) | <u16>value; }
    @inline static SetH(value: u8): void { Cpu.HL = (Cpu.HL & 0x00FF) | <u16>value << 8; }
    @inline static SetL(value: u8): void { Cpu.HL = (Cpu.HL & 0xFF00) | <u16>value; }

    @inline static HasFlag(f: Flag): boolean { return (Cpu.F() & <u8>f) != 0 };

    static SetFlag(f: Flag, enabled: bool = 1): void {
        Cpu.SetF(enabled ? <u8>(Cpu.F() | <u8>f) : <u8>(Cpu.F() & <u8>(~f)));
    }

    static Init(useBootRom: boolean = true): void {
        if (Logger.verbose >= 1)
            log('Initialized CPU, using boot : ' + useBootRom.toString());
        Cpu.AF = 0x01B0;
        Cpu.BC = 0x0013;
        Cpu.DE = 0x00D8;
        Cpu.HL = 0x014D;
        Cpu.StackPointer = 0xFFFE;
        Cpu.ProgramCounter = useBootRom ? 0x00 : 0x100;

        Cpu.isHalted = false;
        Cpu.isStopped = false;
        Cpu.failedLastCondition = false;
        Cpu.CycleCount = 0;
        Cpu.isEnablingIME = false;

        Interrupt.Init();
    }

    static Tick(): u8 {
        const wasHalted = Cpu.isHalted;
        const t_cycles: u8 = wasHalted ? 4 : Cpu.executeNextInstruction();
        Cpu.CycleCount += t_cycles;

        if (wasHalted && Interrupt.Requests() != 0) {
            Cpu.isHalted = false;
        }

        if (Interrupt.masterEnabled) {
            if (Interrupt.HandleInterrupts())
                Cpu.CycleCount += 20;
            Cpu.isEnablingIME = false;
        }

        if (Cpu.isEnablingIME) {
            if (Logger.verbose >= 2)
                log('Enabling IME after request');
            Interrupt.masterEnabled = true;
        }

        return t_cycles;
    }

    static GetStack(): string {
        let stack = "";
        for (let sp = Cpu.StackPointer; sp > 0xFF80 && sp < 0xFFFD; sp += 2) {
            const pc: u16 = MemoryMap.GBload<u16>(sp)
            stack += "\t\t" + uToHex(pc) + '\t' + disassembleInstruction(MemoryMap.GBToMemory(pc));
        }
        return stack == "" ? "(empty stack)" : stack;
    }

    static GetTrace(): string {

        return '-> ' + uToHex(Cpu.PCbeingRan) + '\t' + disassembleInstruction(MemoryMap.GBToMemory(Cpu.PCbeingRan)) + '\n' + Cpu.GetStack();
    }

    static executeNextInstruction(): u8 {
        // store PC as instructions might change it
        const originalPc: u16 = Cpu.ProgramCounter;
        Cpu.PCbeingRan = Cpu.ProgramCounter;
        let numCycles: u8 = 0;

        let opCode: u8 = MemoryMap.GBload<u8>(originalPc);
        let instr = unprefixedOpCodes[opCode];
        let totalInstructionSize: u8 = instr.byteSize;
        if (instr.mnemonic == Op.PREFIX) {
            numCycles += instr.cycleCounts[0];
            totalInstructionSize++;
            opCode = MemoryMap.GBload<u8>(originalPc + 1);
            instr = prefixedOpCodes[opCode];
        }

        // TODO  opCode != 0 -> log 2
        if (Logger.verbose >= (opCode == 0 ? 3 : 2))
            log('executing ' + uToHex<u16>(originalPc) + '\t' + disassembleInstruction(MemoryMap.GBToMemory(originalPc)));

        const nextPc: u16 = originalPc + totalInstructionSize;

        Cpu.ProgramCounter = nextPc;

        Cpu.failedLastCondition = false;

        switch (instr.mnemonic) {
            case Op.NOP:
                break;
            case Op.DI:
                Interrupt.masterEnabled = false;
                break;
            case Op.EI:
                Cpu.isEnablingIME = true; // don't enable IME right away, wait one loop
                break;
            case Op.CALL:
                CpuOps.CallOp(instr, originalPc, nextPc);
                break;
            case Op.RETI:
                Cpu.isEnablingIME = true;
            // FALLTHROUGH
            case Op.RET:
                CpuOps.RetOp(instr);
                break;
            case Op.JR:
                CpuOps.JrOp(instr, originalPc);
                break;
            case Op.JP:
                CpuOps.JpOp(instr, originalPc);
                break;
            case Op.PUSH:
                Cpu.PushToSP(Cpu.get16bitRegisterValue(instr.operands[0].target));
                break;
            case Op.POP:
                Cpu.Set16bitValue(0x00, instr.operands[0], Cpu.PopSP());
                break;
            case Op.ILLEGAL:
                if (Logger.verbose >= 3)
                    log('ILLEGAL instruction encountered: 0x' + opCode.toString(16));
                break;
            case Op.LD:
                CpuOps.LdOp(opCode, instr, originalPc);
                break;
            case Op.LDH:
                CpuOps.LdhOp(instr.operands[0], instr.operands[1], originalPc);
                break;
            case Op.RST:
                CpuOps.RstOp(instr.operands[0]);
                break;
            case Op.HALT:
                Cpu.isHalted = true;
                if (Logger.verbose >= 2)
                    log("CPU Halt");
                break;
            case Op.STOP:
                Cpu.isStopped = true;
                if (Logger.verbose >= 1)
                    log("CPU STOPPED");
                break;
            case Op.ADD:
                Alu.AddOp(instr, originalPc);
                break;
            case Op.ADC:
                Alu.AdcOp(instr.operands[1], originalPc);
                break;
            case Op.SUB:
                Alu.SubOp(instr, originalPc);
                break;
            case Op.SBC:
                Alu.SbcOp(instr.operands[1], originalPc);
                break;
            case Op.XOR:
                Alu.XorOp(instr, originalPc);
                break;
            case Op.OR:
                Alu.OrOp(instr, originalPc);
                break;
            case Op.AND:
                Alu.AndOp(instr, originalPc);
                break;
            case Op.BIT:
                Alu.BitOp(instr.operands[0].value, instr.operands[1]);
                break;
            case Op.SWAP:
                Alu.SwapOp(instr.operands[0]);
                break;
            case Op.SCF:
                Alu.ScfOp();
                break;
            case Op.RES:
                Alu.ResOp(instr.operands[0].value, instr.operands[1]);
                break;
            case Op.SET:
                Alu.SetOp(instr.operands[0].value, instr.operands[1]);
                break;
            case Op.INC:
                Alu.IncOp(instr);
                break;
            case Op.DEC:
                Alu.DecOp(instr);
                break;
            case Op.CP:
                Alu.CpOp(instr.operands[1], originalPc);
                break;
            case Op.RL:
                Alu.RlOp(instr.operands[0]);
                break;
            case Op.SRL:
                Alu.SrlOp(instr.operands[0]);
                break;
            case Op.SRA:
                Alu.SraOp(instr.operands[0]);
                break;
            case Op.SLA:
                Alu.SlaOp(instr.operands[0]);
                break;
            case Op.CCF:
                Alu.CcfOp();
                break;
            case Op.CPL:
                Alu.CplOp();
                break;
            case Op.DAA:
                Alu.DaaOp();
                break;
            case Op.RLCA:
                Alu.RlcaOp();
                break;
            case Op.RLC:
                Alu.RlcOp(instr.operands[0]);
                break;
            case Op.RRC:
                Alu.RrcOp(instr.operands[0]);
                break;
            case Op.RRCA:
                Alu.RrcaOp();
                break;
            case Op.RR:
                Alu.RrOp(instr.operands[0]);
                break;
            case Op.RRA:
                Alu.RraOp();
                break;
            case Op.RLA:
                Alu.RlaOp();
                break;
            case Op.PREFIX:
            default:
                assert(false, 'UNHANDLED INSTRUCTION: ' + getMnemonicName(instr.mnemonic));
                break;
        }

        numCycles += instr.cycleCounts[Cpu.failedLastCondition ? 1 : 0];
        Cpu.failedLastCondition = false;
        return numCycles;
    }

    static PushToSP(address: u16): void {
        Cpu.StackPointer -= 2;
        MemoryMap.GBstore<u16>(Cpu.StackPointer, address);
    }

    static PopSP(): u16 {
        Cpu.StackPointer += 2;
        return MemoryMap.GBload<u16>(Cpu.StackPointer - 2);
    }

    static get8bitSourceValue(gbAddress: u16, op: Operand): u8 {
        if (!op.immediate) {
            const address = Cpu.get16bitValue(gbAddress, op);
            if (op.increment)
                Cpu.Set16bitValue(gbAddress, op, address + 1);
            else if (op.decrement)
                Cpu.Set16bitValue(gbAddress, op, address - 1);
            return MemoryMap.GBload<u8>(address);
        }
        switch (op.target) {
            case OpTarget.Constant:
                return op.value;
            case OpTarget.Value:
                return MemoryMap.GBload<u8>(gbAddress);
            default:
                return Cpu.get8bitRegisterValue(op.target);
        }
    }

    static get8bitRegisterValue(register: OpTarget): u8 {
        switch (register) {
            case OpTarget.A:
                return Cpu.A();
            case OpTarget.B:
                return Cpu.B();
            case OpTarget.C:
                return Cpu.C();
            case OpTarget.D:
                return Cpu.D();
            case OpTarget.E:
                return Cpu.E();
            case OpTarget.H:
                return Cpu.H();
            case OpTarget.L:
                return Cpu.L();
            default:
                assert(false, 'Unknown 8bit register: ' + getOperandTargetName(register) + '\n' + Cpu.GetTrace());
        }
        return 0;
    }

    static set8bitRegisterValue(register: OpTarget, value: u8): void {
        switch (register) {
            case OpTarget.A:
                Cpu.SetA(value);
                break;
            case OpTarget.B:
                Cpu.SetB(value);
                break;
            case OpTarget.C:
                Cpu.SetC(value);
                break;
            case OpTarget.D:
                Cpu.SetD(value);
                break;
            case OpTarget.E:
                Cpu.SetE(value);
                break;
            case OpTarget.H:
                Cpu.SetH(value);
                break;
            case OpTarget.L:
                Cpu.SetL(value);
                break;
            default:
                assert(false, 'Unknown 8bit register: ' + getOperandTargetName(register) + '\n' + Cpu.GetTrace());
        }
    }

    static set8bitTargetValue(gbAddress: u16, targetOp: Operand, value: u8): void {
        if (!targetOp.immediate) {
            const address: u16 = Cpu.get16bitValue(gbAddress, targetOp);
            if (Logger.verbose >= 3)
                log(`${getOperandTargetName(targetOp.target)} = 0x${address.toString(16)}` + '\n' + `[${getOperandTargetName(targetOp.target)}] = 0x${value.toString(16)}`);
            MemoryMap.GBstore<u8>(address, value);
            if (targetOp.increment)
                Cpu.Set16bitValue(gbAddress, targetOp, address + 1);
            else if (targetOp.decrement)
                Cpu.Set16bitValue(gbAddress, targetOp, address - 1);
            return;
        }
        Cpu.set8bitRegisterValue(targetOp.target, value);
    }

    static get16bitValue(gbAddress: u16, op: Operand): u16 {
        if (op.target == OpTarget.Value) {
            if (op.byteSize == 1)
                return MemoryMap.toHiRam(MemoryMap.GBload<u8>(gbAddress));
            return MemoryMap.GBload<u16>(gbAddress);
        }
        switch (op.target) {
            case OpTarget.A:
            case OpTarget.B:
            case OpTarget.C:
            case OpTarget.D:
            case OpTarget.E:
            case OpTarget.H:
            case OpTarget.L:
                // special case like 0xE2 - LD [C], A - equivalent to LD [$FF00+C], A
                return 0xFF00 + <u16>Cpu.get8bitRegisterValue(op.target);
        }
        return Cpu.get16bitRegisterValue(op.target);
    }

    static get16bitRegisterValue(register: OpTarget): u16 {
        switch (register) {
            case OpTarget.AF:
                return Cpu.AF;
            case OpTarget.BC:
                return Cpu.BC;
            case OpTarget.DE:
                return Cpu.DE;
            case OpTarget.HL:
                return Cpu.HL;
            case OpTarget.SP:
                return Cpu.StackPointer;
            default:
                assert(false, 'Unknown 16bit register: ' + getOperandTargetName(register) + '\n' + Cpu.GetTrace());
        }
        return 0;
    }

    static Set16bitValue(gbAddress: u16, targetOp: Operand, value: u16): void {
        switch (targetOp.target) {
            case OpTarget.AF:
                Cpu.AF = value & 0xFFF0; // 4 lower F flags are always 0
                break;
            case OpTarget.BC:
                Cpu.BC = value;
                break;
            case OpTarget.DE:
                Cpu.DE = value;
                break;
            case OpTarget.HL:
                Cpu.HL = value;
                break;
            case OpTarget.SP:
                Cpu.StackPointer = value;
                break;
            case OpTarget.Value:
                const address = MemoryMap.GBload<u16>(gbAddress);
                MemoryMap.GBstore<u16>(address, value);
                break;
            default:
                assert(false, 'Unknown 16bit register: ' + getOperandTargetName(targetOp.target) + '\n' + Cpu.GetTrace());
        }
    }
}
