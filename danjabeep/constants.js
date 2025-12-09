/**
 * WebBeep Constants - JavaScript port
 * Original: org.hyperdata.beeps.config.Constants
 *
 * Audio encoding constants for the beep system
 */

export const Constants = {
    // Audio format settings
    AMPLITUDE: 0.49,
    SAMPLE_RATE: 22050,
    BITS_PER_SAMPLE: 16,
    BYTES_PER_SAMPLE: 2,
    MAX_VALUE: 32767,

    // Timing values (in seconds)
    TONE_DURATION: 0.0486,
    SILENCE_DURATION: 0,
    START_PADDING: 0.0729,
    END_PADDING: 0.1458,

    // Envelope shaping
    ATTACK_PROPORTION: 0.0625,
    DECAY_PROPORTION: 0.125,

    // Filter frequencies
    LOW_PASS_MIN: 1000,
    LOW_PASS_MAX: 12000,
    HIGH_PASS_MIN: 60,
    HIGH_PASS_MAX: 300,
    CUTOFF_PADDING_RATIO: 1.1,

    // Decode thresholds
    SILENCE_THRESHOLD: 0.5,
    CROP_PROPORTION: 0.5,
    EDGE_WINDOW_PROPORTION: 0.01,

    // FFT settings
    FFT_BITS: 10,
    MAX_FFT_SIZE: 1024,
    PEAK_DELTA: 0.5,
};

export default Constants;
