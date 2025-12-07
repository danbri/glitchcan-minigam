/**
 * Furby Packet Generator
 *
 * Generates control packets for Furby toys.
 * Each command is encoded as quaternary (base-4) digits 0-3.
 * Packets are sent in pairs for reliability.
 */

export class FurbyPacket {
    /**
     * Known Furby commands (hex values)
     * These are documented commands from Furby reverse engineering
     */
    static COMMANDS = {
        // Basic actions
        'WAKE_UP': 0x00,
        'SLEEP': 0x01,
        'ACTION_1': 0x10,
        'ACTION_2': 0x11,
        'SING': 0x12,
        'DANCE': 0x13,
        'TALK': 0x14,
        'BURP': 0x15,
        'FART': 0x16,
        'SNEEZE': 0x17,
        'LAUGH': 0x18,
        'HICCUP': 0x19,
        'ME_HUNGRY': 0x20,
        'ME_SLEEPY': 0x21,
        'HUG': 0x22,
        'JOKE': 0x23,
        'SCARED': 0x24,
        'WHISTLE': 0x25,
        'YAWN': 0x26,
        'PURR': 0x27,

        // Special commands
        'RESET': 0xFF,
        'TEST_MODE': 0xFE,
        'DIAGNOSTICS': 0xFD,
    };

    /**
     * Convert a byte value to quaternary string (base-4 digits 0-3)
     * @param {number} byte - Value 0-255
     * @returns {string} - 4 quaternary digits representing the byte
     */
    static byteToQuaternary(byte) {
        byte = byte & 0xFF; // Ensure 8-bit
        let result = '';
        for (let i = 3; i >= 0; i--) {
            result += ((byte >> (i * 2)) & 0x03).toString();
        }
        return result;
    }

    /**
     * Calculate checksum for a command byte
     * @param {number} cmd - Command byte
     * @returns {number} - Checksum byte
     */
    static checksum(cmd) {
        // Simple XOR checksum with complement
        return (cmd ^ 0xFF) & 0xFF;
    }

    /**
     * Create a Furby packet from a command
     * Returns two space-separated quaternary strings (packet sent twice)
     *
     * @param {number|string} command - Command byte (0-255) or command name
     * @returns {string} - Two space-separated packet strings
     */
    static make(command) {
        let cmdByte;

        if (typeof command === 'string') {
            // Look up named command
            if (command in this.COMMANDS) {
                cmdByte = this.COMMANDS[command];
            } else if (command.match(/^0x[0-9A-Fa-f]+$/)) {
                // Hex string
                cmdByte = parseInt(command, 16);
            } else if (command.match(/^[0-9]+$/)) {
                // Decimal string
                cmdByte = parseInt(command, 10);
            } else {
                throw new Error(`Unknown command: ${command}`);
            }
        } else {
            cmdByte = command;
        }

        // Build packet: command byte + checksum
        const chk = this.checksum(cmdByte);
        const packet = this.byteToQuaternary(cmdByte) + this.byteToQuaternary(chk);

        // Return packet twice (for reliability)
        return `${packet} ${packet}`;
    }

    /**
     * Get list of available command names
     * @returns {string[]} - Array of command names
     */
    static getCommandNames() {
        return Object.keys(this.COMMANDS);
    }

    /**
     * Parse a raw packet string (for debugging)
     * @param {string} packet - Quaternary packet string
     * @returns {object} - Decoded packet info
     */
    static parsePacket(packet) {
        // Remove non-digit characters
        const digits = packet.replace(/[^0-3]/g, '');

        if (digits.length < 8) {
            return { error: 'Packet too short' };
        }

        // Convert quaternary back to bytes
        let cmdByte = 0;
        let chkByte = 0;

        for (let i = 0; i < 4; i++) {
            cmdByte = (cmdByte << 2) | parseInt(digits[i]);
        }
        for (let i = 4; i < 8; i++) {
            chkByte = (chkByte << 2) | parseInt(digits[i]);
        }

        const expectedChk = this.checksum(cmdByte);
        const valid = chkByte === expectedChk;

        // Find command name if known
        let cmdName = null;
        for (const [name, value] of Object.entries(this.COMMANDS)) {
            if (value === cmdByte) {
                cmdName = name;
                break;
            }
        }

        return {
            command: cmdByte,
            commandHex: '0x' + cmdByte.toString(16).toUpperCase().padStart(2, '0'),
            commandName: cmdName,
            checksum: chkByte,
            checksumValid: valid,
            raw: digits
        };
    }
}

export default FurbyPacket;
