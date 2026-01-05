/**
 * Furby Packet Generator
 *
 * Generates control packets for Furby toys.
 * Based on Hacksby reverse engineering: https://github.com/iafan/Hacksby
 *
 * Protocol:
 * - Commands are 10-bit values (0-1023)
 * - Each command is encoded as TWO packets:
 *   - Packet 1: high 5 bits (0-31)
 *   - Packet 2: low 5 bits + 32 (32-63)
 * - Each packet is 12 quaternary digits: DATA(4) + CHECKSUM(4) + IDENTIFIER(4)
 * - Checksums are looked up from a table, not calculated via XOR
 */

export class FurbyPacket {
    /**
     * Checksum lookup table from Hacksby Furby::Packet
     * First 32 entries for first packet (high bits)
     * Second 32 entries for second packet (low bits + 32)
     */
    static CHECKSUMS = [
        // First packet (higher 5 bits of command number)
        '0000', //  0
        '0110', //  1
        '0210', //  2
        '0300', //  3
        '1023', //  4
        '1133', //  5
        '1233', //  6
        '1323', //  7
        '0120', //  8
        '0201', //  9
        '0330', // 10
        '1021', // 11
        '1103', // 12
        '1222', // 13
        '1313', // 14
        '2021', // 15
        '0220', // 16
        '0330', // 17
        '1000', // 18
        '1110', // 19
        '1203', // 20
        '1313', // 21
        '2000', // 22
        '2110', // 23
        '0300', // 24
        '1011', // 25
        '1120', // 26
        '1201', // 27
        '1323', // 28
        '2011', // 29
        '2120', // 30
        '2201', // 31

        // Second packet (lower 5 bits of command number + 32)
        '1033', //  0 + 32
        '1123', //  1 + 32
        '1223', //  2 + 32
        '1333', //  3 + 32
        '2033', //  4 + 32
        '2123', //  5 + 32
        '2223', //  6 + 32
        '2333', //  7 + 32
        '1113', //  8 + 32
        '1232', //  9 + 32
        '1303', // 10 + 32
        '2031', // 11 + 32
        '2113', // 12 + 32
        '2232', // 13 + 32
        '2303', // 14 + 32
        '3012', // 15 + 32
        '1213', // 16 + 32
        '1303', // 17 + 32
        '2010', // 18 + 32
        '2100', // 19 + 32
        '2213', // 20 + 32
        '2303', // 21 + 32
        '3033', // 22 + 32
        '3123', // 23 + 32
        '1333', // 24 + 32
        '2001', // 25 + 32
        '2130', // 26 + 32
        '2211', // 27 + 32
        '2333', // 28 + 32
        '3022', // 29 + 32
        '3113', // 30 + 32
        '3232', // 31 + 32
    ];

    // Fixed identifier at end of each packet
    static IDENTIFIER = '1032';

    /**
     * Known Furby commands (decimal values 0-1023)
     * From Hacksby Furby::Command - commands marked with ! work with iOS app
     */
    static COMMANDS = {
        // Food commands (350-425)
        'FOOD_TASTY': 350,              // "mmm, yum"
        'FOOD_SMALL_TASTY': 352,        // Small eatable tasty stuff (like peanut)
        'FOOD_SOFT_TASTY': 353,         // Bigger soft eatable tasty stuff (like banana)
        'FOOD_SUCKABLE_TASTY': 354,     // Suckable tasty stuff (like oysters, spaghetti)
        'FOOD_DRINKABLE': 355,          // Drinkable tasty stuff
        'FOOD_HARD_NOT_TASTY': 356,     // Hard eatable but not tasty (like chicken bone)
        'FOOD_SMALL_NOT_TASTY': 358,    // Small not tasty stuff (like pepperoni)
        'FOOD_SOFT_NOT_TASTY': 359,     // Bigger soft not tasty stuff (like asparagus)
        'FOOD_SUCKABLE_NOT_TASTY': 360, // Suckable not tasty stuff
        'FOOD_BEANS': 372,              // Suckable tasty stuff like beans - "ooh!"
        'FOOD_HOT_1': 410,              // Something hot
        'FOOD_HOT_2': 412,              // Something hot
        'FOOD_HOT_3': 413,              // Something hot
        'FOOD_NON_EATABLE': 417,        // Non-eatable stuff (toilet paper, pillow, etc)

        // Event commands (700-724) - things Furby does/says
        'EVENT_BORED': 700,             // I'm bored/sleepy - does silly things
        'EVENT_BURP': 701,              // Burp event
        'EVENT_CHEW': 702,              // Chew-chew
        'EVENT_TOUCHED': 703,           // You touched my head/side, turned me on side
        'EVENT_FART': 704,              // Fart event
        'EVENT_WAKEUP': 705,            // I woke up! (before "Good morning")
        'EVENT_PING_1': 706,            // Random idle ping, responds with 721
        'EVENT_PING_2': 707,            // Random idle ping, responds with 722
        'EVENT_PING_3': 708,            // dang-dang-dang-da..., responds with 723
        'EVENT_PING_4': 709,            // bo-ga-di-di-do..., responds with 724
        'EVENT_HAPPY': 710,             // Me happy (head or back touched)
        'EVENT_COUGH': 711,             // cough-cough-cough
        'EVENT_HUNGRY': 712,            // Me hungry! / Kah Ay-tay!
        'EVENT_TUMMY': 713,             // You touched my tummy
        'EVENT_HAPPY_2': 716,           // Me happy (side/back/head touched)
        'EVENT_SNEEZE': 717,            // Achoo!
        'EVENT_YAWN': 718,              // Yawn (going to sleep)
        'EVENT_WHISPER': 719,           // Whisper, whisper, he-he-he

        // Song/response commands (721-724, 760-766)
        'SONG_1': 721,                  // Response to 706, sings a song
        'SONG_2': 722,                  // Response to 707, sings a song
        'SONG_3': 723,                  // Response to 708, sings a song
        'SONG_4': 724,                  // Response to 709, sings a song
        'SONG_LOVE': 760,               // "love friend, nay nay noo la"
        'SONG_DAYDEE': 761,             // "day-dee"
        'SONG_KISS': 762,               // "meila koo mei ta..." (kiss)
        'SONG_ATA': 763,                // "ka tulu ata, ata, ata, ata"
        'SONG_BLAH': 764,               // "witi wati to to, blah blah..."
        'SONG_FART': 765,               // "(fart) oh-ho-ho, tu lu li ku!"
        'SONG_SHAA': 766,               // "boda tei ta eу ku, shaa!"

        // Handshake/communication (780-791, 813, 820)
        'HANDSHAKE_RECV_790': 780,      // I've got command 790
        'HANDSHAKE_RECV_791': 781,      // I've got command 791
        'HANDSHAKE_SEND_1': 790,        // "ee day do lay lo la!" - responds with 780
        'HANDSHAKE_SEND_2': 791,        // "u nai bo li day" - responds with 781
        'GET_PERSONALITY': 813,         // What's your personality? (handshake step 1)
        'HYPNOTIZE': 820,               // Hypnotize for 1 minute (iOS app sends this)

        // Direct commands (862-893)
        'CMD_SLEEP': 862,               // Sleep! (for several seconds)
        'CMD_LAUGH': 863,               // Laugh!
        'CMD_BURP': 864,                // Burp!
        'CMD_FART': 865,                // Fart/poo!
        'CMD_PURR': 866,                // Purr!
        'CMD_SNEEZE': 867,              // Long sneeze!
        'CMD_SING': 868,                // Sing!
        'CMD_TALK': 869,                // Talk!

        // Personality responses (900-911)
        'PERSONALITY_NONE': 900,        // No personality developed yet
        'PERSONALITY_PRINCESS': 901,    // I'm a princess!
        'PERSONALITY_DIVA': 902,        // I'm a diva!
        'PERSONALITY_WARRIOR': 903,     // I'm a warrior!
        'PERSONALITY_JOKER': 904,       // I'm a joker!
        'PERSONALITY_GOSSIP': 905,      // I'm a gossip queen!
        'PERSONALITY_SNUGGLEBY': 906,   // Snuggleby
        'PERSONALITY_SASSBY': 907,      // Sassby
        'PERSONALITY_SCOFFBY': 908,     // Scoffby
        'PERSONALITY_CHUCKLEBY': 909,   // Chuckleby
        'PERSONALITY_GASSBY': 910,      // Gassby
        'PERSONALITY_LATEBY': 911,      // Lateby
    };

    /**
     * Command descriptions for UI display
     */
    static DESCRIPTIONS = {
        350: 'Food, tasty ("mmm, yum")',
        352: 'Small eatable tasty stuff (peanut)',
        353: 'Soft eatable tasty stuff (banana)',
        354: 'Suckable tasty stuff (oysters)',
        355: 'Drinkable tasty stuff',
        356: 'Hard not tasty (chicken bone)',
        358: 'Small not tasty (pepperoni)',
        359: 'Soft not tasty (asparagus)',
        360: 'Suckable not tasty',
        372: 'Beans - "ooh!"',
        417: 'Non-eatable (toilet paper)',
        700: 'Event: Bored/sleepy',
        701: 'Event: Burp',
        702: 'Event: Chew-chew',
        703: 'Event: Touched head/side',
        704: 'Event: Fart',
        705: 'Event: Woke up!',
        710: 'Event: Me happy',
        711: 'Event: Cough',
        712: 'Event: Me hungry!',
        713: 'Event: Tummy touched',
        717: 'Event: Achoo!',
        718: 'Event: Yawn',
        719: 'Event: Whisper',
        813: 'Get personality type',
        820: 'Hypnotize (1 min)',
        862: 'Command: Sleep!',
        863: 'Command: Laugh!',
        864: 'Command: Burp!',
        865: 'Command: Fart!',
        866: 'Command: Purr!',
        867: 'Command: Sneeze!',
        868: 'Command: Sing!',
        869: 'Command: Talk!',
        900: 'No personality yet',
        901: 'Princess personality',
        902: 'Diva personality',
        903: 'Warrior personality',
        904: 'Joker personality',
        905: 'Gossip Queen',
    };

    /**
     * Convert 6-bit binary string to 4 quaternary digits
     * Example: '11011011' -> '3123'
     * @param {string} binary - 8-bit binary string
     * @returns {string} - 4 quaternary digits
     */
    static binToQuad(binary) {
        let result = '';
        for (let i = 0; i < binary.length; i += 2) {
            const pair = binary.substring(i, i + 2);
            result += parseInt(pair, 2).toString();
        }
        return result;
    }

    /**
     * Convert number to 6-bit binary string
     * @param {number} value - Value 0-63
     * @returns {string} - 6-bit binary string
     */
    static decToBin6(value) {
        return value.toString(2).padStart(6, '0');
    }

    /**
     * Convert quaternary string to decimal
     * @param {string} quad - Quaternary string
     * @returns {number} - Decimal value
     */
    static quadToDec(quad) {
        let result = 0;
        for (const digit of quad) {
            result = (result << 2) | parseInt(digit);
        }
        return result;
    }

    /**
     * Create Furby packets from a command
     * Returns two space-separated packet strings (packet1 for high bits, packet2 for low bits)
     *
     * @param {number|string} command - Command value (0-1023) or command name
     * @returns {string} - Two space-separated packet strings
     */
    static make(command) {
        let cmdValue;

        if (typeof command === 'string') {
            // Look up named command
            if (command in this.COMMANDS) {
                cmdValue = this.COMMANDS[command];
            } else if (command.match(/^0x[0-9A-Fa-f]+$/i)) {
                // Hex string
                cmdValue = parseInt(command, 16);
            } else if (command.match(/^[0-9]+$/)) {
                // Decimal string
                cmdValue = parseInt(command, 10);
            } else {
                throw new Error(`Unknown command: ${command}`);
            }
        } else {
            cmdValue = command;
        }

        // Validate range
        if (cmdValue < 0 || cmdValue > 1023) {
            throw new Error(`Command must be 0-1023, got: ${cmdValue}`);
        }

        // Split into two packets
        const packet1Byte = cmdValue >> 5;           // High 5 bits (0-31)
        const packet2Byte = (cmdValue & 31) + 32;    // Low 5 bits + 32 (32-63)

        // Build packet 1: '11' + 6-bit binary -> 4 quaternary + checksum + identifier
        const bin1 = '11' + this.decToBin6(packet1Byte);
        const data1 = this.binToQuad(bin1);
        const checksum1 = this.CHECKSUMS[packet1Byte];
        const s1 = data1 + '-' + checksum1 + '-' + this.IDENTIFIER;

        // Build packet 2: '11' + 6-bit binary -> 4 quaternary + checksum + identifier
        const bin2 = '11' + this.decToBin6(packet2Byte);
        const data2 = this.binToQuad(bin2);
        const checksum2 = this.CHECKSUMS[packet2Byte];
        const s2 = data2 + '-' + checksum2 + '-' + this.IDENTIFIER;

        return `${s1} ${s2}`;
    }

    /**
     * Get list of available command names
     * @returns {string[]} - Array of command names
     */
    static getCommandNames() {
        return Object.keys(this.COMMANDS);
    }

    /**
     * Get grouped commands for UI
     * @returns {object} - Commands grouped by category
     */
    static getCommandGroups() {
        return {
            'Actions': ['CMD_SLEEP', 'CMD_LAUGH', 'CMD_BURP', 'CMD_FART', 'CMD_PURR', 'CMD_SNEEZE', 'CMD_SING', 'CMD_TALK'],
            'Food (Tasty)': ['FOOD_TASTY', 'FOOD_SMALL_TASTY', 'FOOD_SOFT_TASTY', 'FOOD_SUCKABLE_TASTY', 'FOOD_DRINKABLE', 'FOOD_BEANS'],
            'Food (Not Tasty)': ['FOOD_HARD_NOT_TASTY', 'FOOD_SMALL_NOT_TASTY', 'FOOD_SOFT_NOT_TASTY', 'FOOD_SUCKABLE_NOT_TASTY', 'FOOD_NON_EATABLE'],
            'Food (Hot)': ['FOOD_HOT_1', 'FOOD_HOT_2', 'FOOD_HOT_3'],
            'Events': ['EVENT_BORED', 'EVENT_BURP', 'EVENT_CHEW', 'EVENT_FART', 'EVENT_WAKEUP', 'EVENT_HAPPY', 'EVENT_COUGH', 'EVENT_HUNGRY', 'EVENT_SNEEZE', 'EVENT_YAWN', 'EVENT_WHISPER'],
            'Songs': ['SONG_1', 'SONG_2', 'SONG_3', 'SONG_4', 'SONG_LOVE', 'SONG_KISS', 'SONG_ATA', 'SONG_BLAH', 'SONG_FART'],
            'Communication': ['GET_PERSONALITY', 'HYPNOTIZE', 'HANDSHAKE_SEND_1', 'HANDSHAKE_SEND_2'],
        };
    }

    /**
     * Get description for a command
     * @param {number|string} command - Command value or name
     * @returns {string} - Description or empty string
     */
    static getDescription(command) {
        let cmdValue;
        if (typeof command === 'string' && command in this.COMMANDS) {
            cmdValue = this.COMMANDS[command];
        } else {
            cmdValue = parseInt(command, 10);
        }
        return this.DESCRIPTIONS[cmdValue] || '';
    }

    /**
     * Parse a single raw packet string (12 quaternary digits)
     * Format: DATA(4) + CHECKSUM(4) + IDENTIFIER(4)
     * @param {string} packet - Quaternary packet string
     * @returns {object} - Decoded packet info
     */
    static parsePacket(packet) {
        // Remove non-digit characters
        const digits = packet.replace(/[^0-3]/g, '');

        if (digits.length < 8) {
            return { error: 'Packet too short (need at least 8 quaternary digits)' };
        }

        // Extract parts
        const data = digits.substring(0, 4);
        const checksum = digits.substring(4, 8);
        const identifier = digits.length >= 12 ? digits.substring(8, 12) : null;

        // Decode the byte value from data
        const byteValue = this.quadToDec(data);

        // Check high bits (should be 11xxxxxx = 192-255)
        if ((byteValue & 192) !== 192) {
            return {
                error: 'Invalid packet: high bits not set',
                data: data,
                byteValue: byteValue
            };
        }

        // Get the 6-bit payload
        const payload = byteValue & 63;

        // Look up expected checksum
        const expectedChecksum = this.CHECKSUMS[payload];
        const checksumValid = checksum === expectedChecksum;

        // Determine if this is packet 1 (high bits) or packet 2 (low bits)
        const isPacket2 = payload >= 32;
        const bits = isPacket2 ? (payload - 32) : payload;

        return {
            data: data,
            checksum: checksum,
            identifier: identifier,
            byteValue: byteValue,
            payload: payload,
            bits: bits,
            isPacket2: isPacket2,
            expectedChecksum: expectedChecksum,
            checksumValid: checksumValid,
            identifierValid: identifier === this.IDENTIFIER || identifier === null
        };
    }

    /**
     * Decode a full command from two packets
     * @param {object} packet1 - Parsed packet 1 (high bits)
     * @param {object} packet2 - Parsed packet 2 (low bits)
     * @returns {object} - Decoded command info
     */
    static decodeCommand(packet1, packet2) {
        if (packet1.error || packet2.error) {
            return { error: packet1.error || packet2.error };
        }

        if (packet1.isPacket2 || !packet2.isPacket2) {
            return { error: 'Packet order incorrect' };
        }

        if (!packet1.checksumValid || !packet2.checksumValid) {
            return { error: 'Checksum mismatch' };
        }

        // Reconstruct command: high 5 bits from packet1, low 5 bits from packet2
        const command = (packet1.bits << 5) | packet2.bits;

        // Find command name if known
        let cmdName = null;
        for (const [name, value] of Object.entries(this.COMMANDS)) {
            if (value === command) {
                cmdName = name;
                break;
            }
        }

        return {
            command: command,
            commandHex: '0x' + command.toString(16).toUpperCase().padStart(3, '0'),
            commandName: cmdName,
            description: this.DESCRIPTIONS[command] || '',
            packet1Valid: packet1.checksumValid,
            packet2Valid: packet2.checksumValid
        };
    }
}

export default FurbyPacket;
