import { Op, OpCondition, OpTarget } from "../cpu/opcodes";
import { CGBMode } from "../metadata";

export const conditionNames: Map<OpCondition, string> = new Map<OpCondition, string>();
conditionNames.set(OpCondition.NonZero, "NZ");
conditionNames.set(OpCondition.Zero, "Z");
conditionNames.set(OpCondition.NonCarry, "NC");
conditionNames.set(OpCondition.Carry, "C");

export const CartridgeTypeNames = [
    'ROM_ONLY',
    'MBC1',
    'MBC1_RAM',
    'MBC1_RAM_BATTERY',
    'MBC2',
    'MBC2_BATTERY',
    'ROM_RAM_1',
    'ROM_RAM_BATTERY_1',
    'MMM01',
    'MMM01_RAM',
    'MMM01_RAM_BATTERY',
    'MBC3_TIMER_BATTERY',
    'MBC3_TIMER_RAM_BATTERY_2',
    'MBC3',
    'MBC3_RAM_2',
    'MBC3_RAM_BATTERY_2',
    'MBC5',
    'MBC5_RAM',
    'MBC5_RAM_BATTERY',
    'MBC5_RUMBLE',
    'MBC5_RUMBLE_RAM',
    'MBC5_RUMBLE_RAM_BATTERY',
    'MBC6',
    'MBC7_SENSOR_RUMBLE_RAM_BATTERY',
    'POCKET_CAMERA',
    'BANDAI_TAMA5',
    'HuC3',
    'HuC1_RAM_BATTERY',
];

export const CGBModeNames = new Map<CGBMode, string>();
CGBModeNames.set(CGBMode.NonCGB, "NonCGB");
CGBModeNames.set(CGBMode.PartialCGB, "PartialCGB");
CGBModeNames.set(CGBMode.CGBOnly, "CGBOnly");

export const opNames: Map<Op, string> = new Map<Op, string>();
opNames.set(Op.ADC, "ADC");
opNames.set(Op.ADD, "ADD");
opNames.set(Op.AND, "AND");
opNames.set(Op.BIT, "BIT");
opNames.set(Op.CALL, "CALL");
opNames.set(Op.CCF, "CCF");
opNames.set(Op.CP, "CP");
opNames.set(Op.CPL, "CPL");
opNames.set(Op.DAA, "DAA");
opNames.set(Op.DEC, "DEC");
opNames.set(Op.DI, "DI");
opNames.set(Op.EI, "EI");
opNames.set(Op.HALT, "HALT");
opNames.set(Op.ILLEGAL, "ILLEGAL");
opNames.set(Op.INC, "INC");
opNames.set(Op.JP, "JP");
opNames.set(Op.JR, "JR");
opNames.set(Op.LD, "LD");
opNames.set(Op.LDH, "LDH");
opNames.set(Op.NOP, "NOP");
opNames.set(Op.OR, "OR");
opNames.set(Op.POP, "POP");
opNames.set(Op.PREFIX, "PREFIX");
opNames.set(Op.PUSH, "PUSH");
opNames.set(Op.RES, "RES");
opNames.set(Op.RET, "RET");
opNames.set(Op.RETI, "RETI");
opNames.set(Op.RL, "RL");
opNames.set(Op.RLA, "RLA");
opNames.set(Op.RLC, "RLC");
opNames.set(Op.RLCA, "RLCA");
opNames.set(Op.RR, "RR");
opNames.set(Op.RRA, "RRA");
opNames.set(Op.RRC, "RRC");
opNames.set(Op.RRCA, "RRCA");
opNames.set(Op.RST, "RST");
opNames.set(Op.SBC, "SBC");
opNames.set(Op.SCF, "SCF");
opNames.set(Op.SET, "SET");
opNames.set(Op.SLA, "SLA");
opNames.set(Op.SRA, "SRA");
opNames.set(Op.SRL, "SRL");
opNames.set(Op.STOP, "STOP");
opNames.set(Op.SUB, "SUB");
opNames.set(Op.SWAP, "SWAP");
opNames.set(Op.XOR, "XOR");

export const targetNames: Map<OpTarget, string> = new Map<OpTarget, string>();
targetNames.set(OpTarget.A, "A");
targetNames.set(OpTarget.AF, "AF");
targetNames.set(OpTarget.B, "B");
targetNames.set(OpTarget.BC, "BC");
targetNames.set(OpTarget.C, "C");
targetNames.set(OpTarget.D, "D");
targetNames.set(OpTarget.DE, "DE");
targetNames.set(OpTarget.E, "E");
targetNames.set(OpTarget.H, "H");
targetNames.set(OpTarget.HL, "HL");
targetNames.set(OpTarget.L, "L");
targetNames.set(OpTarget.SP, "SP");
targetNames.set(OpTarget.Value, "Value");
targetNames.set(OpTarget.Constant, "Constant");
