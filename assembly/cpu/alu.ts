import { Cpu, Flag } from "./cpu";
import { Instruction, OpTarget, Operand } from "./opcodes";

function isAddCarry8bit(a: u8, b: u8): boolean {
    return (b > (0xFF - a));
}

function isAddCarry16bit(a: u16, b: u16): boolean {
    return b > (0xFFFF - a);
}

function isAddHalfCarry8bit(a: u8, b: u8): boolean {
    return ((((a & 0xf) + (b & 0xf)) & 0x10) == 0x10);
}

function isAddHalfCarry16bit(a: u16, b: u16): boolean {
    return isAddHalfCarry8bit(<u8>(a >> 8), <u8>(b >> 8));
}

function rr(value: u8): u8 {
    const bit0isSet: boolean = (value & 1) == 1;
    value = (value >> 1) | (Cpu.HasFlag(Flag.C_Carry) ? 0x80 : 0);
    // Flags 0 0 0 C for RRA - Z 0 0 C for RR r
    Cpu.SetF(0);
    Cpu.SetFlag(Flag.C_Carry, bit0isSet);
    return value;
}

function rrc(value: u8): u8 {
    value = (value >> 1) | (value << 7);
    // Flags 0 0 0 C for RRCA - Z 0 0 C for RRC r
    Cpu.SetF(0);
    Cpu.SetFlag(Flag.C_Carry, (value >> 7) == 1);
    return value;
}

function rl(value: u8): u8 {
    const bit7isSet: boolean = (value & 0x80) == 0x80;
    value = (value << 1) | (Cpu.HasFlag(Flag.C_Carry) ? 1 : 0);
    // Flags 0 0 0 C for RLA - Z 0 0 C for RL r
    Cpu.SetF(0);
    Cpu.SetFlag(Flag.C_Carry, bit7isSet);
    return value;
}

function rlc(value: u8): u8 {
    value = (value << 1) | (value >> 7);
    // Flags 0 0 0 C for RLCA - Z 0 0 C for RLC r
    Cpu.SetF(0);
    Cpu.SetFlag(Flag.C_Carry, (value & 1) == 1);
    return value;
}

@final
export class Alu {
    static DaaOp(): void {
        const a = Cpu.A();
        const hasNFlag = Cpu.HasFlag(Flag.N_Sub);
        let add: u8 = 0;
        let carry: boolean = false;

        if (Cpu.HasFlag(Flag.H_HalfC) || (!hasNFlag && (a & 0xF) > 9)) {
            add = 6;
        }

        if (Cpu.HasFlag(Flag.C_Carry) || (!hasNFlag && a > 0x99)) {
            add = add | 0x60;
            carry = true;
        }

        Cpu.SetA(a + (hasNFlag ? -add : add));

        //  Then the four most significant bits are checked. If this more significant digit also happens to be greater than 9 or the C flag is set, then $60 is added.
        // Flags Z - 0 C
        Cpu.SetFlag(Flag.Z_Zero, Cpu.A() == 0);
        Cpu.SetFlag(Flag.H_HalfC, 0);
        Cpu.SetFlag(Flag.C_Carry, carry);
    }

    static SwapOp(target: Operand): void {
        let value: u8 = Cpu.get8bitSourceValue(0x00, target);
        value = ((value & 0xF) << 4) | ((value & 0xF0) >> 4);
        // Flags Z 0 0 0
        Cpu.SetF(0);
        Cpu.SetFlag(Flag.Z_Zero, value == 0);
        Cpu.set8bitTargetValue(0x00, target, value);
    }

    static SbcOp(source: Operand, originalPc: u16): void {
        const a = Cpu.A();
        const b: u8 = Cpu.get8bitSourceValue(originalPc + 1, source);
        const c: u8 = Cpu.HasFlag(Flag.C_Carry) ? 1 : 0;
        Cpu.SetA(a - b - c);
        // Flags: Z1HC
        Cpu.SetFlag(Flag.Z_Zero, Cpu.A() == 0);
        Cpu.SetFlag(Flag.N_Sub);
        Cpu.SetFlag(Flag.H_HalfC, <i8>(a & 0xf) - <i8>(b & 0xf) - <i8>c < 0);
        Cpu.SetFlag(Flag.C_Carry, <i16>a - <i16>b - <i16>c < 0);

    }

    static AdcOp(source: Operand, originalPc: u16): void {
        const a = Cpu.A();
        const b: u8 = Cpu.get8bitSourceValue(originalPc + 1, source);
        const c: u8 = Cpu.HasFlag(Flag.C_Carry) ? 1 : 0;
        Cpu.SetA(a + b + c);
        // Flags: Z0HC
        Cpu.SetFlag(Flag.Z_Zero, Cpu.A() == 0);
        Cpu.SetFlag(Flag.N_Sub, 0);
        Cpu.SetFlag(Flag.H_HalfC, (a & 0xf) + (b & 0xf) + c > 0xf);
        Cpu.SetFlag(Flag.C_Carry, <u16>a + b + c > 0xFF);
    }

    static CpOp(sourceOp: Operand, originalPc: u16): void {
        const a = Cpu.A();
        const b: u8 = Cpu.get8bitSourceValue(originalPc + 1, sourceOp);
        if (sourceOp.target == OpTarget.A) {
            Cpu.SetF(<u8>(Flag.Z_Zero | Flag.N_Sub));
        }
        else {
            Cpu.SetFlag(Flag.Z_Zero, a == b);
            Cpu.SetFlag(Flag.N_Sub, 1);
            Cpu.SetFlag(Flag.H_HalfC, isAddHalfCarry8bit(~a, b));
            Cpu.SetFlag(Flag.C_Carry, isAddCarry8bit(~a, b));
        }
        // TODO check H and C logic
    }

    static IncOp(instr: Instruction): void {
        const registerOp = instr.operands[0];
        if (instr.cycleCounts[0] == 8) { // 16 bit
            const value: u16 = Cpu.get16bitValue(0x00, registerOp);
            Cpu.Set16bitValue(0x00, registerOp, value + 1);
        } else {
            const value: u8 = Cpu.get8bitSourceValue(0x00, registerOp);
            // Flags Z0H-
            Cpu.set8bitTargetValue(0x00, registerOp, value + 1);
            Cpu.SetFlag(Flag.Z_Zero, value + 1 == 0);
            Cpu.SetFlag(Flag.N_Sub, 0);
            Cpu.SetFlag(Flag.H_HalfC, isAddHalfCarry8bit(value, 1));
        }
    }

    static DecOp(instr: Instruction): void {
        const registerOp = instr.operands[0];
        if (instr.cycleCounts[0] == 8) { // 16 bit
            const value: u16 = Cpu.get16bitValue(0x00, registerOp);
            Cpu.Set16bitValue(0x00, registerOp, value - 1);
        } else {
            const value: u8 = Cpu.get8bitSourceValue(0x00, registerOp);
            // Flags Z1H-
            Cpu.set8bitTargetValue(0x00, registerOp, value - 1);
            Cpu.SetFlag(Flag.Z_Zero, value == 1);
            Cpu.SetFlag(Flag.N_Sub, 1);
            Cpu.SetFlag(Flag.H_HalfC, (value & 0xf) == 0);
        }
    }

    static AddOp(instr: Instruction, opCodeAddress: u16): void {
        const targetOp = instr.operands[0];
        const sourceOp = instr.operands[1];
        let b16: u16;
        switch (targetOp.target) {
            case OpTarget.HL:
                b16 = Cpu.get16bitValue(opCodeAddress + 1, sourceOp);
                // Flags: -0HC
                Cpu.SetFlag(Flag.N_Sub, 0);
                Cpu.SetFlag(Flag.H_HalfC, isAddHalfCarry16bit(Cpu.HL, b16));
                Cpu.SetFlag(Flag.C_Carry, isAddCarry16bit(Cpu.HL, b16));
                Cpu.HL += b16;
                break;
            case OpTarget.SP:
                b16 = <u16>Cpu.get8bitSourceValue(opCodeAddress + 1, sourceOp);
                // Flags: 00HC - SP uses 8bit Half-carry logic - https://stackoverflow.com/a/57978555
                Cpu.SetF(0);
                Cpu.SetFlag(Flag.H_HalfC, isAddHalfCarry8bit(<u8>Cpu.StackPointer & 0xff, <u8>b16 & 0xff));
                Cpu.SetFlag(Flag.C_Carry, isAddCarry16bit(Cpu.StackPointer, b16));
                Cpu.StackPointer += b16;
                break;
            case OpTarget.A:
                const b8 = Cpu.get8bitSourceValue(opCodeAddress + 1, sourceOp);
                // Flags: Z0HC
                Cpu.SetFlag(Flag.Z_Zero, Cpu.A() + b8 == 0);
                Cpu.SetFlag(Flag.N_Sub, 0);
                Cpu.SetFlag(Flag.H_HalfC, isAddHalfCarry8bit(Cpu.A(), b8));
                Cpu.SetFlag(Flag.C_Carry, isAddCarry8bit(Cpu.A(), b8));
                Cpu.SetA(Cpu.A() + b8);
                break;
            default:
                assert(false, 'Unexpected Add Target: 0x' + targetOp.target.toString(16));
        }
    }

    static SubOp(instr: Instruction, opCodeAddress: u16): void {
        const sourceOp = instr.operands[1];
        const sourceValue: u8 = Cpu.get8bitSourceValue(opCodeAddress + 1, sourceOp);
        const targetValue = Cpu.A();
        Cpu.SetA(targetValue - sourceValue);
        Cpu.SetFlag(Flag.Z_Zero, targetValue - sourceValue == 0);
        Cpu.SetFlag(Flag.N_Sub);
        Cpu.SetFlag(Flag.H_HalfC, (sourceValue & 0xf) > (targetValue & 0xf));
        Cpu.SetFlag(Flag.C_Carry, sourceValue > targetValue);
    }

    static XorOp(instr: Instruction, originalPc: u16): void {
        const source: u8 = Cpu.get8bitSourceValue(originalPc + 1, instr.operands[1]);
        const result: u8 = source ^ Cpu.A();
        Cpu.SetA(result);
        // Flags: Z000
        Cpu.SetF(0);
        Cpu.SetFlag(Flag.Z_Zero, result == 0);
    }

    static OrOp(instr: Instruction, originalPc: u16): void {
        const source: u8 = Cpu.get8bitSourceValue(originalPc + 1, instr.operands[1]);
        const result: u8 = source | Cpu.A();
        Cpu.SetA(result);
        // Flags: Z000
        Cpu.SetF(0);
        Cpu.SetFlag(Flag.Z_Zero, result == 0);
    }

    static AndOp(instr: Instruction, originalPc: u16): void {
        const source: u8 = Cpu.get8bitSourceValue(originalPc + 1, instr.operands[1]);
        const result: u8 = source & Cpu.A();
        Cpu.SetA(result);
        // Flags: Z010
        Cpu.SetF(0);
        Cpu.SetFlag(Flag.Z_Zero, result == 0);
        Cpu.SetFlag(Flag.H_HalfC, 1);
    }

    static BitOp(numBits: u8, sourceReg: Operand): void {
        const regValue: u8 = Cpu.get8bitSourceValue(0x00, sourceReg);
        const bitTest = 1 << numBits;
        const hasBit = (regValue & bitTest) == bitTest;
        Cpu.SetFlag(Flag.Z_Zero, !hasBit);
        Cpu.SetFlag(Flag.N_Sub, 0);
        Cpu.SetFlag(Flag.H_HalfC, 1);
    }

    static ResOp(numBits: u8, sourceReg: Operand): void {
        const regValue: u8 = Cpu.get8bitSourceValue(0x00, sourceReg);
        const bit: u8 = 1 << numBits;
        Cpu.set8bitTargetValue(0x00, sourceReg, regValue & ~bit);
    }

    static SetOp(numBits: u8, sourceReg: Operand): void {
        const regValue: u8 = Cpu.get8bitSourceValue(0x00, sourceReg);
        const bit: u8 = 1 << numBits;
        Cpu.set8bitTargetValue(0x00, sourceReg, regValue | bit);
    }

    static RlcaOp(): void {
        Cpu.SetA(rlc(Cpu.A()));
    }

    static RrcaOp(): void {
        Cpu.SetA(rrc(Cpu.A()));
    }

    static RraOp(): void {
        Cpu.SetA(rr(Cpu.A()));
    }

    static RlaOp(): void {
        Cpu.SetA(rl(Cpu.A()));
    }

    static RlcOp(target: Operand): void {
        const source: u8 = Cpu.get8bitSourceValue(0x00, target);
        const value = rlc(source)
        Cpu.set8bitTargetValue(0x00, target, value);
        // Flags Z 0 0 C
        Cpu.SetFlag(Flag.Z_Zero, value == 0);
    }

    static RlOp(target: Operand): void {
        const source: u8 = Cpu.get8bitSourceValue(0x00, target);
        const value = rl(source)
        Cpu.set8bitTargetValue(0x00, target, value);
        // Flags Z 0 0 C
        Cpu.SetFlag(Flag.Z_Zero, value == 0);
    }

    static RrcOp(target: Operand): void {
        const source: u8 = Cpu.get8bitSourceValue(0x00, target);
        const value = rrc(source)
        Cpu.set8bitTargetValue(0x00, target, value);
        // Flags Z 0 0 C
        Cpu.SetFlag(Flag.Z_Zero, value == 0);
    }

    static RrOp(target: Operand): void {
        const source: u8 = Cpu.get8bitSourceValue(0x00, target);
        const value = rr(source);
        Cpu.set8bitTargetValue(0x00, target, value);
        // Flags Z 0 0 C
        Cpu.SetFlag(Flag.Z_Zero, value == 0);
    }

    static SrlOp(target: Operand): void {
        let value: u8 = Cpu.get8bitSourceValue(0x00, target);
        const bit0isSet: boolean = (value & 1) == 1;
        value = value >> 1;
        // Flags Z 0 0 C
        Cpu.SetF(0);
        Cpu.SetFlag(Flag.C_Carry, bit0isSet);
        Cpu.SetFlag(Flag.Z_Zero, value == 0);
        Cpu.set8bitTargetValue(0x00, target, value);
    }

    static SraOp(target: Operand): void {
        let value: u8 = Cpu.get8bitSourceValue(0x00, target);
        const bit0isSet: boolean = (value & 1) == 1;
        const bit7isSet: boolean = (value & 0x80) == 0x80;
        value = (value >> 1) | (bit7isSet ? 0x80 : 0);
        // Flags Z 0 0 C
        Cpu.SetF(0);
        Cpu.SetFlag(Flag.C_Carry, bit0isSet);
        Cpu.SetFlag(Flag.Z_Zero, value == 0);
        Cpu.set8bitTargetValue(0x00, target, value);
    }

    static SlaOp(target: Operand): void {
        let value: u8 = Cpu.get8bitSourceValue(0x00, target);
        const bit7isSet: boolean = (value & 0x80) == 0x80;
        value = value << 1;
        // Flags Z 0 0 C
        Cpu.SetF(0);
        Cpu.SetFlag(Flag.C_Carry, bit7isSet);
        Cpu.SetFlag(Flag.Z_Zero, value == 0);
        Cpu.set8bitTargetValue(0x00, target, value);
    }

    @inline
    static CplOp(): void {
        Cpu.SetA(~Cpu.A());
    }

    static CcfOp(): void {
        // Flags - 0 0 C
        Cpu.SetFlag(Flag.N_Sub, 0);
        Cpu.SetFlag(Flag.H_HalfC, 0);
        Cpu.SetFlag(Flag.C_Carry, !Cpu.HasFlag(Flag.C_Carry));
    }

    static ScfOp(): void {
        // - 0 0 1
        Cpu.SetFlag(Flag.N_Sub, 0);
        Cpu.SetFlag(Flag.H_HalfC, 0);
        Cpu.SetFlag(Flag.C_Carry, 1);
    }
}
