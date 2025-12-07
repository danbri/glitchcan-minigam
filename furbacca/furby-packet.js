/**
 * Furby Packet Generator
 *
 * Generates control packets for Furby toys.
 * Commands are 10-bit values (0-1023) encoded as quaternary (base-4) digits.
 * Based on Hacksby reverse engineering: https://github.com/iafan/Hacksby
 */

export class FurbyPacket {
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
     * Convert a 10-bit value to quaternary string (base-4 digits 0-3)
     * @param {number} value - Value 0-1023
     * @returns {string} - 5 quaternary digits representing the value
     */
    static valueToQuaternary(value) {
        value = value & 0x3FF; // Ensure 10-bit (0-1023)
        let result = '';
        for (let i = 4; i >= 0; i--) {
            result += ((value >> (i * 2)) & 0x03).toString();
        }
        return result;
    }

    /**
     * Convert quaternary string back to number
     * @param {string} quat - Quaternary digit string
     * @returns {number} - Decoded value
     */
    static quaternaryToValue(quat) {
        let value = 0;
        for (let i = 0; i < quat.length; i++) {
            value = (value << 2) | parseInt(quat[i]);
        }
        return value;
    }

    /**
     * Calculate checksum for a command
     * For 10-bit commands, checksum is the complement (XOR with 0x3FF)
     * @param {number} cmd - Command value (0-1023)
     * @returns {number} - Checksum value (0-1023)
     */
    static checksum(cmd) {
        return (cmd ^ 0x3FF) & 0x3FF;
    }

    /**
     * Create a Furby packet from a command
     * Returns two space-separated quaternary strings (packet sent twice)
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

        // Build packet: command (5 digits) + checksum (5 digits)
        const chk = this.checksum(cmdValue);
        const packet = this.valueToQuaternary(cmdValue) + this.valueToQuaternary(chk);

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
     * Parse a raw packet string (for debugging)
     * @param {string} packet - Quaternary packet string
     * @returns {object} - Decoded packet info
     */
    static parsePacket(packet) {
        // Remove non-digit characters
        const digits = packet.replace(/[^0-3]/g, '');

        if (digits.length < 10) {
            return { error: 'Packet too short (need 10 quaternary digits)' };
        }

        // Convert quaternary back to values (5 digits each)
        const cmdValue = this.quaternaryToValue(digits.substring(0, 5));
        const chkValue = this.quaternaryToValue(digits.substring(5, 10));

        const expectedChk = this.checksum(cmdValue);
        const valid = chkValue === expectedChk;

        // Find command name if known
        let cmdName = null;
        for (const [name, value] of Object.entries(this.COMMANDS)) {
            if (value === cmdValue) {
                cmdName = name;
                break;
            }
        }

        return {
            command: cmdValue,
            commandHex: '0x' + cmdValue.toString(16).toUpperCase().padStart(3, '0'),
            commandName: cmdName,
            description: this.DESCRIPTIONS[cmdValue] || '',
            checksum: chkValue,
            checksumValid: valid,
            raw: digits.substring(0, 10)
        };
    }
}

export default FurbyPacket;
